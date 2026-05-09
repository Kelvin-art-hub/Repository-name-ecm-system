from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ApprovalAction(BaseModel):
    action: str  # "approve" or "reject"
    comments: Optional[str] = ""


class ApprovalResponse(BaseModel):
    id: int
    ecr_id: int
    ecr_number: Optional[str] = None
    ecr_title: Optional[str] = None
    priority: Optional[str] = None
    stage: str
    stage_order: int
    approver: str
    status: str
    comments: Optional[str] = None
    approved_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
