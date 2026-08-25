from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date, datetime, timedelta
from uuid import UUID
from pydantic import BaseModel
import models
from database import get_db
from currency import to_usd
from auth_router import require_editor

router = APIRouter(prefix="/receipts", tags=["Cobros recibidos"])

class ReceiptBase(BaseModel):
    receipt_date: date
    client_name: str
    amount: float
    currency: str
    bank_name: Optional[str] = None
    account_label: Optional[str] = None
    country: Optional[str] = None
    hotel: Optional[str] = None
    reference: Optional[str] = None
    receivable_id: Optional[UUID] = None
    notes: Optional[str] = None

class ReceiptCreate(ReceiptBase): pass
class ReceiptUpdate(BaseModel):
    receipt_date: Optional[date] = None
    client_name: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    bank_name: Optional[str] = None
    account_label: Optional[str] = None
    country: Optional[str] = None
    hotel: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None

class ReceiptOut(ReceiptBase):
    id: UUID
    created_at: datetime
    class Config: from_attributes = True

@router.get("", response_model=List[ReceiptOut])
def list_receipts(
    country: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db)
):
    q = db.query(models.Receipt)
    if country: q = q.filter(models.Receipt.country == country)
    if date_from: q = q.filter(models.Receipt.receipt_date >= date_from)
    if date_to: q = q.filter(models.Receipt.receipt_date <= date_to)
    return q.order_by(models.Receipt.receipt_date.desc()).all()

@router.post("", response_model=ReceiptOut, dependencies=[Depends(require_editor)])
def create_receipt(data: ReceiptCreate, db: Session = Depends(get_db)):
    obj = models.Receipt(**data.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    if data.receivable_id:
        rec = db.query(models.Receivable).filter(models.Receivable.id == data.receivable_id).first()
        if rec:
            rec.status = "cobrado"
            db.commit()
    return obj

@router.put("/{rec_id}", response_model=ReceiptOut, dependencies=[Depends(require_editor)])
def update_receipt(rec_id: UUID, data: ReceiptUpdate, db: Session = Depends(get_db)):
    obj = db.query(models.Receipt).filter(models.Receipt.id == rec_id).first()
    if not obj: raise HTTPException(404, "Not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit(); db.refresh(obj)
    return obj

@router.delete("/{rec_id}", dependencies=[Depends(require_editor)])
def delete_receipt(rec_id: UUID, db: Session = Depends(get_db)):
    obj = db.query(models.Receipt).filter(models.Receipt.id == rec_id).first()
    if not obj: raise HTTPException(404, "Not found")
    db.delete(obj); db.commit()
    return {"ok": True}

@router.get("/summary/daily")
def daily_summary(days: int = 30, fx_rate: float = 17.5, db: Session = Depends(get_db)):
    today = date.today()
    start = today - timedelta(days=days)
    rows = db.query(models.Receipt).filter(models.Receipt.receipt_date >= start).all()
    by_date = {}
    for r in rows:
        d = str(r.receipt_date)
        if d not in by_date: by_date[d] = 0.0
        by_date[d] += to_usd(r.amount, r.currency, fx_rate)
    return [{"date": d, "total_usd": round(v, 2)} for d, v in sorted(by_date.items())]

@router.get("/summary/today")
def today_summary(fx_rate: float = 17.5, db: Session = Depends(get_db)):
    today = date.today()
    rows = db.query(models.Receipt).filter(models.Receipt.receipt_date == today).all()
    total = sum(to_usd(r.amount, r.currency, fx_rate) for r in rows)
    return {"total_usd": round(total, 2), "count": len(rows)}