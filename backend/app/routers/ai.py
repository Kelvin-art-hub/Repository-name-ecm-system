from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models.bom import BOMItem
from app.models.user import User
from app.services.auth import get_current_user
from app.services.ai_service import ai_service

router = APIRouter(prefix="/api/ai", tags=["AI Analysis"])


class AIAnalysisRequest(BaseModel):
    title: str
    product_name: Optional[str] = None
    part_number: Optional[str] = None
    change_type: str = "Design"
    priority: str = "Medium"
    description: Optional[str] = None


class QuantityChangeRequest(BaseModel):
    part_number: str
    old_quantity: float
    new_quantity: float


@router.post("/analyze-ecr")
def analyze_ecr(
    req: AIAnalysisRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run AI risk analysis on ECR data before submission."""
    result = ai_service.predict_change_risk(req.model_dump(), db)
    return result


@router.get("/validate-bom/{item_id}")
def validate_bom_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Validate BOM item consistency and suggest missing components."""
    item = db.query(BOMItem).filter(BOMItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="BOM item not found")
    return ai_service.validate_bom_consistency(item, db)


@router.post("/quantity-impact")
def analyze_quantity_impact(
    req: QuantityChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Analyze the impact of a quantity change on cost and supply chain."""
    return ai_service.analyze_quantity_change_impact(
        req.part_number, req.old_quantity, req.new_quantity, db
    )


@router.get("/insights")
def get_ai_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get system-level AI insights and recommendations."""
    insights = ai_service.get_system_insights(db)
    return {"insights": insights}
