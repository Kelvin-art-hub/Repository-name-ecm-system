from sqlalchemy.orm import Session
from app.models.audit import AuditLog
from typing import Optional, Any
import logging

logger = logging.getLogger(__name__)


def log_action(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    username: str = "system",
    user_id: Optional[int] = None,
    details: Optional[str] = None,
    old_values: Optional[Any] = None,
    new_values: Optional[Any] = None,
    ip_address: str = "127.0.0.1",
    commit: bool = False,
) -> AuditLog:
    """Create an audit log entry."""
    log = AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        username=username,
        user_id=user_id,
        details=details,
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address,
    )
    db.add(log)
    if commit:
        try:
            db.commit()
            db.refresh(log)
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to commit audit log: {e}")
    return log
