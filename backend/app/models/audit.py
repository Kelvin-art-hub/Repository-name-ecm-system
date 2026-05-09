from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(100))
    entity_id = Column(Integer)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    username = Column(String(100))
    details = Column(Text)
    old_values = Column(JSON)
    new_values = Column(JSON)
    ip_address = Column(String(50), default="127.0.0.1")
    user_agent = Column(String(500))
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    user_rel = relationship("User", back_populates="audit_logs", foreign_keys=[user_id])
