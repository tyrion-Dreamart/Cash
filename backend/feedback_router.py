from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid
from database import Base, get_db
from auth_router import require_editor

class Feedback(Base):
    __tablename__ = "feedback"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    page = Column(String(200), nullable=True)
    type = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(String(20), default="normal")
    status = Column(String(20), default="pending")
    created_by = Column(String(100), nullable=True)
    response = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class FeedbackCreate(BaseModel):
    page: Optional[str] = None
    type: str
    description: str
    priority: str = "normal"
    created_by: Optional[str] = None

class FeedbackUpdate(BaseModel):
    status: Optional[str] = None
    response: Optional[str] = None

class FeedbackOut(FeedbackCreate):
    id: uuid.UUID
    status: str
    response: Optional[str] = None
    created_at: datetime
    class Config: from_attributes = True

router = APIRouter(prefix="/feedback", tags=["Feedback"])

@router.get("", response_model=List[FeedbackOut])
def list_feedback(status: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Feedback)
    if status: q = q.filter(Feedback.status == status)
    return q.order_by(Feedback.created_at.desc()).all()

@router.post("", response_model=FeedbackOut)
def create_feedback(data: FeedbackCreate, db: Session = Depends(get_db)):
    obj = Feedback(**data.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

@router.put("/{fb_id}", response_model=FeedbackOut, dependencies=[Depends(require_editor)])
def update_feedback(fb_id: uuid.UUID, data: FeedbackUpdate, db: Session = Depends(get_db)):
    obj = db.query(Feedback).filter(Feedback.id == fb_id).first()
    if not obj: raise HTTPException(404, "Not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit(); db.refresh(obj)
    return obj