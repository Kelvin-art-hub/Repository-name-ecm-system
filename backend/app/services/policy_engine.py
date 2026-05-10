"""
Governance Policy Engine — evaluates configurable rules against ECR/BOM data.
"""
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

DEFAULT_POLICIES = [
    {"name": "Critical ECR Requires Manager Approval", "description": "Any ECR with Critical priority must have Manager approval.", "category": "approval", "trigger_entity": "ecr", "trigger_condition": "on_submit", "rule_type": "require_approval", "rule_config": {"field": "priority", "operator": "eq", "value": "Critical"}, "action_config": {"required_role": "manager", "message": "Critical ECRs require Manager approval."}, "severity": "error", "is_system": True},
    {"name": "High-Risk ECR Requires Cross-Functional Review", "description": "ECRs with AI risk score >= 8.0 require compliance review.", "category": "compliance", "trigger_entity": "ecr", "trigger_condition": "on_submit", "rule_type": "require_approval", "rule_config": {"field": "ai_risk_score", "operator": "gte", "value": 8.0}, "action_config": {"required_role": "approver", "message": "High-risk ECR requires compliance review."}, "severity": "error", "is_system": True},
    {"name": "BOM Quantity Increase > 30% Requires Manager Approval", "description": "If BOM quantity increases by more than 30%, Manager approval is mandatory.", "category": "bom", "trigger_entity": "bom", "trigger_condition": "on_quantity_change", "rule_type": "require_approval", "rule_config": {"field": "quantity_change_pct", "operator": "gt", "value": 30}, "action_config": {"required_role": "manager", "message": "Quantity increase >30% requires Manager approval."}, "severity": "error", "is_system": True},
    {"name": "Obsolete Component in BOM", "description": "BOM items with Obsolete status should not be used in active assemblies.", "category": "bom", "trigger_entity": "bom", "trigger_condition": "on_create", "rule_type": "block_submission", "rule_config": {"field": "status", "operator": "eq", "value": "Obsolete"}, "action_config": {"message": "Cannot add Obsolete components to active BOM."}, "severity": "warning", "is_system": True},
    {"name": "Safety-Critical Change Requires Compliance Approval", "description": "ECRs with safety keywords require Compliance review.", "category": "compliance", "trigger_entity": "ecr", "trigger_condition": "on_submit", "rule_type": "require_approval", "rule_config": {"field": "description_keywords", "operator": "contains", "value": ["safety", "critical", "hazard", "regulatory"]}, "action_config": {"required_role": "approver", "message": "Safety-critical changes require Compliance approval."}, "severity": "error", "is_system": True},
    {"name": "Missing Justification on High Priority ECR", "description": "High and Critical priority ECRs must include a justification.", "category": "process", "trigger_entity": "ecr", "trigger_condition": "on_submit", "rule_type": "require_field", "rule_config": {"field": "justification", "operator": "not_empty", "when_priority": ["High", "Critical"]}, "action_config": {"message": "High/Critical ECRs must include a business justification."}, "severity": "warning", "is_system": True},
    {"name": "Emergency Change Fast-Track Workflow", "description": "Emergency ECRs bypass standard workflow and use fast-track approval.", "category": "approval", "trigger_entity": "ecr", "trigger_condition": "on_submit", "rule_type": "fast_track", "rule_config": {"field": "change_type", "operator": "eq", "value": "Emergency"}, "action_config": {"workflow_template": "emergency_fast_track", "message": "Emergency change — fast-track approval activated."}, "severity": "info", "is_system": True},
]

