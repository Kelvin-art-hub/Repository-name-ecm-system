from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.bom import BOMItem, BOMVersion
from app.models.user import User
from app.schemas.bom import BOMItemCreate, BOMItemUpdate, BOMItemResponse, BOMVersionResponse, BOMLockRequest
from app.services.auth import get_current_user, read_only_check, require_roles
from app.services.audit_service import log_action
from app.services.redis_service import redis_service
from app.services.ai_service import ai_service

router = APIRouter(prefix="/api/bom", tags=["BOM Management"])


def bom_item_to_dict(item: BOMItem) -> dict:
    return {
        "id": item.id,
        "part_number": item.part_number,
        "part_name": item.part_name,
        "revision": item.revision,
        "quantity": item.quantity,
        "unit": item.unit,
        "material": item.material,
        "product_family": item.product_family,
        "description": item.description,
        "manufacturer": item.manufacturer,
        "manufacturer_part_number": item.manufacturer_part_number,
        "unit_cost": item.unit_cost,
        "lead_time_days": item.lead_time_days,
        "status": item.status,
        "version": item.version,
        "parent_id": item.parent_id,
    }


def build_bom_tree(item: BOMItem, db: Session) -> dict:
    children = db.query(BOMItem).filter(BOMItem.parent_id == item.id).all()
    result = bom_item_to_dict(item)
    result["is_locked"] = item.is_locked
    result["locked_by"] = item.locked_by
    result["locked_at"] = item.locked_at.isoformat() if item.locked_at else None
    result["created_at"] = item.created_at.isoformat()
    result["updated_at"] = item.updated_at.isoformat()
    result["children"] = [build_bom_tree(c, db) for c in children]
    return result


@router.get("", response_model=List[dict])
def get_bom_tree(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get full BOM tree (root items with nested children)."""
    roots = db.query(BOMItem).filter(BOMItem.parent_id == None).all()
    return [build_bom_tree(r, db) for r in roots]


@router.get("/flat", response_model=List[dict])
def get_bom_flat(
    status: Optional[str] = Query(None),
    product_family: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get flat list of all BOM items."""
    query = db.query(BOMItem)
    if status:
        query = query.filter(BOMItem.status == status)
    if product_family:
        query = query.filter(BOMItem.product_family == product_family)
    if search:
        query = query.filter(
            BOMItem.part_number.ilike(f"%{search}%") |
            BOMItem.part_name.ilike(f"%{search}%")
        )
    items = query.order_by(BOMItem.part_number).all()
    return [bom_item_to_dict(item) for item in items]


@router.get("/{item_id}", response_model=dict)
def get_bom_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(BOMItem).filter(BOMItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="BOM item not found")

    # Check Redis lock status
    lock_info = redis_service.get_bom_lock(item_id)
    result = build_bom_tree(item, db)
    result["redis_lock"] = lock_info
    return result


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_bom_item(
    item_data: BOMItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(read_only_check),   # viewers blocked
):
    # Check parent exists
    if item_data.parent_id:
        parent = db.query(BOMItem).filter(BOMItem.id == item_data.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent BOM item not found")
        # Check if parent is locked
        lock = redis_service.get_bom_lock(item_data.parent_id)
        if lock and lock.get("user") != current_user.username:
            raise HTTPException(
                status_code=423,
                detail=f"Parent BOM item is locked by {lock.get('user')}. Cannot add children."
            )

    item = BOMItem(
        part_number=item_data.part_number,
        part_name=item_data.part_name,
        revision=item_data.revision,
        parent_id=item_data.parent_id,
        quantity=item_data.quantity,
        unit=item_data.unit,
        material=item_data.material,
        product_family=item_data.product_family,
        description=item_data.description,
        manufacturer=item_data.manufacturer,
        manufacturer_part_number=item_data.manufacturer_part_number,
        unit_cost=item_data.unit_cost,
        lead_time_days=item_data.lead_time_days,
        status=item_data.status,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    log_action(db, "CREATE", "BOMItem", item.id, username=current_user.username,
               user_id=current_user.id, details=f"Created BOM item {item.part_number}", commit=True)
    return bom_item_to_dict(item)


@router.put("/{item_id}", response_model=dict)
def update_bom_item(
    item_id: int,
    item_data: BOMItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(read_only_check),   # viewers blocked
):
    item = db.query(BOMItem).filter(BOMItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="BOM item not found")

    # Check Redis lock
    lock = redis_service.get_bom_lock(item_id)
    if lock and lock.get("user") != current_user.username:
        raise HTTPException(
            status_code=423,
            detail=f"BOM item is locked by {lock.get('user')}. Acquire lock first."
        )

    # Save version snapshot before update
    snapshot = bom_item_to_dict(item)
    version = BOMVersion(
        bom_item_id=item.id,
        version_number=item.version,
        revision=item.revision,
        snapshot=snapshot,
        change_summary=f"Updated by {current_user.username}",
        changed_by=current_user.username,
        changed_by_id=current_user.id,
    )
    db.add(version)

    update_data = item_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)
    item.version += 1
    item.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(item)

    log_action(db, "UPDATE", "BOMItem", item_id, username=current_user.username,
               user_id=current_user.id, details=f"Updated BOM item {item.part_number} to v{item.version}",
               old_values=snapshot, new_values=update_data, commit=True)
    return bom_item_to_dict(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bom_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "manager")),  # manager+ only
):
    item = db.query(BOMItem).filter(BOMItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="BOM item not found")

    lock = redis_service.get_bom_lock(item_id)
    if lock and lock.get("user") != current_user.username:
        raise HTTPException(status_code=423, detail=f"BOM item is locked by {lock.get('user')}")

    db.delete(item)
    db.commit()
    log_action(db, "DELETE", "BOMItem", item_id, username=current_user.username,
               user_id=current_user.id, details=f"Deleted BOM item {item.part_number}", commit=True)


