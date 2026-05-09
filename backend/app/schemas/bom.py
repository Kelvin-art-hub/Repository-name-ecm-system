from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class BOMItemBase(BaseModel):
    part_number: str
    part_name: str
    revision: str = "A"
    quantity: float = 1.0
    unit: str = "EA"
    material: Optional[str] = None
    product_family: Optional[str] = None
    description: Optional[str] = None
    manufacturer: Optional[str] = None
    manufacturer_part_number: Optional[str] = None
    unit_cost: float = 0.0
    lead_time_days: int = 0
    status: str = "Active"


class BOMItemCreate(BOMItemBase):
    parent_id: Optional[int] = None


class BOMItemUpdate(BaseModel):
    part_name: Optional[str] = None
    revision: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    material: Optional[str] = None
    product_family: Optional[str] = None
    description: Optional[str] = None
    manufacturer: Optional[str] = None
    manufacturer_part_number: Optional[str] = None
    unit_cost: Optional[float] = None
    lead_time_days: Optional[int] = None
    status: Optional[str] = None


class BOMItemResponse(BOMItemBase):
    id: int
    parent_id: Optional[int] = None
    version: int
    is_locked: bool
    locked_by: Optional[str] = None
    locked_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    children: Optional[List["BOMItemResponse"]] = []

    class Config:
        from_attributes = True


BOMItemResponse.model_rebuild()


class BOMVersionResponse(BaseModel):
    id: int
    bom_item_id: int
    version_number: int
    revision: Optional[str] = None
    snapshot: Optional[Any] = None
    change_summary: Optional[str] = None
    changed_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BOMCompareRequest(BaseModel):
    bom_item_id: int
    version_a: int
    version_b: int


class BOMLockRequest(BaseModel):
    user: str
    reason: Optional[str] = None
