from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ECNBase(BaseModel):
    title: str
    description: Optional[str] = None
    change_summary: Optional[str] = None
    implementation_notes: Optional[str] = None
    effective_date: Optional[datetime] = None


class ECNCreate(ECNBase):
    ecr_id: int


class ECNUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    release_stage: Optional[str] = None
    change_summary: Optional[str] = None
    implementation_notes: Optional[str] = None
    effective_date: Optional[datetime] = None


class ECNResponse(ECNBase):
    id: int
    ecn_number: str
    ecr_id: int
    status: str
    release_stage: str
    approved_by: Optional[str] = None
    release_date: Optional[datetime] = None
    revision_level: str
    affected_bom_items: Optional[List] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
