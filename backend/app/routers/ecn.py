from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.ecn import ECN
from app.models.ecr import ECR
from app.models.user import User
from app.schemas.ecn import ECNCreate, ECNUpdate, ECNResponse
from app.services.auth import get_current_user, read_only_check, can_approve
from app.services.audit_service import log_action
from app.services.kafka_service import kafka_service

router = APIRouter(prefix="/api/ecns", tags=["ECN Workflow"])


def ecn_to_dict(ecn: ECN) -> dict:
    return {
        "id": ecn.id,
        "ecn_number": ecn.ecn_number,
        "ecr_id": ecn.ecr_id,
        "title": ecn.title,
        "status": ecn.status,
    }


@router.get("", response_model=List[ECNResponse])
def list_ecns(
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(ECN)
    if status:
        query = query.filter(ECN.status == status)
    return query.order_by(ECN.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{ecn_id}", response_model=ECNResponse)
def get_ecn(ecn_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ecn = db.query(ECN).filter(ECN.id == ecn_id).first()
    if not ecn:
        raise HTTPException(status_code=404, detail="ECN not found")
    return ecn


@router.post("", response_model=ECNResponse, status_code=status.HTTP_201_CREATED)
def create_ecn(
    ecn_data: ECNCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(read_only_check),   # viewers blocked
):
    ecr = db.query(ECR).filter(ECR.id == ecn_data.ecr_id).first()
    if not ecr:
        raise HTTPException(status_code=404, detail="ECR not found")

    count = db.query(ECN).count()
    ecn_number = f"ECN-{datetime.now().year}-{count + 1:04d}"

    ecn = ECN(
        ecn_number=ecn_number,
        ecr_id=ecn_data.ecr_id,
        title=ecn_data.title,
        description=ecn_data.description,
        change_summary=ecn_data.change_summary,
        implementation_notes=ecn_data.implementation_notes,
        effective_date=ecn_data.effective_date,
    )
    db.add(ecn)
    db.commit()
    db.refresh(ecn)

    log_action(db, "CREATE", "ECN", ecn.id, username=current_user.username,
               user_id=current_user.id, details=f"Created {ecn_number} from {ecr.ecr_number}", commit=True)
    kafka_service.publish_ecn_generated(ecn_to_dict(ecn))

    return ecn


@router.post("/generate-from-ecr/{ecr_id}", response_model=ECNResponse, status_code=status.HTTP_201_CREATED)
def generate_ecn_from_ecr(
    ecr_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(can_approve),   # only approvers/managers can generate ECN
):
    """Auto-generate an ECN from an approved ECR."""
    ecr = db.query(ECR).filter(ECR.id == ecr_id).first()
    if not ecr:
        raise HTTPException(status_code=404, detail="ECR not found")
    if ecr.status != "Approved":
        raise HTTPException(status_code=400, detail="ECN can only be generated from an Approved ECR")

    # Check if ECN already exists for this ECR
    existing = db.query(ECN).filter(ECN.ecr_id == ecr_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"ECN {existing.ecn_number} already exists for this ECR")

    count = db.query(ECN).count()
    ecn_number = f"ECN-{datetime.now().year}-{count + 1:04d}"

    ecn = ECN(
        ecn_number=ecn_number,
        ecr_id=ecr_id,
        title=f"ECN: {ecr.title}",
        description=ecr.description,
        change_summary=f"Auto-generated from {ecr.ecr_number}. {ecr.description or ''}",
        affected_bom_items=ecr.ai_affected_parts or [],
        approved_by=current_user.full_name,
        approved_by_id=current_user.id,
    )
    db.add(ecn)

    # Update ECR status
    ecr.status = "Closed"
    ecr.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(ecn)

    log_action(db, "GENERATE_ECN", "ECN", ecn.id, username=current_user.username,
               user_id=current_user.id, details=f"Auto-generated {ecn_number} from {ecr.ecr_number}", commit=True)
    kafka_service.publish_ecn_generated(ecn_to_dict(ecn))

    return ecn


@router.put("/{ecn_id}", response_model=ECNResponse)
def update_ecn(
    ecn_id: int,
    ecn_data: ECNUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(read_only_check),   # viewers blocked
):
    ecn = db.query(ECN).filter(ECN.id == ecn_id).first()
    if not ecn:
        raise HTTPException(status_code=404, detail="ECN not found")

    update_data = ecn_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(ecn, field, value)
    ecn.updated_at = datetime.utcnow()

    if "status" in update_data and update_data["status"] == "Released":
        ecn.release_date = datetime.utcnow()
        ecn.approved_by = current_user.full_name
        kafka_service.publish_ecn_released(ecn_to_dict(ecn))

    db.commit()
    db.refresh(ecn)

    log_action(db, "UPDATE", "ECN", ecn_id, username=current_user.username,
               user_id=current_user.id, details=f"Updated {ecn.ecn_number}", commit=True)
    return ecn
