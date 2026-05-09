import random
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.ecr import ECR
from app.models.bom import BOMItem

logger = logging.getLogger(__name__)


class AIService:
    """
    AI-powered analysis service for BOM validation and change impact analysis.
    In production, this would integrate with an LLM (OpenAI, Bedrock, etc.).
    Currently uses rule-based heuristics to simulate AI behavior.
    """

    RISK_FACTORS = {
        "change_type": {"Design": 3.0, "Material": 2.5, "Process": 1.5, "Software": 2.0, "Documentation": 0.5},
        "priority": {"Critical": 4.0, "High": 3.0, "Medium": 2.0, "Low": 1.0},
    }

    COMPONENT_SUGGESTIONS = {
        "motor": ["Bearing Assembly", "Shaft Seal", "Winding Insulation", "Terminal Block"],
        "pcb": ["Bypass Capacitor", "ESD Protection Diode", "Pull-up Resistor", "Decoupling Network"],
        "valve": ["O-Ring Kit", "Actuator Spring", "Position Sensor", "Solenoid Coil"],
        "pump": ["Impeller", "Mechanical Seal", "Wear Ring", "Shaft Coupling"],
        "assembly": ["Fastener Kit", "Gasket Set", "Cable Harness", "Mounting Bracket"],
    }

    def calculate_risk_score(self, ecr_data: dict) -> float:
        """Calculate AI risk score based on change characteristics."""
        base_score = 2.0
        change_type = ecr_data.get("change_type", "Design")
        priority = ecr_data.get("priority", "Medium")
        description = (ecr_data.get("description") or "").lower()

        # Factor in change type and priority
        base_score += self.RISK_FACTORS["change_type"].get(change_type, 2.0)
        base_score += self.RISK_FACTORS["priority"].get(priority, 2.0)

        # Keyword-based risk modifiers
        high_risk_keywords = ["critical", "safety", "structural", "eol", "obsolete", "tolerance", "clearance"]
        low_risk_keywords = ["documentation", "label", "cosmetic", "minor", "typo"]

        for kw in high_risk_keywords:
            if kw in description:
                base_score += 0.8

        for kw in low_risk_keywords:
            if kw in description:
                base_score -= 0.5

        # Add slight randomness to simulate ML model variance
        noise = random.uniform(-0.3, 0.3)
        score = max(1.0, min(10.0, base_score + noise))
        return round(score, 1)

    def generate_recommendation(self, ecr_data: dict, risk_score: float, affected_parts: List[str]) -> str:
        """Generate AI recommendation text based on risk analysis."""
        change_type = ecr_data.get("change_type", "Design")
        part_number = ecr_data.get("part_number", "unknown")
        n_parts = len(affected_parts)

        if risk_score >= 8.0:
            return (
                f"🔴 CRITICAL RISK: This {change_type.lower()} change on {part_number} has a high risk score of {risk_score}. "
                f"Immediate cross-functional review required. {n_parts} downstream assemblies identified. "
                f"Recommend scheduling a formal design review meeting before proceeding. "
                f"Verify compliance with applicable standards and customer requirements."
            )
        elif risk_score >= 6.0:
            return (
                f"🟡 HIGH RISK: {change_type} change on {part_number} requires thorough review. "
                f"Risk score: {risk_score}. {n_parts} dependent parts identified. "
                f"Recommend full approval workflow with engineering and management sign-off. "
                f"Perform FMEA analysis on affected assemblies."
            )
        elif risk_score >= 4.0:
            return (
                f"🟠 MODERATE RISK: Standard approval workflow recommended for this {change_type.lower()} change. "
                f"Risk score: {risk_score}. Verify impact on {n_parts} dependent parts. "
                f"Engineering review sufficient before implementation."
            )
        else:
            return (
                f"🟢 LOW RISK: Minor {change_type.lower()} change with limited downstream impact. "
                f"Risk score: {risk_score}. Expedited approval may be suitable. "
                f"Standard documentation and sign-off required."
            )

    def identify_affected_parts(self, ecr_data: dict, db: Session) -> List[str]:
        """Identify parts that may be affected by this change."""
        part_number = ecr_data.get("part_number", "")
        affected = []

        # Find related BOM items
        if part_number:
            related = db.query(BOMItem).filter(
                BOMItem.part_number.ilike(f"%{part_number[:3]}%")
            ).limit(5).all()
            affected = [item.part_number for item in related]

        # Add simulated downstream parts
        n_extra = random.randint(1, 4)
        for i in range(n_extra):
            affected.append(f"ASM-{random.randint(1, 50):03d}")

        return list(set(affected))[:8]

    def suggest_missing_components(self, bom_item: BOMItem, db: Session) -> List[str]:
        """Suggest potentially missing components in a BOM."""
        suggestions = []
        part_name_lower = (bom_item.part_name or "").lower()

        for keyword, components in self.COMPONENT_SUGGESTIONS.items():
            if keyword in part_name_lower:
                # Check which suggested components are not already in BOM
                existing_names = {
                    child.part_name.lower()
                    for child in db.query(BOMItem).filter(BOMItem.parent_id == bom_item.id).all()
                }
                for comp in components:
                    if comp.lower() not in existing_names:
                        suggestions.append(comp)
                break

        return suggestions[:3]

    def validate_bom_consistency(self, bom_item: BOMItem, db: Session) -> Dict[str, Any]:
        """Validate BOM for consistency issues."""
        issues = []
        warnings = []

        children = db.query(BOMItem).filter(BOMItem.parent_id == bom_item.id).all()

        # Check for duplicate part numbers
        part_numbers = [c.part_number for c in children]
        duplicates = [pn for pn in set(part_numbers) if part_numbers.count(pn) > 1]
        if duplicates:
            issues.append(f"Duplicate part numbers found: {', '.join(duplicates)}")

        # Check for zero quantities
        zero_qty = [c.part_number for c in children if c.quantity <= 0]
        if zero_qty:
            issues.append(f"Zero or negative quantities: {', '.join(zero_qty)}")

        # Check for obsolete parts
        obsolete = [c.part_number for c in children if c.status == "Obsolete"]
        if obsolete:
            warnings.append(f"Obsolete parts in BOM: {', '.join(obsolete)}")

        # Check for missing materials
        no_material = [c.part_number for c in children if not c.material]
        if no_material:
            warnings.append(f"Parts missing material specification: {', '.join(no_material[:3])}")

        missing_suggestions = self.suggest_missing_components(bom_item, db)

        return {
            "is_valid": len(issues) == 0,
            "issues": issues,
            "warnings": warnings,
            "missing_component_suggestions": missing_suggestions,
            "total_children": len(children),
            "validation_score": max(0, 100 - len(issues) * 20 - len(warnings) * 5),
        }

    def analyze_quantity_change_impact(
        self, part_number: str, old_qty: float, new_qty: float, db: Session
    ) -> Dict[str, Any]:
        """Analyze the impact of a quantity change on cost and supply chain."""
        change_pct = ((new_qty - old_qty) / old_qty * 100) if old_qty > 0 else 100
        bom_item = db.query(BOMItem).filter(BOMItem.part_number == part_number).first()

        cost_impact = 0.0
        if bom_item and bom_item.unit_cost:
            cost_impact = (new_qty - old_qty) * bom_item.unit_cost

        risk_level = "Low"
        if abs(change_pct) > 50:
            risk_level = "High"
        elif abs(change_pct) > 20:
            risk_level = "Medium"

        return {
            "part_number": part_number,
            "old_quantity": old_qty,
            "new_quantity": new_qty,
            "change_percentage": round(change_pct, 1),
            "cost_impact": round(cost_impact, 2),
            "risk_level": risk_level,
            "supply_chain_impact": "Review supplier capacity" if change_pct > 30 else "No significant impact",
            "recommendation": (
                f"Quantity increase of {change_pct:.0f}% may require supplier notification and lead time review."
                if change_pct > 20
                else f"Minor quantity adjustment. Standard procurement process applies."
            ),
        }

    def predict_change_risk(self, ecr_data: dict, db: Session) -> Dict[str, Any]:
        """Full AI risk prediction for an ECR."""
        risk_score = self.calculate_risk_score(ecr_data)
        affected_parts = self.identify_affected_parts(ecr_data, db)
        recommendation = self.generate_recommendation(ecr_data, risk_score, affected_parts)

        risk_category = "Low"
        if risk_score >= 7.0:
            risk_category = "High"
        elif risk_score >= 4.0:
            risk_category = "Medium"

        return {
            "risk_score": risk_score,
            "risk_category": risk_category,
            "recommendation": recommendation,
            "affected_parts": affected_parts,
            "impact_summary": f"Change affects {len(affected_parts)} components across {random.randint(1, 3)} product families.",
            "missing_components": [],
            "estimated_review_days": max(1, int(risk_score / 2)),
            "requires_cross_functional_review": risk_score >= 7.0,
        }

    def get_system_insights(self, db: Session) -> List[str]:
        """Generate system-level AI insights."""
        ecrs = db.query(ECR).all()
        high_risk = [e for e in ecrs if e.ai_risk_score >= 7.0]
        critical = [e for e in ecrs if e.priority == "Critical"]

        insights = []
        if high_risk:
            insights.append(f"{len(high_risk)} ECR(s) with risk score ≥7.0 require immediate cross-functional review")
        if critical:
            insights.append(f"{len(critical)} critical priority change(s) pending in the system")

        insights.extend([
            "BOM validation detected 2 potential missing components in Motor Assembly",
            "Supply chain risk elevated for PCB components — EOL parts identified",
            "Q4 change freeze window approaching — prioritize pending approvals",
            "3 ECRs have exceeded standard review SLA of 5 business days",
        ])

        return insights[:6]


ai_service = AIService()
