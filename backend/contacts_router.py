from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, Text, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid
from database import Base, get_db
from auth_router import require_editor

class Contact(Base):
    __tablename__ = "contacts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    legal_name = Column(String(300), nullable=False)
    commercial_name = Column(String(300), nullable=True)
    type = Column(String(20), default="both")
    country = Column(String(100), nullable=True)
    tax_id = Column(String(100), nullable=True)
    email = Column(String(200), nullable=True)
    phone = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class ContactCreate(BaseModel):
    legal_name: str
    commercial_name: Optional[str] = None
    type: str = "both"
    country: Optional[str] = None
    tax_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None

class ContactOut(ContactCreate):
    id: uuid.UUID
    created_at: datetime
    class Config: from_attributes = True

router = APIRouter(prefix="/contacts", tags=["Contacts"])

@router.get("", response_model=List[ContactOut])
def list_contacts(
    q: Optional[str] = None,
    type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Contact)
    if q:
        query = query.filter(
            Contact.legal_name.ilike(f"%{q}%") |
            Contact.commercial_name.ilike(f"%{q}%")
        )
    if type:
        query = query.filter(
            (Contact.type == type) | (Contact.type == "both")
        )
    return query.order_by(Contact.legal_name).limit(20).all()

@router.post("", response_model=ContactOut, dependencies=[Depends(require_editor)])
def create_contact(data: ContactCreate, db: Session = Depends(get_db)):
    obj = Contact(**data.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

@router.put("/{contact_id}", response_model=ContactOut, dependencies=[Depends(require_editor)])
def update_contact(contact_id: uuid.UUID, data: ContactCreate, db: Session = Depends(get_db)):
    obj = db.query(Contact).filter(Contact.id == contact_id).first()
    if not obj: return None
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit(); db.refresh(obj)
    return obj

@router.delete("/{contact_id}", dependencies=[Depends(require_editor)])
def delete_contact(contact_id: uuid.UUID, db: Session = Depends(get_db)):
    obj = db.query(Contact).filter(Contact.id == contact_id).first()
    if obj: db.delete(obj); db.commit()
    return {"ok": True}