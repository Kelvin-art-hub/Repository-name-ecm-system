"""Governance System API — policies, workflow templates, compliance, KPIs."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Any
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.database import get_db
from app.models.policy import GovernancePolicy, PolicyViolation, ApprovalWorkflowTemplate
from app.models.ecr import ECR
from app.models.approval import Approval
from app.models.audit import AuditLog
from app.models.user import User
from app.models.bom import BOMItem
from app.services.auth import get_current_user, require_roles, read_only_check
from app.services.audit_service import log_action
from app.services.policy_engine import policy_engine

router = APIRouter(prefix="/api/governance", tags=["Governance"])


class PolicyCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: str = "compliance"
    trigger_entity: str = "ecr"
    trigger_condition: str = "on_submit"
    rule_type: str = "require_approval"
    rule_config: Optional[Any] = {}
    action_config: Optional[Any] = {}
    severity: str = "warning"
    is_active: bool = True


class PolicyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    rule_config: Optional[Any] = None
    action_config: Optional[Any] = None
    severity: Optional[str] = None
    is_active: Optional[bool] = None


class WorkflowTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    change_type: str = "*"
    priority: str = "*"
    is_emergency: bool = False
    stages: List[Any] = []


class PolicyValidateRequest(BaseModel):
    entity_type: str
    entity_data: Any


class ViolationResolveRequest(BaseModel):
    resolution: str
    resolution_note: Optional[str] = None


# ── Governance Dashboard ─────────────────────────────────────────
@router.get("/dashboard")
def governance_dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    now = datetime.utcnow()
    total_ecrs = db.query(ECR).count()
    pending_approvals = db.query(Approval).filter(Approval.status == "Pending").count()
    overdue_approvals = db.query(Approval).filter(Approval.status == "Pending", Approval.due_date < now).count()
    rejected_ecrs = db.query(ECR).filter(ECR.status == "Rejected").count()
    approved_ecrs = db.query(ECR).filter(ECR.status == "Approved").count()
    high_risk_ecrs = db.query(ECR).filter(ECR.ai_risk_score >= 7.0).count()
    open_violations = db.query(PolicyViolation).filter(PolicyViolation.resolution == "pending").count()
    total_violations = db.query(PolicyViolation).count()
    compliance_score = policy_engine.compute_compliance_score(db)

    recent_approved = db.query(Approval).filter(Approval.status == "Approved", Approval.approved_at >= now - timedelta(days=30), Approval.approved_at != None).all()
    avg_approval_hours = 0
    if recent_approved:
        total_hours = sum((a.approved_at - a.created_at).total_seconds() / 3600 for a in recent_approved if a.approved_at and a.created_at)
        avg_approval_hours = round(total_hours / len(recent_approved), 1)

    ecr_trend = []
    for i in range(6, -1, -1):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day.replace(hour=23, minute=59, second=59)
        count = db.query(ECR).filter(ECR.created_at >= day_start, ECR.created_at <= day_end).count()
        ecr_trend.append({"date": day_start.strftime("%b %d"), "count": count})

    stage_counts: dict = {}
    for a in db.query(Approval).filter(Approval.status == "Pending").all():
        stage_counts[a.stage] = stage_counts.get(a.stage, 0) + 1
    bottlenecks = [{"stage": s, "count": c} for s, c in sorted(stage_counts.items(), key=lambda x: x[1], reverse=True)[:5]]

    recent_violations = db.query(PolicyViolation).order_by(PolicyViolation.created_at.desc()).limit(5).all()
    violations_data = [{"id": v.id, "policy_name": v.policy.name if v.policy else "Unknown", "entity_type": v.entity_type, "entity_ref": v.entity_ref, "severity": v.policy.severity if v.policy else "warning", "triggered_by": v.triggered_by, "resolution": v.resolution, "created_at": v.created_at.isoformat()} for v in recent_violations]

    overdue_list = db.query(Approval).filter(Approval.status == "Pending", Approval.due_date < now).limit(5).all()
    overdue_data = []
    for a in overdue_list:
        ecr = db.query(ECR).filter(ECR.id == a.ecr_id).first()
        hours_overdue = round((now - a.due_date).total_seconds() / 3600, 1) if a.due_date else 0
        overdue_data.append({"approval_id": a.id, "ecr_number": ecr.ecr_number if ecr else "", "ecr_title": ecr.title if ecr else "", "stage": a.stage, "approver": a.approver, "hours_overdue": hours_overdue})

    failed_logins = db.query(AuditLog).filter(AuditLog.action == "LOGIN_FAILED", AuditLog.timestamp >= now - timedelta(hours=24)).count()

    return {
        "kpis": {"compliance_score": compliance_score, "total_ecrs": total_ecrs, "pending_approvals": pending_approvals, "overdue_approvals": overdue_approvals, "open_violations": open_violations, "high_risk_ecrs": high_risk_ecrs, "rejected_ecrs": rejected_ecrs, "approved_ecrs": approved_ecrs, "avg_approval_hours": avg_approval_hours, "failed_logins_24h": failed_logins},
        "ecr_trend": ecr_trend,
        "approval_bottlenecks": bottlenecks,
        "recent_violations": violations_data,
        "overdue_approvals_detail": overdue_data,
        "compliance_breakdown": {"score": compliance_score, "open_violations": open_violations, "total_violations": total_violations, "overdue_approvals": overdue_approvals, "status": "critical" if compliance_score < 60 else "warning" if compliance_score < 80 else "good"},
    }


# ── Policies ─────────────────────────────────────────────────────
@router.get("/policies")
def list_policies(category: Optional[str] = Query(None), is_active: Optional[bool] = Query(None), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(GovernancePolicy)
    if category: query = query.filter(GovernancePolicy.category == category)
    if is_active is not None: query = query.filter(GovernancePolicy.is_active == is_active)
    policies = query.order_by(GovernancePolicy.category, GovernancePolicy.name).all()
    return [{"id": p.id, "name": p.name, "description": p.description, "category": p.category, "trigger_entity": p.trigger_entity, "trigger_condition": p.trigger_condition, "rule_type": p.rule_type, "rule_config": p.rule_config, "action_config": p.action_config, "severity": p.severity, "is_active": p.is_active, "is_system": p.is_system, "created_by": p.created_by, "created_at": p.created_at.isoformat()} for p in policies]


@router.post("/policies", status_code=status.HTTP_201_CREATED)
def create_policy(data: PolicyCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin", "manager"))):
    policy = GovernancePolicy(**data.model_dump(), created_by=current_user.username, created_by_id=current_user.id)
    db.add(policy); db.commit(); db.refresh(policy)
    log_action(db, "CREATE", "GovernancePolicy", policy.id, username=current_user.username, user_id=current_user.id, details=f"Created policy: {policy.name}", commit=True)
    return {"id": policy.id, "name": policy.name}


@router.put("/policies/{policy_id}")
def update_policy(policy_id: int, data: PolicyUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin", "manager"))):
    policy = db.query(GovernancePolicy).filter(GovernancePolicy.id == policy_id).first()
    if not policy: raise HTTPException(status_code=404, detail="Policy not found")
    if policy.is_system and current_user.role != "admin": raise HTTPException(status_code=403, detail="System policies can only be modified by Admin")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(policy, field, value)
    policy.updated_at = datetime.utcnow(); db.commit()
    log_action(db, "UPDATE", "GovernancePolicy", policy_id, username=current_user.username, user_id=current_user.id, details=f"Updated policy: {policy.name}", commit=True)
    return {"message": "Policy updated"}


@router.delete("/policies/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_policy(policy_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin"))):
    policy = db.query(GovernancePolicy).filter(GovernancePolicy.id == policy_id).first()
    if not policy: raise HTTPException(status_code=404, detail="Policy not found")
    if policy.is_system: raise HTTPException(status_code=403, detail="System policies cannot be deleted")
    db.delete(policy); db.commit()


@router.post("/policies/validate")
def validate_against_policies(req: PolicyValidateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if req.entity_type == "ecr": violations = policy_engine.evaluate_ecr(req.entity_data, db, current_user.username)
    elif req.entity_type == "bom": violations = policy_engine.evaluate_bom(req.entity_data, db)
    else: raise HTTPException(status_code=400, detail="entity_type must be 'ecr' or 'bom'")
    has_blockers = any(v["severity"] == "error" for v in violations)
    return {"violations": violations, "has_blockers": has_blockers, "can_proceed": not has_blockers, "total": len(violations)}


# ── Violations ───────────────────────────────────────────────────
@router.get("/violations")
def list_violations(resolution: Optional[str] = Query(None), entity_type: Optional[str] = Query(None), skip: int = Query(0, ge=0), limit: int = Query(50, le=200), db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin", "manager", "approver"))):
    query = db.query(PolicyViolation)
    if resolution: query = query.filter(PolicyViolation.resolution == resolution)
    if entity_type: query = query.filter(PolicyViolation.entity_type == entity_type)
    violations = query.order_by(PolicyViolation.created_at.desc()).offset(skip).limit(limit).all()
    return [{"id": v.id, "policy_id": v.policy_id, "policy_name": v.policy.name if v.policy else "Unknown", "policy_severity": v.policy.severity if v.policy else "warning", "entity_type": v.entity_type, "entity_id": v.entity_id, "entity_ref": v.entity_ref, "triggered_by": v.triggered_by, "resolution": v.resolution, "resolution_note": v.resolution_note, "resolved_by": v.resolved_by, "resolved_at": v.resolved_at.isoformat() if v.resolved_at else None, "created_at": v.created_at.isoformat()} for v in violations]


@router.post("/violations/{violation_id}/resolve")
def resolve_violation(violation_id: int, req: ViolationResolveRequest, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin", "manager"))):
    v = db.query(PolicyViolation).filter(PolicyViolation.id == violation_id).first()
    if not v: raise HTTPException(status_code=404, detail="Violation not found")
    v.resolution = req.resolution; v.resolution_note = req.resolution_note; v.resolved_by = current_user.username; v.resolved_at = datetime.utcnow()
    db.commit()
    log_action(db, "RESOLVE_VIOLATION", "PolicyViolation", violation_id, username=current_user.username, user_id=current_user.id, details=f"Resolved as '{req.resolution}'", commit=True)
    return {"message": f"Violation marked as {req.resolution}"}


# ── Workflow Templates ───────────────────────────────────────────
@router.get("/workflow-templates")
def list_workflow_templates(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    templates = db.query(ApprovalWorkflowTemplate).order_by(ApprovalWorkflowTemplate.name).all()
    return [{"id": t.id, "name": t.name, "description": t.description, "change_type": t.change_type, "priority": t.priority, "is_emergency": t.is_emergency, "is_active": t.is_active, "stages": t.stages, "stage_count": len(t.stages) if t.stages else 0, "created_at": t.created_at.isoformat()} for t in templates]


@router.post("/workflow-templates", status_code=status.HTTP_201_CREATED)
def create_workflow_template(data: WorkflowTemplateCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin", "manager"))):
    template = ApprovalWorkflowTemplate(**data.model_dump(), created_by=current_user.username)
    db.add(template); db.commit(); db.refresh(template)
    log_action(db, "CREATE", "WorkflowTemplate", template.id, username=current_user.username, user_id=current_user.id, details=f"Created template: {template.name}", commit=True)
    return {"id": template.id, "name": template.name}


@router.put("/workflow-templates/{template_id}")
def update_workflow_template(template_id: int, data: WorkflowTemplateCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin", "manager"))):
    t = db.query(ApprovalWorkflowTemplate).filter(ApprovalWorkflowTemplate.id == template_id).first()
    if not t: raise HTTPException(status_code=404, detail="Template not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(t, field, value)
    t.updated_at = datetime.utcnow(); db.commit()
    return {"message": "Template updated"}


# ── Compliance Report ────────────────────────────────────────────
@router.get("/compliance-report")
def compliance_report(days: int = Query(30, ge=1, le=365), db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin", "manager"))):
    since = datetime.utcnow() - timedelta(days=days)
    ecrs = db.query(ECR).filter(ECR.created_at >= since).all()
    approvals = db.query(Approval).filter(Approval.created_at >= since).all()
    violations = db.query(PolicyViolation).filter(PolicyViolation.created_at >= since).all()
    total = len(ecrs)
    approved = len([e for e in ecrs if e.status == "Approved"])
    rejected = len([e for e in ecrs if e.status == "Rejected"])
    pending = len([e for e in ecrs if e.status in ("Pending Approval", "In Review")])
    approval_rate = round(approved / total * 100, 1) if total > 0 else 0
    rejection_rate = round(rejected / total * 100, 1) if total > 0 else 0
    sla_met = sum(1 for a in approvals if a.status == "Approved" and a.due_date and a.approved_at and a.approved_at <= a.due_date)
    sla_missed = sum(1 for a in approvals if a.status == "Approved" and a.due_date and a.approved_at and a.approved_at > a.due_date)
    sla_rate = round(sla_met / (sla_met + sla_missed) * 100, 1) if (sla_met + sla_missed) > 0 else 100
    violation_by_category: dict = {}
    for v in violations:
        cat = v.policy.category if v.policy else "unknown"
        violation_by_category[cat] = violation_by_category.get(cat, 0) + 1
    ecr_by_type: dict = {}
    for e in ecrs:
        ecr_by_type[e.change_type] = ecr_by_type.get(e.change_type, 0) + 1
    high_risk = [e for e in ecrs if e.ai_risk_score >= 7.0]
    return {"period_days": days, "generated_at": datetime.utcnow().isoformat(), "summary": {"total_ecrs": total, "approved": approved, "rejected": rejected, "pending": pending, "approval_rate_pct": approval_rate, "rejection_rate_pct": rejection_rate, "sla_compliance_pct": sla_rate, "total_violations": len(violations), "open_violations": len([v for v in violations if v.resolution == "pending"]), "high_risk_ecrs": len(high_risk), "compliance_score": policy_engine.compute_compliance_score(db)}, "ecr_by_type": ecr_by_type, "violations_by_category": violation_by_category, "high_risk_ecrs": [{"ecr_number": e.ecr_number, "title": e.title, "risk_score": e.ai_risk_score, "status": e.status} for e in sorted(high_risk, key=lambda x: x.ai_risk_score, reverse=True)[:10]]}


# ── User Management ──────────────────────────────────────────────
@router.get("/users")
def list_users_governance(db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin", "manager"))):
    users = db.query(User).all()
    result = []
    for u in users:
        last_audit = db.query(AuditLog).filter(AuditLog.user_id == u.id).order_by(AuditLog.timestamp.desc()).first()
        result.append({"id": u.id, "username": u.username, "full_name": u.full_name, "email": u.email, "role": u.role, "department": u.department, "is_active": u.is_active, "last_login": u.last_login.isoformat() if u.last_login else None, "created_at": u.created_at.isoformat(), "last_action": last_audit.action if last_audit else None, "last_action_at": last_audit.timestamp.isoformat() if last_audit else None})
    return result


@router.put("/users/{user_id}/role")
def change_user_role(user_id: int, new_role: str, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin"))):
    valid_roles = ["admin", "manager", "senior_engineer", "approver", "engineer", "viewer"]
    if new_role not in valid_roles: raise HTTPException(status_code=400, detail=f"Invalid role")
    user = db.query(User).filter(User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id: raise HTTPException(status_code=400, detail="Cannot change your own role")
    old_role = user.role; user.role = new_role; user.updated_at = datetime.utcnow(); db.commit()
    log_action(db, "ROLE_CHANGE", "User", user_id, username=current_user.username, user_id=current_user.id, details=f"Changed {user.username} role from {old_role} to {new_role}", old_values={"role": old_role}, new_values={"role": new_role}, commit=True)
    return {"message": f"Role changed to {new_role}", "username": user.username}


@router.put("/users/{user_id}/toggle-active")
def toggle_user_active(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin"))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id: raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    user.is_active = not user.is_active; user.updated_at = datetime.utcnow(); db.commit()
    action = "ACTIVATE" if user.is_active else "DEACTIVATE"
    log_action(db, action, "User", user_id, username=current_user.username, user_id=current_user.id, details=f"{action} user {user.username}", commit=True)
    return {"message": f"User {'activated' if user.is_active else 'deactivated'}", "is_active": user.is_active}


@router.post("/users/create")
def create_user_admin(data: dict, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin"))):
    from app.services.auth import get_password_hash
    if db.query(User).filter(User.username == data.get("username")).first(): raise HTTPException(status_code=400, detail="Username already exists")
    if db.query(User).filter(User.email == data.get("email")).first(): raise HTTPException(status_code=400, detail="Email already registered")
    user = User(username=data["username"], email=data["email"], full_name=data["full_name"], password_hash=get_password_hash(data.get("password", "changeme123")), role=data.get("role", "engineer"), department=data.get("department"), phone=data.get("phone"), is_active=True)
    db.add(user); db.commit(); db.refresh(user)
    log_action(db, "CREATE_USER", "User", user.id, username=current_user.username, user_id=current_user.id, details=f"Admin created user {user.username}", commit=True)
    return {"id": user.id, "username": user.username, "role": user.role}


# ── Audit Trail ──────────────────────────────────────────────────
@router.get("/audit-trail")
def governance_audit_trail(action: Optional[str] = Query(None), entity_type: Optional[str] = Query(None), username: Optional[str] = Query(None), date_from: Optional[str] = Query(None), date_to: Optional[str] = Query(None), skip: int = Query(0, ge=0), limit: int = Query(100, le=500), db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin", "manager", "approver", "senior_engineer", "engineer"))):
    query = db.query(AuditLog)
    if action: query = query.filter(AuditLog.action == action.upper())
    if entity_type: query = query.filter(AuditLog.entity_type == entity_type)
    if username: query = query.filter(AuditLog.username.ilike(f"%{username}%"))
    if date_from:
        try: query = query.filter(AuditLog.timestamp >= datetime.fromisoformat(date_from))
        except ValueError: pass
    if date_to:
        try: query = query.filter(AuditLog.timestamp <= datetime.fromisoformat(date_to))
        except ValueError: pass
    total = query.count()
    logs = query.order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit).all()
    return {"total": total, "logs": [{"id": l.id, "action": l.action, "entity_type": l.entity_type, "entity_id": l.entity_id, "username": l.username, "details": l.details, "old_values": l.old_values, "new_values": l.new_values, "ip_address": l.ip_address, "timestamp": l.timestamp.isoformat()} for l in logs]}
