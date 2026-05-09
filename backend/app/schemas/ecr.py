from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class ECRBase(BaseModel):
    title: str
    product_name: Optional[str] = None
    part_number: Optional[str] = None
    change_type: str = "Design"
    priority: str = "Medium"
    description: Optional[str] = None
    justification: Optional[str] = None
    requested_by: Optional[str] = None
    assigned_to: Optional[str] = None
    target_release_date: Optional[datetime] = None


class ECRCreate(ECRBase):
    pass


class ECRUpdate(BaseModel):
    title: Optional[str] = None
    product_name: Optional[str] = None
    part_number: Optional[str] = None
    change_type: Optional[str] = None
    priority: Optional[str] = None
    description: Optional[str] = None
    justification: Optional[str] = None
    assigned_to: Optional[str] = None
    status: Optional[str] = None
    target_release_date: Optional[datetime] = None


class ApprovalSummary(BaseModel):
    id: int
    stage: str
    approver: str
    status: str
    comments: Optional[str] = None
    approved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ECRResponse(ECRBase):
    id: int
    ecr_number: str
    status: str
    ai_risk_score: float
    ai_recommendation: Optional[str] = None
    ai_affected_parts: Optional[List[str]] = []
    ai_impact_summary: Optional[str] = None
    ai_missing_components: Optional[List[str]] = []
    created_at: datetime
    updated_at: datetime
    approvals: Optional[List[ApprovalSummary]] = []

    class Config:
        from_attributes = True


class ECRListResponse(BaseModel):
    id: int
    ecr_number: str
    title: str
    product_name: Optional[str] = None
    part_number: Optional[str] = None
    change_type: str
    priority: str
    status: str
    requested_by: Optional[str] = None
    ai_risk_score: float
    created_at: datetime

    class Config:
        from_attributes = True
