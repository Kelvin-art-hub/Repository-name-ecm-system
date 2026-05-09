from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class ECR(Base):
    __tablename__ = "ecrs"

    id = Column(Integer, primary_key=True, index=True)
    ecr_number = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(500), nullable=False)
    product_name = Column(String(255))
    part_number = Column(String(100), index=True)
    change_type = Column(String(50))  # Design, Material, Process, Software, Documentation
    priority = Column(String(20), default="Medium")  # Low, Medium, High, Critical
    description = Column(Text)
    justification = Column(Text)
    requested_by = Column(String(255))
    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_to = Column(String(255))
    status = Column(String(50), default="Open")
    # Statuses: Open, In Review, Pending Approval, Approved, Rejected, Closed, On Hold

    # AI Analysis
    ai_risk_score = Column(Float, default=0.0)
    ai_recommendation = Column(Text)
    ai_affected_parts = Column(JSON, default=list)
    ai_impact_summary = Column(Text)
    ai_missing_components = Column(JSON, default=list)

    # Metadata
    target_release_date = Column(DateTime)
    implementation_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    approvals = relationship("Approval", back_populates="ecr", cascade="all, delete-orphan")
    ecns = relationship("ECN", back_populates="ecr")
    requester = relationship("User", foreign_keys=[requested_by_id])
