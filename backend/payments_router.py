from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import date, datetime, timedelta
from uuid import UUID
from pydantic import BaseModel
import models
from database import get_db
from currency import to_usd
from auth_router import require_editor

router = APIRouter(prefix="/payments", tags=["Pagos realizados"])

class PaymentBase(BaseModel):
    payment_date: date
    vendor_name: str
    amount: float
    currency: str
    bank_name: Optional[str] = None
    account_label: Optional[str] = None
    country: Optional[str] = None
    hotel: Optional[str] = None
    reference: Optional[str] = None
    payable_id: Optional[UUID] = None
    notes: Optional[str] = None

class PaymentCreate(PaymentBase): pass
class PaymentUpdate(BaseModel):
    payment_date: Optional[date] = None
    vendor_name: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    bank_name: Optional[str] = None
    account_label: Optional[str] = None
    country: Optional[str] = None
    hotel: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None

class PaymentOut(PaymentBase):
    id: UUID
    created_at: datetime
    class Config: from_attributes = True

@router.get("", response_model=List[PaymentOut])
def list_payments(
    country: Optional[str] = None,
    hotel: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db)
):
    q = db.query(models.Payment)
    if country: q = q.filter(models.Payment.country == country)
    if hotel: q = q.filter(models.Payment.hotel.ilike(f"%{hotel}%"))
    if date_from: q = q.filter(models.Payment.payment_date >= date_from)
    if date_to: q = q.filter(models.Payment.payment_date <= date_to)
    return q.order_by(models.Payment.payment_date.desc()).all()

@router.post("", response_model=PaymentOut, dependencies=[Depends(require_editor)])
def create_payment(data: PaymentCreate, db: Session = Depends(get_db)):
    obj = models.Payment(**data.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    if data.payable_id:
        payable = db.query(models.Payable).filter(models.Payable.id == data.payable_id).first()
        if payable:
            payable.status = "pagado"
            db.commit()
    return obj

@router.put("/{pay_id}", response_model=PaymentOut, dependencies=[Depends(require_editor)])
def update_payment(pay_id: UUID, data: PaymentUpdate, db: Session = Depends(get_db)):
    obj = db.query(models.Payment).filter(models.Payment.id == pay_id).first()
    if not obj: raise HTTPException(404, "Not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit(); db.refresh(obj)
    return obj

@router.delete("/{pay_id}", dependencies=[Depends(require_editor)])
def delete_payment(pay_id: UUID, db: Session = Depends(get_db)):
    obj = db.query(models.Payment).filter(models.Payment.id == pay_id).first()
    if not obj: raise HTTPException(404, "Not found")
    db.delete(obj); db.commit()
    return {"ok": True}

@router.get("/summary/daily")
def daily_summary(
    days: int = 30,
    fx_rate: float = 17.5,
    db: Session = Depends(get_db)
):
    today = date.today()
    start = today - timedelta(days=days)
    rows = db.query(models.Payment).filter(models.Payment.payment_date >= start).all()
    by_date = {}
    for r in rows:
        d = str(r.payment_date)
        if d not in by_date:
            by_date[d] = 0.0
        by_date[d] += to_usd(r.amount, r.currency, fx_rate)
    return [{"date": d, "total_usd": round(v, 2)} for d, v in sorted(by_date.items())]

@router.get("/summary/by-vendor")
def by_vendor(
    days: int = 30,
    fx_rate: float = 17.5,
    db: Session = Depends(get_db)
):
    today = date.today()
    start = today - timedelta(days=days)
    rows = db.query(models.Payment).filter(models.Payment.payment_date >= start).all()
    by_vendor = {}
    for r in rows:
        v = r.vendor_name
        if v not in by_vendor:
            by_vendor[v] = {"vendor": v, "total_usd": 0.0, "count": 0}
        by_vendor[v]["total_usd"] += to_usd(r.amount, r.currency, fx_rate)
        by_vendor[v]["count"] += 1
    result = sorted(by_vendor.values(), key=lambda x: x["total_usd"], reverse=True)
    for r in result:
        r["total_usd"] = round(r["total_usd"], 2)
    return result