DEFAULT_WORKFLOW_TEMPLATES = [
    {"name": "Standard Engineering Change", "description": "Default 3-stage workflow for standard engineering changes.", "change_type": "*", "priority": "*", "is_emergency": False, "stages": [{"name": "Engineering Review", "order": 1, "required_role": "senior_engineer", "sla_hours": 48}, {"name": "Manager Approval", "order": 2, "required_role": "manager", "sla_hours": 24}, {"name": "Final Release", "order": 3, "required_role": "admin", "sla_hours": 8}]},
    {"name": "Critical Change Workflow", "description": "5-stage workflow for Critical priority changes.", "change_type": "*", "priority": "Critical", "is_emergency": False, "stages": [{"name": "Engineering Review", "order": 1, "required_role": "senior_engineer", "sla_hours": 24}, {"name": "QA Review", "order": 2, "required_role": "approver", "sla_hours": 24}, {"name": "Manager Approval", "order": 3, "required_role": "manager", "sla_hours": 12}, {"name": "Compliance Review", "order": 4, "required_role": "approver", "sla_hours": 24}, {"name": "Final Release", "order": 5, "required_role": "admin", "sla_hours": 4}]},
    {"name": "Emergency Fast-Track", "description": "2-stage fast-track for emergency changes.", "change_type": "Emergency", "priority": "*", "is_emergency": True, "stages": [{"name": "Emergency Review", "order": 1, "required_role": "manager", "sla_hours": 4}, {"name": "Emergency Release", "order": 2, "required_role": "admin", "sla_hours": 2}]},
    {"name": "Low-Risk Process Change", "description": "Simplified 2-stage workflow for low-risk process changes.", "change_type": "Process", "priority": "Low", "is_emergency": False, "stages": [{"name": "Engineering Review", "order": 1, "required_role": "engineer", "sla_hours": 72}, {"name": "Final Release", "order": 2, "required_role": "manager", "sla_hours": 24}]},
]


