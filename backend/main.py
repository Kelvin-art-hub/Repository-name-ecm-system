from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import json, random, hashlib, os

app = FastAPI(title="ECM System API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = "sqlite:///./ecm_system.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- Models ---
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    full_name = Column(String)
    role = Column(String, default="engineer")
    email = Column(String)
    department = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class ECR(Base):
    __tablename__ = "ecrs"
    id = Column(Integer, primary_key=True, index=True)
    ecr_number = Column(String, unique=True, index=True)
    title = Column(String)
    product_name = Column(String)
    part_number = Column(String)
    change_type = Column(String)
    priority = Column(String)
    description = Column(Text)
    requested_by = Column(String)
    status = Column(String, default="Open")
    ai_risk_score = Column(Float, default=0.0)
    ai_recommendation = Column(Text)
    affected_parts = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

class ECN(Base):
    __tablename__ = "ecns"
    id = Column(Integer, primary_key=True, index=True)
    ecn_number = Column(String, unique=True, index=True)
    ecr_id = Column(Integer, ForeignKey("ecrs.id"))
    title = Column(String)
    status = Column(String, default="Draft")
    release_stage = Column(String, default="Engineering Review")
    approved_by = Column(String)
    release_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

class BOMItem(Base):
    __tablename__ = "bom_items"
    id = Column(Integer, primary_key=True, index=True)
    part_number = Column(String, index=True)
    part_name = Column(String)
    revision = Column(String, default="A")
    parent_id = Column(Integer, ForeignKey("bom_items.id"), nullable=True)
    quantity = Column(Integer, default=1)
    unit = Column(String, default="EA")
    material = Column(String)
    product_family = Column(String)
    status = Column(String, default="Active")
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

class Approval(Base):
    __tablename__ = "approvals"
    id = Column(Integer, primary_key=True, index=True)
    ecr_id = Column(Integer, ForeignKey("ecrs.id"))
    stage = Column(String)
    approver = Column(String)
    status = Column(String, default="Pending")
    comments = Column(Text)
    approved_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    action = Column(String)
    entity_type = Column(String)
    entity_id = Column(Integer)
    user = Column(String)
    details = Column(Text)
    ip_address = Column(String, default="192.168.1.1")
    timestamp = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def seed_data(db: Session):
    if db.query(User).count() > 0:
        return
    users = [
        User(username="admin", password_hash=hash_password("admin123"), full_name="System Administrator", role="admin", email="admin@ecm.com", department="IT"),
        User(username="john.doe", password_hash=hash_password("john123"), full_name="John Doe", role="senior_engineer", email="john@ecm.com", department="Engineering"),
        User(username="jane.smith", password_hash=hash_password("jane123"), full_name="Jane Smith", role="manager", email="jane@ecm.com", department="Management"),
    ]
    for u in users: db.add(u)
    
    ecr_data = [
        ECR(ecr_number="ECR-2024-001", title="Motor Housing Tolerance Update", product_name="Industrial Motor X200", part_number="MH-4421", change_type="Design", priority="High", description="Update tolerance from ±0.05mm to ±0.02mm for improved fit", requested_by="John Doe", status="Open", ai_risk_score=7.2, ai_recommendation="High downstream impact. Review 12 dependent assemblies.", affected_parts='["ASM-001","ASM-002","ASM-007"]'),
        ECR(ecr_number="ECR-2024-002", title="PCB Capacitor Substitution", product_name="Control Unit CU-500", part_number="PCB-8872", change_type="Material", priority="Critical", description="Replace EOL capacitor C4 with approved alternate", requested_by="Jane Smith", status="Pending Approval", ai_risk_score=8.9, ai_recommendation="Critical: EOL component. Immediate action required.", affected_parts='["PCB-8872","PCB-8873"]'),
        ECR(ecr_number="ECR-2024-003", title="Coolant Hose Routing Optimization", product_name="Pump Assembly PA-100", part_number="CH-3301", change_type="Process", priority="Medium", description="Optimize routing to reduce assembly time by 15%", requested_by="Mike Johnson", status="Open", ai_risk_score=3.4, ai_recommendation="Low risk. Minor process change with positive efficiency impact.", affected_parts='["ASM-010"]'),
        ECR(ecr_number="ECR-2024-004", title="Shaft Bearing Grade Upgrade", product_name="Transmission T-800", part_number="SB-6650", change_type="Design", priority="High", description="Upgrade from Grade 5 to Grade 8 bearing for longevity", requested_by="Alice Brown", status="Approved", ai_risk_score=5.1, ai_recommendation="Moderate impact. Verify clearances in 3 subassemblies.", affected_parts='["TRANS-001","TRANS-003"]'),
        ECR(ecr_number="ECR-2024-005", title="Seal Material Change - High Temp", product_name="Valve Assembly VA-200", part_number="VS-9901", change_type="Material", priority="Low", description="Switch from NBR to EPDM seal for high temperature environments", requested_by="Bob Wilson", status="Open", ai_risk_score=2.1, ai_recommendation="Low risk material change. Compatible with existing design.", affected_parts='["VA-200"]'),
    ]
    for e in ecr_data: db.add(e)
    
    bom_roots = [
        BOMItem(part_number="PROD-001", part_name="Industrial Motor X200", revision="C", parent_id=None, quantity=1, unit="EA", material="Steel/Aluminum", product_family="Motors", status="Active", version=3),
        BOMItem(part_number="PROD-002", part_name="Control Unit CU-500", revision="B", parent_id=None, quantity=1, unit="EA", material="PCB/Plastic", product_family="Electronics", status="Active", version=2),
    ]
    for b in bom_roots: db.add(b)
    db.flush()
    
    sub1 = BOMItem(part_number="MH-4421", part_name="Motor Housing", revision="A", parent_id=bom_roots[0].id, quantity=1, unit="EA", material="Cast Aluminum", product_family="Motors", status="Active")
    sub2 = BOMItem(part_number="RTR-001", part_name="Rotor Assembly", revision="B", parent_id=bom_roots[0].id, quantity=1, unit="EA", material="Silicon Steel", product_family="Motors", status="Active")
    sub3 = BOMItem(part_number="STR-001", part_name="Stator Assembly", revision="A", parent_id=bom_roots[0].id, quantity=1, unit="EA", material="Copper/Steel", product_family="Motors", status="Active")
    db.add(sub1); db.add(sub2); db.add(sub3)
    db.flush()
    db.add(BOMItem(part_number="BRG-001", part_name="Front Bearing", revision="A", parent_id=sub2.id, quantity=2, unit="EA", material="Steel", product_family="Motors", status="Active"))
    db.add(BOMItem(part_number="SHF-001", part_name="Main Shaft", revision="A", parent_id=sub2.id, quantity=1, unit="EA", material="Carbon Steel", product_family="Motors", status="Active"))
    
    approvals_data = [
        Approval(ecr_id=1, stage="Engineering Review", approver="John Doe", status="Approved", comments="Design verified", approved_at=datetime.utcnow()),
        Approval(ecr_id=1, stage="Manager Approval", approver="Jane Smith", status="Pending"),
        Approval(ecr_id=2, stage="Engineering Review", approver="John Doe", status="Pending"),
        Approval(ecr_id=4, stage="Engineering Review", approver="John Doe", status="Approved", approved_at=datetime.utcnow()),
        Approval(ecr_id=4, stage="Manager Approval", approver="Jane Smith", status="Approved", approved_at=datetime.utcnow()),
    ]
    for a in approvals_data: db.add(a)
    
    logs = [
        AuditLog(action="CREATE", entity_type="ECR", entity_id=1, user="john.doe", details="Created ECR-2024-001"),
        AuditLog(action="UPDATE", entity_type="ECR", entity_id=1, user="jane.smith", details="Status changed to Pending Approval"),
        AuditLog(action="APPROVE", entity_type="Approval", entity_id=1, user="john.doe", details="Engineering Review approved"),
        AuditLog(action="CREATE", entity_type="ECR", entity_id=2, user="jane.smith", details="Created ECR-2024-002 - Critical priority"),
        AuditLog(action="LOGIN", entity_type="User", entity_id=1, user="admin", details="Admin login from 192.168.1.100"),
        AuditLog(action="CREATE", entity_type="ECR", entity_id=3, user="john.doe", details="Created ECR-2024-003"),
        AuditLog(action="APPROVE", entity_type="Approval", entity_id=4, user="john.doe", details="ECR-2024-004 Engineering Review approved"),
        AuditLog(action="APPROVE", entity_type="Approval", entity_id=5, user="jane.smith", details="ECR-2024-004 Manager Approval approved"),
    ]
    for l in logs: db.add(l)
    db.commit()

with SessionLocal() as db:
    seed_data(db)

# --- Schemas ---
class LoginRequest(BaseModel):
    username: str
    password: str

class ECRCreate(BaseModel):
    title: str
    product_name: str
    part_number: str
    change_type: str
    priority: str
    description: str
    requested_by: str

class ApprovalAction(BaseModel):
    action: str
    comments: Optional[str] = ""

# --- Auth ---
@app.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user or user.password_hash != hash_password(req.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    db.add(AuditLog(action="LOGIN", entity_type="User", entity_id=user.id, user=user.username, details=f"Login successful"))
    db.commit()
    return {"token": f"ecm_token_{user.id}_{user.role}", "user": {"id": user.id, "username": user.username, "full_name": user.full_name, "role": user.role, "email": user.email, "department": user.department}}

# --- Dashboard ---
@app.get("/api/dashboard/stats")
def get_stats(db: Session = Depends(get_db)):
    open_ecrs = db.query(ECR).filter(ECR.status == "Open").count()
    pending = db.query(Approval).filter(Approval.status == "Pending").count()
    active_bom = db.query(BOMItem).filter(BOMItem.status == "Active").count()
    logs_count = db.query(AuditLog).count()
    high_risk = db.query(ECR).filter(ECR.ai_risk_score >= 7.0).all()
    risk_alerts = [{"ecr": e.ecr_number, "title": e.title, "score": e.ai_risk_score, "priority": e.priority} for e in high_risk]
    recent_logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(5).all()
    logs = [{"id": l.id, "action": l.action, "entity": l.entity_type, "user": l.user, "details": l.details, "time": l.timestamp.isoformat()} for l in recent_logs]
    ecr_by_status = {}
    for e in db.query(ECR).all():
        ecr_by_status[e.status] = ecr_by_status.get(e.status, 0) + 1
    return {"open_ecrs": open_ecrs, "pending_approvals": pending, "active_bom_items": active_bom, "audit_logs_count": logs_count, "ai_risk_alerts": risk_alerts, "recent_logs": logs, "ecr_by_status": ecr_by_status}

# --- ECRs ---
@app.get("/api/ecrs")
def get_ecrs(db: Session = Depends(get_db)):
    ecrs = db.query(ECR).order_by(ECR.created_at.desc()).all()
    return [{"id": e.id, "ecr_number": e.ecr_number, "title": e.title, "product_name": e.product_name, "part_number": e.part_number, "change_type": e.change_type, "priority": e.priority, "status": e.status, "requested_by": e.requested_by, "ai_risk_score": e.ai_risk_score, "ai_recommendation": e.ai_recommendation, "affected_parts": json.loads(e.affected_parts or "[]"), "created_at": e.created_at.isoformat()} for e in ecrs]

@app.get("/api/ecrs/{ecr_id}")
def get_ecr(ecr_id: int, db: Session = Depends(get_db)):
    e = db.query(ECR).filter(ECR.id == ecr_id).first()
    if not e: raise HTTPException(404, "ECR not found")
    approvals = db.query(Approval).filter(Approval.ecr_id == ecr_id).all()
    return {"id": e.id, "ecr_number": e.ecr_number, "title": e.title, "product_name": e.product_name, "part_number": e.part_number, "change_type": e.change_type, "priority": e.priority, "description": e.description, "requested_by": e.requested_by, "status": e.status, "ai_risk_score": e.ai_risk_score, "ai_recommendation": e.ai_recommendation, "affected_parts": json.loads(e.affected_parts or "[]"), "created_at": e.created_at.isoformat(), "approvals": [{"id": a.id, "stage": a.stage, "approver": a.approver, "status": a.status, "comments": a.comments, "approved_at": a.approved_at.isoformat() if a.approved_at else None} for a in approvals]}

@app.post("/api/ecrs")
def create_ecr(ecr: ECRCreate, db: Session = Depends(get_db)):
    count = db.query(ECR).count()
    ecr_num = f"ECR-{datetime.now().year}-{count+6:03d}"
    risk_score = round(random.uniform(1.5, 9.5), 1)
    affected = [f"ASM-{random.randint(1,20):03d}" for _ in range(random.randint(1,4))]
    if risk_score >= 7:
        rec = f"HIGH RISK: {ecr.change_type} change on {ecr.part_number}. Requires thorough review of {len(affected)} downstream assemblies. Schedule cross-functional review."
    elif risk_score >= 4:
        rec = f"MODERATE RISK: Verify impact on {len(affected)} dependent parts. Standard approval workflow recommended."
    else:
        rec = f"LOW RISK: Minor change with limited downstream impact. Expedited approval may be suitable."
    new_ecr = ECR(ecr_number=ecr_num, title=ecr.title, product_name=ecr.product_name, part_number=ecr.part_number, change_type=ecr.change_type, priority=ecr.priority, description=ecr.description, requested_by=ecr.requested_by, ai_risk_score=risk_score, ai_recommendation=rec, affected_parts=json.dumps(affected))
    db.add(new_ecr)
    db.flush()
    for stage in ["Engineering Review", "Manager Approval", "Final Release"]:
        db.add(Approval(ecr_id=new_ecr.id, stage=stage, approver="Pending Assignment"))
    db.add(AuditLog(action="CREATE", entity_type="ECR", entity_id=new_ecr.id, user=ecr.requested_by, details=f"Created {ecr_num}"))
    db.commit()
    return {"id": new_ecr.id, "ecr_number": ecr_num, "ai_risk_score": risk_score, "ai_recommendation": rec, "affected_parts": affected}

# --- ECNs ---
@app.get("/api/ecns")
def get_ecns(db: Session = Depends(get_db)):
    ecns = db.query(ECN).order_by(ECN.created_at.desc()).all()
    return [{"id": e.id, "ecn_number": e.ecn_number, "ecr_id": e.ecr_id, "title": e.title, "status": e.status, "release_stage": e.release_stage, "approved_by": e.approved_by, "created_at": e.created_at.isoformat()} for e in ecns]

# --- BOM ---
def bom_to_dict(item: BOMItem, db: Session):
    children = db.query(BOMItem).filter(BOMItem.parent_id == item.id).all()
    return {"id": item.id, "part_number": item.part_number, "part_name": item.part_name, "revision": item.revision, "quantity": item.quantity, "unit": item.unit, "material": item.material, "product_family": item.product_family, "status": item.status, "version": item.version, "children": [bom_to_dict(c, db) for c in children]}

@app.get("/api/bom")
def get_bom(db: Session = Depends(get_db)):
    roots = db.query(BOMItem).filter(BOMItem.parent_id == None).all()
    return [bom_to_dict(r, db) for r in roots]

# --- Approvals ---
@app.get("/api/approvals")
def get_approvals(db: Session = Depends(get_db)):
    approvals = db.query(Approval).all()
    result = []
    for a in approvals:
        ecr = db.query(ECR).filter(ECR.id == a.ecr_id).first()
        result.append({"id": a.id, "ecr_id": a.ecr_id, "ecr_number": ecr.ecr_number if ecr else "", "ecr_title": ecr.title if ecr else "", "priority": ecr.priority if ecr else "", "stage": a.stage, "approver": a.approver, "status": a.status, "comments": a.comments, "approved_at": a.approved_at.isoformat() if a.approved_at else None, "created_at": a.created_at.isoformat()})
    return result

@app.post("/api/approvals/{approval_id}/action")
def approval_action(approval_id: int, action: ApprovalAction, db: Session = Depends(get_db)):
    approval = db.query(Approval).filter(Approval.id == approval_id).first()
    if not approval: raise HTTPException(404, "Approval not found")
    approval.status = "Approved" if action.action == "approve" else "Rejected"
    approval.comments = action.comments
    approval.approved_at = datetime.utcnow()
    db.add(AuditLog(action=action.action.upper(), entity_type="Approval", entity_id=approval_id, user="current_user", details=f"{action.action} for ECR ID {approval.ecr_id}: {action.comments}"))
    db.commit()
    return {"status": approval.status}

# --- Audit Logs ---
@app.get("/api/audit-logs")
def get_audit_logs(db: Session = Depends(get_db)):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(100).all()
    return [{"id": l.id, "action": l.action, "entity_type": l.entity_type, "entity_id": l.entity_id, "user": l.user, "details": l.details, "ip_address": l.ip_address, "timestamp": l.timestamp.isoformat()} for l in logs]

# --- AI Analysis ---
@app.get("/api/ai/analysis")
def ai_analysis(db: Session = Depends(get_db)):
    high_risk_ecrs = db.query(ECR).filter(ECR.ai_risk_score >= 7.0).all()
    all_ecrs = db.query(ECR).all()
    avg_risk = sum(e.ai_risk_score for e in all_ecrs) / len(all_ecrs) if all_ecrs else 0
    return {
        "avg_risk_score": round(avg_risk, 1),
        "high_risk_count": len(high_risk_ecrs),
        "risk_distribution": {"low": len([e for e in all_ecrs if e.ai_risk_score < 4]), "medium": len([e for e in all_ecrs if 4 <= e.ai_risk_score < 7]), "high": len([e for e in all_ecrs if e.ai_risk_score >= 7])},
        "top_risks": [{"ecr_number": e.ecr_number, "title": e.title, "risk_score": e.ai_risk_score, "recommendation": e.ai_recommendation, "affected_parts": json.loads(e.affected_parts or "[]")} for e in sorted(high_risk_ecrs, key=lambda x: x.ai_risk_score, reverse=True)[:3]],
        "insights": ["2 critical ECRs require immediate cross-functional review", "EOL component on PCB-8872 poses supply chain risk", "Motor housing change impacts 3 downstream assemblies", "Q4 change freeze window approaching - 12 ECRs pending"]
    }

# --- Users ---
@app.get("/api/users")
def get_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [{"id": u.id, "username": u.username, "full_name": u.full_name, "role": u.role, "email": u.email, "department": u.department} for u in users]
