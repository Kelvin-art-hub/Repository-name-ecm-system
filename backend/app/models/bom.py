from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class BOMItem(Base):
    __tablename__ = "bom_items"

    id = Column(Integer, primary_key=True, index=True)
    part_number = Column(String(100), index=True, nullable=False)
    part_name = Column(String(500), nullable=False)
    revision = Column(String(20), default="A")
    parent_id = Column(Integer, ForeignKey("bom_items.id"), nullable=True)
    quantity = Column(Float, default=1.0)
    unit = Column(String(20), default="EA")
    material = Column(String(255))
    product_family = Column(String(100))
    description = Column(Text)
    manufacturer = Column(String(255))
    manufacturer_part_number = Column(String(100))
    unit_cost = Column(Float, default=0.0)
    lead_time_days = Column(Integer, default=0)
    status = Column(String(50), default="Active")  # Active, Obsolete, Prototype, Pending
    version = Column(Integer, default=1)
    is_locked = Column(Boolean, default=False)
    locked_by = Column(String(100))
    locked_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Self-referential relationship for BOM tree
    children = relationship(
        "BOMItem",
        foreign_keys="BOMItem.parent_id",
        back_populates="parent_item",
    )
    parent_item = relationship(
        "BOMItem",
        foreign_keys="BOMItem.parent_id",
        back_populates="children",
        remote_side="BOMItem.id",
    )
    versions = relationship("BOMVersion", back_populates="bom_item", cascade="all, delete-orphan")


class BOMVersion(Base):
    __tablename__ = "bom_versions"

    id = Column(Integer, primary_key=True, index=True)
    bom_item_id = Column(Integer, ForeignKey("bom_items.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    revision = Column(String(20))
    snapshot = Column(JSON)  # Full BOM snapshot at this version
    change_summary = Column(Text)
    changed_by = Column(String(255))
    changed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    bom_item = relationship("BOMItem", back_populates="versions")
    changer = relationship("User", foreign_keys=[changed_by_id])