# BOM Locking
@router.post("/{item_id}/lock")
def lock_bom_item(
    item_id: int,
    lock_req: BOMLockRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(read_only_check),   # viewers blocked
):
    item = db.query(BOMItem).filter(BOMItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="BOM item not found")

    success = redis_service.acquire_bom_lock(item_id, current_user.username)
    if not success:
        lock_info = redis_service.get_bom_lock(item_id)
        raise HTTPException(
            status_code=423,
            detail=f"BOM item is already locked by {lock_info.get('user') if lock_info else 'unknown'}"
        )

    item.is_locked = True
    item.locked_by = current_user.username
    item.locked_at = datetime.utcnow()
    db.commit()

    log_action(db, "LOCK", "BOMItem", item_id, username=current_user.username,
               user_id=current_user.id, details=f"Locked BOM item {item.part_number}", commit=True)
    return {"message": "BOM item locked successfully", "locked_by": current_user.username}


@router.post("/{item_id}/unlock")
def unlock_bom_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(read_only_check),   # viewers blocked
):
    item = db.query(BOMItem).filter(BOMItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="BOM item not found")

    success = redis_service.release_bom_lock(item_id, current_user.username)
    if not success and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You don't own this lock")

    item.is_locked = False
    item.locked_by = None
    item.locked_at = None
    db.commit()

    log_action(db, "UNLOCK", "BOMItem", item_id, username=current_user.username,
               user_id=current_user.id, details=f"Unlocked BOM item {item.part_number}", commit=True)
    return {"message": "BOM item unlocked successfully"}


# BOM Versions
@router.get("/{item_id}/versions", response_model=List[BOMVersionResponse])
def get_bom_versions(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(BOMItem).filter(BOMItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="BOM item not found")
    return db.query(BOMVersion).filter(BOMVersion.bom_item_id == item_id).order_by(BOMVersion.version_number.desc()).all()


@router.get("/{item_id}/compare")
def compare_bom_versions(
    item_id: int,
    version_a: int = Query(...),
    version_b: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    va = db.query(BOMVersion).filter(
        BOMVersion.bom_item_id == item_id,
        BOMVersion.version_number == version_a
    ).first()
    vb = db.query(BOMVersion).filter(
        BOMVersion.bom_item_id == item_id,
        BOMVersion.version_number == version_b
    ).first()

    if not va or not vb:
        raise HTTPException(status_code=404, detail="One or both versions not found")

    # Compute diff
    diff = {}
    snap_a = va.snapshot or {}
    snap_b = vb.snapshot or {}
    all_keys = set(snap_a.keys()) | set(snap_b.keys())
    for key in all_keys:
        val_a = snap_a.get(key)
        val_b = snap_b.get(key)
        if val_a != val_b:
            diff[key] = {"version_a": val_a, "version_b": val_b}

    return {
        "bom_item_id": item_id,
        "version_a": version_a,
        "version_b": version_b,
        "differences": diff,
        "changed_fields": list(diff.keys()),
    }


# AI BOM Validation
@router.get("/{item_id}/validate")
def validate_bom(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(BOMItem).filter(BOMItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="BOM item not found")
    return ai_service.validate_bom_consistency(item, db)
