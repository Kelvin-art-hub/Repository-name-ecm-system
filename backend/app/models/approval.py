from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Approval(Base):
    __tablename__ = "approvals"

    id = Column(Integer, primary_key=True, index=True)
    ecr_id = Column(Integer, ForeignKey("ecrs.id"), nullable=False)
    stage = Column(String(100), nullable=False)
    stage_order = Column(Integer, default=1)
    approver = Column(String(255))
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(50), default="Pending")  # Pending, Approved, Rejected, Skipped
    comments = Column(Text)
    approved_at = Column(DateTime)
    due_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    ecr = relationship("ECR", back_populates="approvals")
    approver_user = relationship("User", foreign_keys=[approver_id])
