from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.ecr import ECR
from app.models.ecn import ECN
from app.models.bom import BOMItem
from app.models.approval import Approval
from app.models.audit import AuditLog
from app.models.user import User
from app.services.auth import get_current_user
from app.services.ai_service import ai_service

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # KPIs
    open_ecrs = db.query(ECR).filter(ECR.status == "Open").count()
    pending_approvals = db.query(Approval).filter(Approval.status == "Pending").count()
    active_bom = db.query(BOMItem).filter(BOMItem.status == "Active").count()
    total_ecns = db.query(ECN).count()
    total_users = db.query(User).filter(User.is_active == True).count()
    audit_count = db.query(AuditLog).count()

    # High risk ECRs
    high_risk = db.query(ECR).filter(ECR.ai_risk_score >= 7.0).all()
    risk_alerts = [
        {"ecr_number": e.ecr_number, "title": e.title, "score": e.ai_risk_score, "priority": e.priority}
        for e in high_risk
    ]

    # ECR status distribution
    ecr_by_status = {}
    for e in db.query(ECR).all():
        ecr_by_status[e.status] = ecr_by_status.get(e.status, 0) + 1

    # ECR priority distribution
    ecr_by_priority = {}
    for e in db.query(ECR).all():
        ecr_by_priority[e.priority] = ecr_by_priority.get(e.priority, 0) + 1

    # ECR change type distribution
    ecr_by_type = {}
    for e in db.query(ECR).all():
        ecr_by_type[e.change_type] = ecr_by_type.get(e.change_type, 0) + 1

    # Recent audit logs
    recent_logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(10).all()
    logs_data = [
        {
            "id": l.id,
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "username": l.username,
            "details": l.details,
            "timestamp": l.timestamp.isoformat(),
        }
        for l in recent_logs
    ]

    # Latest ECRs
    latest_ecrs = db.query(ECR).order_by(ECR.created_at.desc()).limit(5).all()
    ecrs_data = [
        {
            "id": e.id,
            "ecr_number": e.ecr_number,
            "title": e.title,
            "priority": e.priority,
            "status": e.status,
            "ai_risk_score": e.ai_risk_score,
            "requested_by": e.requested_by,
            "created_at": e.created_at.isoformat(),
        }
        for e in latest_ecrs
    ]

    # Pending approvals detail
    pending = db.query(Approval).filter(Approval.status == "Pending").limit(5).all()
    pending_data = []
    for a in pending:
        ecr = db.query(ECR).filter(ECR.id == a.ecr_id).first()
        pending_data.append({
            "id": a.id,
            "ecr_number": ecr.ecr_number if ecr else "",
            "ecr_title": ecr.title if ecr else "",
            "stage": a.stage,
            "priority": ecr.priority if ecr else "",
            "approver": a.approver,
        })

    return {
        "kpis": {
            "open_ecrs": open_ecrs,
            "pending_approvals": pending_approvals,
            "active_bom_items": active_bom,
            "total_ecns": total_ecns,
            "total_users": total_users,
            "audit_logs_count": audit_count,
            "ai_risk_alerts": len(high_risk),
        },
        "risk_alerts": risk_alerts,
        "ecr_by_status": ecr_by_status,
        "ecr_by_priority": ecr_by_priority,
        "ecr_by_type": ecr_by_type,
        "recent_logs": logs_data,
        "latest_ecrs": ecrs_data,
        "pending_approvals_detail": pending_data,
    }


@router.get("/ai-analysis")
def get_ai_analysis(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    all_ecrs = db.query(ECR).all()
    avg_risk = sum(e.ai_risk_score for e in all_ecrs) / len(all_ecrs) if all_ecrs else 0

    risk_dist = {
        "low": len([e for e in all_ecrs if e.ai_risk_score < 4]),
        "medium": len([e for e in all_ecrs if 4 <= e.ai_risk_score < 7]),
        "high": len([e for e in all_ecrs if e.ai_risk_score >= 7]),
    }

    high_risk = sorted(
        [e for e in all_ecrs if e.ai_risk_score >= 7.0],
        key=lambda x: x.ai_risk_score,
        reverse=True,
    )

    top_risks = [
        {
            "ecr_number": e.ecr_number,
            "title": e.title,
            "risk_score": e.ai_risk_score,
            "recommendation": e.ai_recommendation,
            "affected_parts": e.ai_affected_parts or [],
        }
        for e in high_risk[:5]
    ]

    insights = ai_service.get_system_insights(db)

    return {
        "avg_risk_score": round(avg_risk, 1),
        "high_risk_count": len(high_risk),
        "risk_distribution": risk_dist,
        "top_risks": top_risks,
        "insights": insights,
    }
