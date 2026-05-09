from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/audit-logs", tags=["Audit Logs"])


@router.get("", response_model=List[AuditLogResponse])
def list_audit_logs(
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    username: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action.upper())
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if username:
        query = query.filter(AuditLog.username.ilike(f"%{username}%"))
    return query.order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit).all()


@router.get("/stats")
def audit_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logs = db.query(AuditLog).all()
    action_counts = {}
    user_counts = {}
    entity_counts = {}

    for log in logs:
        action_counts[log.action] = action_counts.get(log.action, 0) + 1
        if log.username:
            user_counts[log.username] = user_counts.get(log.username, 0) + 1
        if log.entity_type:
            entity_counts[log.entity_type] = entity_counts.get(log.entity_type, 0) + 1

    return {
        "total_logs": len(logs),
        "action_distribution": action_counts,
        "top_users": sorted(user_counts.items(), key=lambda x: x[1], reverse=True)[:10],
        "entity_distribution": entity_counts,
    }
