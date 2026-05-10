from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class GovernancePolicy(Base):
    __tablename__ = "governance_policies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    trigger_entity = Column(String(50))
    trigger_condition = Column(String(100))
    rule_type = Column(String(100))
    rule_config = Column(JSON)
    action_config = Column(JSON)
    severity = Column(String(20), default="warning")
    is_active = Column(Boolean, default=True)
    is_system = Column(Boolean, default=False)
    created_by = Column(String(100))
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    creator = relationship("User", foreign_keys=[created_by_id])
    violations = relationship("PolicyViolation", back_populates="policy", cascade="all, delete-orphan")


class PolicyViolation(Base):
    __tablename__ = "policy_violations"

    id = Column(Integer, primary_key=True, index=True)
    policy_id = Column(Integer, ForeignKey("governance_policies.id"), nullable=False)
    entity_type = Column(String(50))
    entity_id = Column(Integer)
    entity_ref = Column(String(100))
    triggered_by = Column(String(100))
    triggered_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    violation_data = Column(JSON)
    resolution = Column(String(50), default="pending")
    resolution_note = Column(Text)
    resolved_by = Column(String(100))
    resolved_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    policy = relationship("GovernancePolicy", back_populates="violations")
    triggerer = relationship("User", foreign_keys=[triggered_by_id])


class ApprovalWorkflowTemplate(Base):
    __tablename__ = "approval_workflow_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    change_type = Column(String(50))
    priority = Column(String(20))
    is_emergency = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    stages = Column(JSON)
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GovernanceKPI(Base):
    __tablename__ = "governance_kpis"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_date = Column(DateTime, default=datetime.utcnow, index=True)
    total_ecrs = Column(Integer, default=0)
    approved_ecrs = Column(Integer, default=0)
    rejected_ecrs = Column(Integer, default=0)
    pending_approvals = Column(Integer, default=0)
    overdue_approvals = Column(Integer, default=0)
    policy_violations = Column(Integer, default=0)
    avg_approval_hours = Column(Integer, default=0)
    high_risk_ecrs = Column(Integer, default=0)
    compliance_score = Column(Integer, default=100)
    extra_data = Column(JSON)