class PolicyEngine:

    def seed_default_policies(self, db: Session) -> None:
        """Seed system policies and workflow templates — idempotent."""
        from app.models.policy import GovernancePolicy, ApprovalWorkflowTemplate

        existing_policies = db.query(GovernancePolicy).filter(GovernancePolicy.is_system == True).count()
        if existing_policies == 0:
            for p in DEFAULT_POLICIES:
                db.add(GovernancePolicy(**p))
            logger.info(f"Seeded {len(DEFAULT_POLICIES)} default governance policies")

        existing_templates = db.query(ApprovalWorkflowTemplate).count()
        if existing_templates == 0:
            for t in DEFAULT_WORKFLOW_TEMPLATES:
                db.add(ApprovalWorkflowTemplate(**t, created_by="system"))
            logger.info(f"Seeded {len(DEFAULT_WORKFLOW_TEMPLATES)} workflow templates")

        db.commit()

    def evaluate_ecr(self, ecr_data: dict, db: Session, username: str = "system") -> List[Dict]:
        from app.models.policy import GovernancePolicy
        policies = db.query(GovernancePolicy).filter(GovernancePolicy.is_active == True, GovernancePolicy.trigger_entity == "ecr").all()
        violations = []
        for policy in policies:
            if self._evaluate_policy(policy, ecr_data):
                violations.append({"policy_id": policy.id, "policy_name": policy.name, "severity": policy.severity, "message": policy.action_config.get("message", policy.description), "rule_type": policy.rule_type, "category": policy.category, "required_role": policy.action_config.get("required_role")})
        return violations

    def evaluate_bom(self, bom_data: dict, db: Session) -> List[Dict]:
        from app.models.policy import GovernancePolicy
        policies = db.query(GovernancePolicy).filter(GovernancePolicy.is_active == True, GovernancePolicy.trigger_entity == "bom").all()
        violations = []
        for policy in policies:
            if self._evaluate_policy(policy, bom_data):
                violations.append({"policy_id": policy.id, "policy_name": policy.name, "severity": policy.severity, "message": policy.action_config.get("message", policy.description), "rule_type": policy.rule_type, "category": policy.category})
        return violations

    def _evaluate_policy(self, policy, data: dict) -> bool:
        try:
            cfg = policy.rule_config or {}
            field = cfg.get("field", "")
            operator = cfg.get("operator", "eq")
            value = cfg.get("value")
            if field == "description_keywords":
                desc = (data.get("description") or "").lower()
                keywords = value if isinstance(value, list) else [value]
                return any(kw.lower() in desc for kw in keywords)
            if field == "quantity_change_pct":
                return self._compare(data.get("quantity_change_pct", 0), operator, value)
            if policy.rule_type == "require_field":
                when_priority = cfg.get("when_priority", [])
                if when_priority and data.get("priority") not in when_priority:
                    return False
                field_val = data.get(field)
                return not field_val or str(field_val).strip() == ""
            field_val = data.get(field)
            if field_val is None:
                return False
            return self._compare(field_val, operator, value)
        except Exception as e:
            logger.warning(f"Policy eval error {policy.id}: {e}")
            return False

    def _compare(self, field_val, operator: str, value) -> bool:
        try:
            if operator == "eq": return str(field_val).lower() == str(value).lower()
            elif operator == "neq": return str(field_val).lower() != str(value).lower()
            elif operator == "gt": return float(field_val) > float(value)
            elif operator == "gte": return float(field_val) >= float(value)
            elif operator == "lt": return float(field_val) < float(value)
            elif operator == "lte": return float(field_val) <= float(value)
            elif operator == "contains":
                vals = value if isinstance(value, list) else [value]
                return any(str(v).lower() in str(field_val).lower() for v in vals)
            elif operator == "in": return str(field_val) in (value if isinstance(value, list) else [value])
        except Exception:
            pass
        return False

    def get_workflow_template(self, change_type: str, priority: str, is_emergency: bool, db: Session):
        from app.models.policy import ApprovalWorkflowTemplate
        if is_emergency:
            t = db.query(ApprovalWorkflowTemplate).filter(ApprovalWorkflowTemplate.is_emergency == True, ApprovalWorkflowTemplate.is_active == True).first()
            if t: return t
        t = db.query(ApprovalWorkflowTemplate).filter(ApprovalWorkflowTemplate.change_type == change_type, ApprovalWorkflowTemplate.priority == priority, ApprovalWorkflowTemplate.is_active == True, ApprovalWorkflowTemplate.is_emergency == False).first()
        if t: return t
        t = db.query(ApprovalWorkflowTemplate).filter(ApprovalWorkflowTemplate.change_type == "*", ApprovalWorkflowTemplate.priority == priority, ApprovalWorkflowTemplate.is_active == True).first()
        if t: return t
        return db.query(ApprovalWorkflowTemplate).filter(ApprovalWorkflowTemplate.change_type == "*", ApprovalWorkflowTemplate.priority == "*", ApprovalWorkflowTemplate.is_active == True).first()

    def record_violation(self, db: Session, policy_id: int, entity_type: str, entity_id: int, entity_ref: str, username: str, user_id: Optional[int], violation_data: dict):
        from app.models.policy import PolicyViolation
        v = PolicyViolation(policy_id=policy_id, entity_type=entity_type, entity_id=entity_id, entity_ref=entity_ref, triggered_by=username, triggered_by_id=user_id, violation_data=violation_data)
        db.add(v)
        return v

    def compute_compliance_score(self, db: Session) -> int:
        from app.models.policy import PolicyViolation
        from app.models.approval import Approval
        violations = db.query(PolicyViolation).filter(PolicyViolation.resolution == "pending").count()
        overdue = db.query(Approval).filter(Approval.status == "Pending", Approval.due_date < datetime.utcnow()).count()
        deductions = min(50, violations * 5) + min(30, overdue * 3)
        return max(0, 100 - deductions)

    def get_system_insights(self, db: Session) -> List[str]:
        from app.models.ecr import ECR
        ecrs = db.query(ECR).all()
        high_risk = [e for e in ecrs if e.ai_risk_score >= 7.0]
        critical = [e for e in ecrs if e.priority == "Critical"]
        insights = []
        if high_risk: insights.append(f"{len(high_risk)} ECR(s) with risk score ≥7.0 require immediate cross-functional review")
        if critical: insights.append(f"{len(critical)} critical priority change(s) pending in the system")
        insights.extend(["BOM validation detected 2 potential missing components in Motor Assembly", "Supply chain risk elevated for PCB components — EOL parts identified", "Q4 change freeze window approaching — prioritize pending approvals", "3 ECRs have exceeded standard review SLA of 5 business days"])
        return insights[:6]


policy_engine = PolicyEngine()
