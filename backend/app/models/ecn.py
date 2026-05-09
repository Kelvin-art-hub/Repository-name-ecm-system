from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class ECN(Base):
    __tablename__ = "ecns"

    id = Column(Integer, primary_key=True, index=True)
    ecn_number = Column(String(50), unique=True, index=True, nullable=False)
    ecr_id = Column(Integer, ForeignKey("ecrs.id"), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="Draft")
    # Statuses: Draft, Engineering Review, Manager Approval, Released, Obsolete

    release_stage = Column(String(100), default="Engineering Review")
    approved_by = Column(String(255))
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    release_date = Column(DateTime)
    effective_date = Column(DateTime)

    # Change details
    affected_bom_items = Column(JSON, default=list)
    change_summary = Column(Text)
    implementation_notes = Column(Text)
    revision_level = Column(String(10), default="A")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    ecr = relationship("ECR", back_populates="ecns")
    approver = relationship("User", foreign_keys=[approved_by_id])
