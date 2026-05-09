from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.ecr import ECR
from app.models.approval import Approval
from app.models.user import User
from app.schemas.ecr import ECRCreate, ECRUpdate, ECRResponse, ECRListResponse
from app.services.auth import get_current_user, can_create_ecr, read_only_check
from app.services.audit_service import log_action
from app.services.ai_service import ai_service
from app.services.kafka_service import kafka_service

router = APIRouter(prefix="/api/ecrs", tags=["ECR Management"])

APPROVAL_STAGES = [
    ("Engineering Review", 1),
    ("Manager Approval", 2),
    ("Final Release", 3),
]


def ecr_to_dict(ecr: ECR) -> dict:
    return {
        "id": ecr.id,
        "ecr_number": ecr.ecr_number,
        "title": ecr.title,
        "product_name": ecr.product_name,
        "part_number": ecr.part_number,
        "change_type": ecr.change_type,
        "priority": ecr.priority,
        "status": ecr.status,
        "requested_by": ecr.requested_by,
    }


@router.get("", response_model=List[ECRListResponse])
def list_ecrs(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    change_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(ECR)
    if status:
        query = query.filter(ECR.status == status)
    if priority:
        query = query.filter(ECR.priority == priority)
    if change_type:
        query = query.filter(ECR.change_type == change_type)
    if search:
        query = query.filter(
            ECR.title.ilike(f"%{search}%") |
            ECR.ecr_number.ilike(f"%{search}%") |
            ECR.part_number.ilike(f"%{search}%")
        )
    return query.order_by(ECR.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{ecr_id}", response_model=ECRResponse)
def get_ecr(ecr_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ecr = db.query(ECR).filter(ECR.id == ecr_id).first()
    if not ecr:
        raise HTTPException(status_code=404, detail="ECR not found")
    return ecr


@router.post("", response_model=ECRResponse, status_code=status.HTTP_201_CREATED)
def create_ecr(
    ecr_data: ECRCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(can_create_ecr),   # engineers + managers only
):
    # Generate ECR number
    count = db.query(ECR).count()
    ecr_number = f"ECR-{datetime.now().year}-{count + 1:04d}"

    # AI analysis
    ai_result = ai_service.predict_change_risk(ecr_data.model_dump(), db)

    ecr = ECR(
        ecr_number=ecr_number,
        title=ecr_data.title,
        product_name=ecr_data.product_name,
        part_number=ecr_data.part_number,
        change_type=ecr_data.change_type,
        priority=ecr_data.priority,
        description=ecr_data.description,
        justification=ecr_data.justification,
        requested_by=ecr_data.requested_by or current_user.full_name,
        requested_by_id=current_user.id,
        assigned_to=ecr_data.assigned_to,
        target_release_date=ecr_data.target_release_date,
        ai_risk_score=ai_result["risk_score"],
        ai_recommendation=ai_result["recommendation"],
        ai_affected_parts=ai_result["affected_parts"],
        ai_impact_summary=ai_result["impact_summary"],
        ai_missing_components=ai_result["missing_components"],
    )
    db.add(ecr)
    db.flush()

    # Create approval workflow stages
    for stage_name, stage_order in APPROVAL_STAGES:
        db.add(Approval(
            ecr_id=ecr.id,
            stage=stage_name,
            stage_order=stage_order,
            approver="Pending Assignment",
        ))

    db.commit()
    db.refresh(ecr)

    # Audit + Kafka
    log_action(db, "CREATE", "ECR", ecr.id, username=current_user.username,
               user_id=current_user.id, details=f"Created {ecr_number}",
               ip_address=request.client.host if request.client else "unknown", commit=True)
    kafka_service.publish_ecr_created(ecr_to_dict(ecr))

    return ecr


@router.put("/{ecr_id}", response_model=ECRResponse)
def update_ecr(
    ecr_id: int,
    ecr_data: ECRUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ecr = db.query(ECR).filter(ECR.id == ecr_id).first()
    if not ecr:
        raise HTTPException(status_code=404, detail="ECR not found")

    if ecr.status in ("Approved", "Closed") and current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Cannot edit an approved or closed ECR")

    old_status = ecr.status
    update_data = ecr_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(ecr, field, value)
    ecr.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(ecr)

    log_action(db, "UPDATE", "ECR", ecr_id, username=current_user.username,
               user_id=current_user.id, details=f"Updated {ecr.ecr_number}",
               old_values={"status": old_status}, new_values=update_data,
               ip_address=request.client.host if request.client else "unknown", commit=True)

    if "status" in update_data and update_data["status"] != old_status:
        kafka_service.publish_ecr_status_changed(ecr_to_dict(ecr), old_status, update_data["status"])

    return ecr


@router.post("/{ecr_id}/submit")
def submit_ecr(
    ecr_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ecr = db.query(ECR).filter(ECR.id == ecr_id).first()
    if not ecr:
        raise HTTPException(status_code=404, detail="ECR not found")
    if ecr.status != "Open":
        raise HTTPException(status_code=400, detail=f"ECR is already in status: {ecr.status}")

    ecr.status = "Pending Approval"
    ecr.updated_at = datetime.utcnow()
    db.commit()

    log_action(db, "SUBMIT", "ECR", ecr_id, username=current_user.username,
               user_id=current_user.id, details=f"Submitted {ecr.ecr_number} for approval", commit=True)
    kafka_service.publish_ecr_status_changed(ecr_to_dict(ecr), "Open", "Pending Approval")

    return {"message": "ECR submitted for approval", "status": "Pending Approval"}


@router.delete("/{ecr_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ecr(
    ecr_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(read_only_check),  # viewers blocked
):
    ecr = db.query(ECR).filter(ECR.id == ecr_id).first()
    if not ecr:
        raise HTTPException(status_code=404, detail="ECR not found")
    if ecr.status in ("Approved", "Closed") and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Cannot delete an approved or closed ECR")

    db.delete(ecr)
    db.commit()
    log_action(db, "DELETE", "ECR", ecr_id, username=current_user.username,
               user_id=current_user.id, details=f"Deleted ECR {ecr.ecr_number}", commit=True)
