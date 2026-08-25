from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date, datetime, timedelta
from uuid import UUID
from pydantic import BaseModel
import models
from database import get_db
from auth_router import require_editor

router = APIRouter(prefix="/collection", tags=["Seguimiento cobranza"])

class CollectionLogBase(BaseModel):
    receivable_id: UUID
    contact_date: date
    contact_type: str
    contact_person: Optional[str] = None
    notes: str
    next_action_date: Optional[date] = None
    next_action: Optional[str] = None
    collection_status: str = "contacted"
    created_by: Optional[str] = None

class CollectionLogCreate(CollectionLogBase): pass

class CollectionLogOut(CollectionLogBase):
    id: UUID
    created_at: datetime
    class Config: from_attributes = True

@router.get("/receivable/{receivable_id}", response_model=List[CollectionLogOut])
def get_logs(receivable_id: UUID, db: Session = Depends(get_db)):
    return db.query(models.CollectionLog).filter(
        models.CollectionLog.receivable_id == receivable_id
    ).order_by(models.CollectionLog.contact_date.desc()).all()

@router.post("", response_model=CollectionLogOut, dependencies=[Depends(require_editor)])
def create_log(data: CollectionLogCreate, db: Session = Depends(get_db)):
    obj = models.CollectionLog(**data.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    if data.collection_status == "bad_debt":
        rec = db.query(models.Receivable).filter(models.Receivable.id == data.receivable_id).first()
        if rec: rec.status = "vencido"; db.commit()
    return obj

@router.delete("/{log_id}", dependencies=[Depends(require_editor)])
def delete_log(log_id: UUID, db: Session = Depends(get_db)):
    obj = db.query(models.CollectionLog).filter(models.CollectionLog.id == log_id).first()
    if not obj: raise HTTPException(404, "Not found")
    db.delete(obj); db.commit()
    return {"ok": True}

@router.get("/pending-actions")
def pending_actions(db: Session = Depends(get_db)):
    today = date.today()
    logs = db.query(models.CollectionLog).filter(
        models.CollectionLog.next_action_date <= today,
        models.CollectionLog.collection_status.notin_(["collected","bad_debt","cancelled"])
    ).order_by(models.CollectionLog.next_action_date).all()
    result = []
    for log in logs:
        rec = db.query(models.Receivable).filter(models.Receivable.id == log.receivable_id).first()
        result.append({
            "log_id": str(log.id),
            "receivable_id": str(log.receivable_id),
            "client_name": rec.client_name if rec else "Unknown",
            "amount": float(rec.amount) if rec else 0,
            "currency": str(rec.currency) if rec else "USD",
            "next_action_date": str(log.next_action_date),
            "next_action": log.next_action,
            "days_overdue": (today - log.next_action_date).days,
            "collection_status": log.collection_status
        })
    return result

@router.get("/summary")
def collection_summary(db: Session = Depends(get_db)):
    today = date.today()
    overdue = db.query(models.Receivable).filter(
        models.Receivable.status.in_(["pendiente","parcial","vencido"]),
        models.Receivable.due_date < today
    ).all()
    total = len(overdue)
    with_log = 0
    without_log = 0
    for rec in overdue:
        log = db.query(models.CollectionLog).filter(
            models.CollectionLog.receivable_id == rec.id
        ).first()
        if log: with_log += 1
        else: without_log += 1
    return {
        "total_overdue": total,
        "with_followup": with_log,
        "without_followup": without_log,
        "pending_actions_today": db.query(models.CollectionLog).filter(
            models.CollectionLog.next_action_date <= today,
            models.CollectionLog.collection_status.notin_(["collected","bad_debt","cancelled"])
        ).count()
    }