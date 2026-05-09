"""Seed the database with realistic demo data."""
import hashlib
import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.ecr import ECR
from app.models.ecn import ECN
from app.models.bom import BOMItem, BOMVersion
from app.models.approval import Approval
from app.models.audit import AuditLog
from app.services.auth import get_password_hash
import logging

logger = logging.getLogger(__name__)


def seed_database(db: Session):
    if db.query(User).count() > 0:
        logger.info("Database already seeded, skipping.")
        return

    logger.info("Seeding database with demo data...")

    # --- Users ---
    users = [
        User(username="admin", email="admin@ecm.com", full_name="System Administrator",
             password_hash=get_password_hash("admin123"), role="admin", department="IT", is_active=True),
        User(username="john.doe", email="john.doe@ecm.com", full_name="John Doe",
             password_hash=get_password_hash("john123"), role="senior_engineer", department="Engineering", is_active=True),
        User(username="jane.smith", email="jane.smith@ecm.com", full_name="Jane Smith",
             password_hash=get_password_hash("jane123"), role="manager", department="Management", is_active=True),
        User(username="mike.johnson", email="mike.j@ecm.com", full_name="Mike Johnson",
             password_hash=get_password_hash("mike123"), role="engineer", department="Engineering", is_active=True),
        User(username="alice.brown", email="alice.b@ecm.com", full_name="Alice Brown",
             password_hash=get_password_hash("alice123"), role="approver", department="Quality", is_active=True),
        User(username="bob.wilson", email="bob.w@ecm.com", full_name="Bob Wilson",
             password_hash=get_password_hash("bob123"), role="viewer", department="Procurement", is_active=True),
    ]
    for u in users:
        db.add(u)
    db.flush()

    # --- ECRs ---
    ecr_data = [
        dict(ecr_number="ECR-2024-0001", title="Motor Housing Tolerance Update", product_name="Industrial Motor X200",
             part_number="MH-4421", change_type="Design", priority="High",
             description="Update tolerance from ±0.05mm to ±0.02mm for improved fit and reduced vibration.",
             requested_by="John Doe", requested_by_id=users[1].id, status="Open",
             ai_risk_score=7.2, ai_recommendation="🟡 HIGH RISK: Design change on MH-4421 requires thorough review. Risk score: 7.2. 4 dependent parts identified.",
             ai_affected_parts=["ASM-001", "ASM-002", "ASM-007", "RTR-001"],
             ai_impact_summary="Change affects 4 components across 2 product families."),
        dict(ecr_number="ECR-2024-0002", title="PCB Capacitor Substitution", product_name="Control Unit CU-500",
             part_number="PCB-8872", change_type="Material", priority="Critical",
             description="Replace EOL capacitor C4 (100µF/25V) with approved alternate Murata GRM32ER61E107MA12.",
             requested_by="Jane Smith", requested_by_id=users[2].id, status="Pending Approval",
             ai_risk_score=8.9, ai_recommendation="🔴 CRITICAL RISK: Material change on PCB-8872 has a high risk score of 8.9. EOL component requires immediate action.",
             ai_affected_parts=["PCB-8872", "PCB-8873", "CU-500"],
             ai_impact_summary="Change affects 3 components across 1 product family."),
        dict(ecr_number="ECR-2024-0003", title="Coolant Hose Routing Optimization", product_name="Pump Assembly PA-100",
             part_number="CH-3301", change_type="Process", priority="Medium",
             description="Optimize coolant hose routing to reduce assembly time by 15% and improve serviceability.",
             requested_by="Mike Johnson", requested_by_id=users[3].id, status="Open",
             ai_risk_score=3.4, ai_recommendation="🟢 LOW RISK: Minor process change with limited downstream impact. Risk score: 3.4.",
             ai_affected_parts=["ASM-010"],
             ai_impact_summary="Change affects 1 component across 1 product family."),
        dict(ecr_number="ECR-2024-0004", title="Shaft Bearing Grade Upgrade", product_name="Transmission T-800",
             part_number="SB-6650", change_type="Design", priority="High",
             description="Upgrade from Grade 5 to Grade 8 bearing for improved longevity in high-load applications.",
             requested_by="Alice Brown", requested_by_id=users[4].id, status="Approved",
             ai_risk_score=5.1, ai_recommendation="🟠 MODERATE RISK: Standard approval workflow recommended. Risk score: 5.1.",
             ai_affected_parts=["TRANS-001", "TRANS-003"],
             ai_impact_summary="Change affects 2 components across 1 product family."),
        dict(ecr_number="ECR-2024-0005", title="Seal Material Change - High Temp", product_name="Valve Assembly VA-200",
             part_number="VS-9901", change_type="Material", priority="Low",
             description="Switch from NBR to EPDM seal for high temperature environments (>120°C).",
             requested_by="Bob Wilson", requested_by_id=users[5].id, status="Open",
             ai_risk_score=2.1, ai_recommendation="🟢 LOW RISK: Minor material change. Risk score: 2.1.",
             ai_affected_parts=["VA-200"],
             ai_impact_summary="Change affects 1 component."),
        dict(ecr_number="ECR-2024-0006", title="Software Firmware Update v3.2", product_name="Control Unit CU-500",
             part_number="FW-CU500", change_type="Software", priority="High",
             description="Update firmware to v3.2 to address CAN bus timing issue and add diagnostic features.",
             requested_by="John Doe", requested_by_id=users[1].id, status="In Review",
             ai_risk_score=6.5, ai_recommendation="🟡 HIGH RISK: Software change requires thorough testing. Risk score: 6.5.",
             ai_affected_parts=["CU-500", "CU-501"],
             ai_impact_summary="Change affects 2 software components."),
    ]
    ecrs = []
    for ed in ecr_data:
        ecr = ECR(**ed)
        db.add(ecr)
        ecrs.append(ecr)
    db.flush()

    # --- Approvals ---
    approval_data = [
        # ECR 1 - Open
        dict(ecr_id=ecrs[0].id, stage="Engineering Review", stage_order=1, approver="John Doe", approver_id=users[1].id, status="Approved", comments="Design verified against spec", approved_at=datetime.utcnow() - timedelta(days=2)),
        dict(ecr_id=ecrs[0].id, stage="Manager Approval", stage_order=2, approver="Jane Smith", approver_id=users[2].id, status="Pending"),
        dict(ecr_id=ecrs[0].id, stage="Final Release", stage_order=3, approver="Pending Assignment", status="Pending"),
        # ECR 2 - Pending Approval
        dict(ecr_id=ecrs[1].id, stage="Engineering Review", stage_order=1, approver="John Doe", approver_id=users[1].id, status="Pending"),
        dict(ecr_id=ecrs[1].id, stage="Manager Approval", stage_order=2, approver="Jane Smith", approver_id=users[2].id, status="Pending"),
        dict(ecr_id=ecrs[1].id, stage="Final Release", stage_order=3, approver="Pending Assignment", status="Pending"),
        # ECR 3 - Open
        dict(ecr_id=ecrs[2].id, stage="Engineering Review", stage_order=1, approver="Pending Assignment", status="Pending"),
        dict(ecr_id=ecrs[2].id, stage="Manager Approval", stage_order=2, approver="Pending Assignment", status="Pending"),
        dict(ecr_id=ecrs[2].id, stage="Final Release", stage_order=3, approver="Pending Assignment", status="Pending"),
        # ECR 4 - Approved
        dict(ecr_id=ecrs[3].id, stage="Engineering Review", stage_order=1, approver="John Doe", approver_id=users[1].id, status="Approved", comments="Bearing specs verified", approved_at=datetime.utcnow() - timedelta(days=5)),
        dict(ecr_id=ecrs[3].id, stage="Manager Approval", stage_order=2, approver="Jane Smith", approver_id=users[2].id, status="Approved", comments="Approved for production", approved_at=datetime.utcnow() - timedelta(days=3)),
        dict(ecr_id=ecrs[3].id, stage="Final Release", stage_order=3, approver="Alice Brown", approver_id=users[4].id, status="Approved", comments="Released to production", approved_at=datetime.utcnow() - timedelta(days=1)),
    ]
    for ad in approval_data:
        db.add(Approval(**ad))

    # --- ECN from approved ECR ---
    ecn = ECN(
        ecn_number="ECN-2024-0001",
        ecr_id=ecrs[3].id,
        title="ECN: Shaft Bearing Grade Upgrade",
        description="Engineering Change Notice for bearing grade upgrade from Grade 5 to Grade 8.",
        status="Released",
        release_stage="Released",
        approved_by="Jane Smith",
        approved_by_id=users[2].id,
        release_date=datetime.utcnow() - timedelta(days=1),
        effective_date=datetime.utcnow() + timedelta(days=7),
        affected_bom_items=["TRANS-001", "TRANS-003"],
        change_summary="Bearing grade upgrade for improved longevity.",
        revision_level="B",
    )
    db.add(ecn)

    # --- BOM Items ---
    # Root products
    motor = BOMItem(part_number="PROD-001", part_name="Industrial Motor X200", revision="C",
                    parent_id=None, quantity=1, unit="EA", material="Steel/Aluminum",
                    product_family="Motors", status="Active", version=3,
                    manufacturer="MotorCo", unit_cost=1250.00, lead_time_days=14)
    control = BOMItem(part_number="PROD-002", part_name="Control Unit CU-500", revision="B",
                      parent_id=None, quantity=1, unit="EA", material="PCB/Plastic",
                      product_family="Electronics", status="Active", version=2,
                      manufacturer="ElectroCo", unit_cost=450.00, lead_time_days=21)
    pump = BOMItem(part_number="PROD-003", part_name="Pump Assembly PA-100", revision="A",
                   parent_id=None, quantity=1, unit="EA", material="Cast Iron/Steel",
                   product_family="Pumps", status="Active", version=1,
                   manufacturer="PumpTech", unit_cost=890.00, lead_time_days=30)
    db.add(motor); db.add(control); db.add(pump)
    db.flush()

    # Motor sub-assemblies
    housing = BOMItem(part_number="MH-4421", part_name="Motor Housing", revision="A",
                      parent_id=motor.id, quantity=1, unit="EA", material="Cast Aluminum",
                      product_family="Motors", status="Active", unit_cost=185.00, lead_time_days=10)
    rotor = BOMItem(part_number="RTR-001", part_name="Rotor Assembly", revision="B",
                    parent_id=motor.id, quantity=1, unit="EA", material="Silicon Steel",
                    product_family="Motors", status="Active", unit_cost=320.00, lead_time_days=14)
    stator = BOMItem(part_number="STR-001", part_name="Stator Assembly", revision="A",
                     parent_id=motor.id, quantity=1, unit="EA", material="Copper/Steel",
                     product_family="Motors", status="Active", unit_cost=280.00, lead_time_days=14)
    db.add(housing); db.add(rotor); db.add(stator)
    db.flush()

    # Rotor sub-components
    db.add(BOMItem(part_number="BRG-001", part_name="Front Bearing", revision="A",
                   parent_id=rotor.id, quantity=2, unit="EA", material="Steel",
                   product_family="Motors", status="Active", unit_cost=45.00, lead_time_days=7))
    db.add(BOMItem(part_number="SHF-001", part_name="Main Shaft", revision="A",
                   parent_id=rotor.id, quantity=1, unit="EA", material="Carbon Steel",
                   product_family="Motors", status="Active", unit_cost=95.00, lead_time_days=10))
    db.add(BOMItem(part_number="BRG-002", part_name="Rear Bearing", revision="A",
                   parent_id=rotor.id, quantity=2, unit="EA", material="Steel",
                   product_family="Motors", status="Active", unit_cost=45.00, lead_time_days=7))

    # Control unit sub-components
    pcb = BOMItem(part_number="PCB-8872", part_name="Main Control PCB", revision="C",
                  parent_id=control.id, quantity=1, unit="EA", material="FR4/Copper",
                  product_family="Electronics", status="Active", unit_cost=120.00, lead_time_days=21)
    db.add(pcb)
    db.flush()
    db.add(BOMItem(part_number="CAP-C4", part_name="Capacitor C4 100µF/25V", revision="A",
                   parent_id=pcb.id, quantity=4, unit="EA", material="Electrolytic",
                   product_family="Electronics", status="Obsolete", unit_cost=0.85, lead_time_days=3))
    db.add(BOMItem(part_number="MCU-001", part_name="Microcontroller STM32F4", revision="A",
                   parent_id=pcb.id, quantity=1, unit="EA", material="Silicon",
                   product_family="Electronics", status="Active", unit_cost=8.50, lead_time_days=14))

    # --- Audit Logs ---
    audit_entries = [
        dict(action="CREATE", entity_type="ECR", entity_id=ecrs[0].id, username="john.doe", user_id=users[1].id, details=f"Created ECR-2024-0001: Motor Housing Tolerance Update"),
        dict(action="CREATE", entity_type="ECR", entity_id=ecrs[1].id, username="jane.smith", user_id=users[2].id, details=f"Created ECR-2024-0002: PCB Capacitor Substitution - Critical priority"),
        dict(action="APPROVE", entity_type="Approval", entity_id=1, username="john.doe", user_id=users[1].id, details="Engineering Review approved for ECR-2024-0001"),
        dict(action="CREATE", entity_type="ECR", entity_id=ecrs[2].id, username="mike.johnson", user_id=users[3].id, details="Created ECR-2024-0003"),
        dict(action="LOGIN", entity_type="User", entity_id=users[0].id, username="admin", user_id=users[0].id, details="Admin login"),
        dict(action="APPROVE", entity_type="Approval", entity_id=10, username="john.doe", user_id=users[1].id, details="Engineering Review approved for ECR-2024-0004"),
        dict(action="APPROVE", entity_type="Approval", entity_id=11, username="jane.smith", user_id=users[2].id, details="Manager Approval approved for ECR-2024-0004"),
        dict(action="APPROVE", entity_type="Approval", entity_id=12, username="alice.brown", user_id=users[4].id, details="Final Release approved for ECR-2024-0004"),
        dict(action="GENERATE_ECN", entity_type="ECN", entity_id=1, username="jane.smith", user_id=users[2].id, details="Auto-generated ECN-2024-0001 from ECR-2024-0004"),
        dict(action="UPDATE", entity_type="ECR", entity_id=ecrs[1].id, username="jane.smith", user_id=users[2].id, details="Status changed to Pending Approval"),
    ]
    for ae in audit_entries:
        db.add(AuditLog(**ae))

    db.commit()
    logger.info("Database seeded successfully with demo data.")
