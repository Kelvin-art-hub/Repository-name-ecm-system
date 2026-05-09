from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.approval import Approval
from app.models.ecr import ECR
from app.models.ecn import ECN
from app.models.user import User
from app.schemas.approval import ApprovalAction, ApprovalResponse
from app.services.auth import get_current_user, can_approve
from app.services.audit_service import log_action
from app.services.kafka_service import kafka_service

router = APIRouter(prefix="/api/approvals", tags=["Approval Workflow"])


@router.get("", response_model=List[dict])
def list_approvals(
    status: Optional[str] = Query(None),
    ecr_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Approval)
    if status:
        query = query.filter(Approval.status == status)
    if ecr_id:
        query = query.filter(Approval.ecr_id == ecr_id)

    approvals = query.order_by(Approval.created_at.desc()).all()
    result = []
    for a in approvals:
        ecr = db.query(ECR).filter(ECR.id == a.ecr_id).first()
        result.append({
            "id": a.id,
            "ecr_id": a.ecr_id,
            "ecr_number": ecr.ecr_number if ecr else "",
            "ecr_title": ecr.title if ecr else "",
            "priority": ecr.priority if ecr else "",
            "ai_risk_score": ecr.ai_risk_score if ecr else 0,
            "stage": a.stage,
            "stage_order": a.stage_order,
            "approver": a.approver,
            "status": a.status,
            "comments": a.comments,
            "approved_at": a.approved_at.isoformat() if a.approved_at else None,
            "due_date": a.due_date.isoformat() if a.due_date else None,
            "created_at": a.created_at.isoformat(),
        })
    return result


@router.get("/{approval_id}", response_model=dict)
def get_approval(
    approval_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    a = db.query(Approval).filter(Approval.id == approval_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Approval not found")
    ecr = db.query(ECR).filter(ECR.id == a.ecr_id).first()
    return {
        "id": a.id,
        "ecr_id": a.ecr_id,
        "ecr_number": ecr.ecr_number if ecr else "",
        "ecr_title": ecr.title if ecr else "",
        "stage": a.stage,
        "approver": a.approver,
        "status": a.status,
        "comments": a.comments,
        "approved_at": a.approved_at.isoformat() if a.approved_at else None,
        "created_at": a.created_at.isoformat(),
    }


@router.post("/{approval_id}/action")
def process_approval(
    approval_id: int,
    action: ApprovalAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(can_approve),   # approvers + managers only
):
    if action.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")

    approval = db.query(Approval).filter(Approval.id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    if approval.status != "Pending":
        raise HTTPException(status_code=400, detail=f"Approval is already {approval.status}")

    approval.status = "Approved" if action.action == "approve" else "Rejected"
    approval.comments = action.comments
    approval.approved_at = datetime.utcnow()
    approval.approver = current_user.full_name

    ecr = db.query(ECR).filter(ECR.id == approval.ecr_id).first()

    if action.action == "approve":
        # Check if all stages are approved
        all_approvals = db.query(Approval).filter(Approval.ecr_id == approval.ecr_id).all()
        all_approved = all(
            a.status == "Approved" for a in all_approvals
            if a.id != approval_id
        )
        if all_approved and ecr:
            ecr.status = "Approved"
            ecr.updated_at = datetime.utcnow()
            kafka_service.publish_ecr_approved({
                "id": ecr.id, "ecr_number": ecr.ecr_number, "title": ecr.title
            })
    else:
        if ecr:
            ecr.status = "Rejected"
            ecr.updated_at = datetime.utcnow()
            kafka_service.publish_ecr_rejected({
                "id": ecr.id, "ecr_number": ecr.ecr_number, "title": ecr.title
            })

    db.commit()

    log_action(
        db, action.action.upper(), "Approval", approval_id,
        username=current_user.username, user_id=current_user.id,
        details=f"{action.action.capitalize()} approval for ECR {ecr.ecr_number if ecr else approval.ecr_id} - Stage: {approval.stage}. Comments: {action.comments}",
        commit=True,
    )

    return {
        "message": f"Approval {action.action}d successfully",
        "status": approval.status,
        "ecr_status": ecr.status if ecr else None,
    }


@router.put("/{approval_id}/assign")
def assign_approver(
    approval_id: int,
    approver_username: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    approval = db.query(Approval).filter(Approval.id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")

    user = db.query(User).filter(User.username == approver_username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    approval.approver = user.full_name
    approval.approver_id = user.id
    db.commit()

    log_action(db, "ASSIGN", "Approval", approval_id, username=current_user.username,
               user_id=current_user.id, details=f"Assigned approver {user.full_name}", commit=True)
    return {"message": f"Approver assigned: {user.full_name}"}
