from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import date, timedelta
from uuid import UUID
import models, schemas
from database import get_db
from currency import to_usd
from auth_router import require_editor

router = APIRouter(prefix="/bank-positions", tags=["Posicion Bancaria"])

@router.get("", response_model=List[schemas.BankPositionOut])
def list_positions(
    position_date: Optional[date] = None,
    country: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(models.BankPosition)
    if position_date:
        q = q.filter(models.BankPosition.position_date == position_date)
    if country:
        q = q.filter(models.BankPosition.country == country)
    return q.order_by(models.BankPosition.position_date.desc(), models.BankPosition.country, models.BankPosition.bank_name).all()

@router.post("", response_model=schemas.BankPositionOut, dependencies=[Depends(require_editor)])
def create_position(data: schemas.BankPositionCreate, db: Session = Depends(get_db)):
    # Ya existe una captura para esta cuenta y fecha: actualiza en vez de duplicar
    existing = db.query(models.BankPosition).filter(
        models.BankPosition.position_date == data.position_date,
        models.BankPosition.bank_name == data.bank_name,
        models.BankPosition.account_label == data.account_label,
    ).first()
    if existing:
        for k, v in data.model_dump().items():
            setattr(existing, k, v)
        db.commit(); db.refresh(existing)
        obj = existing
    else:
        obj = models.BankPosition(**data.model_dump())
        db.add(obj); db.commit(); db.refresh(obj)

    # Auto-send report when all accounts updated today
    try:
        from datetime import date
        today = date.today()
        total_accounts = db.query(models.BankAccount).count()
        updated_today = db.query(models.BankPosition).filter(
            models.BankPosition.position_date == today
        ).count()
        if total_accounts > 0 and updated_today >= total_accounts:
            from report_service import send_daily_report
            import threading
            threading.Thread(target=send_daily_report, args=(db,), daemon=True).start()
    except Exception as e:
        print(f"Auto report error: {e}")

    return obj

@router.put("/{pos_id}", response_model=schemas.BankPositionOut, dependencies=[Depends(require_editor)])
def update_position(pos_id: UUID, data: schemas.BankPositionUpdate, db: Session = Depends(get_db)):
    obj = db.query(models.BankPosition).filter(models.BankPosition.id == pos_id).first()
    if not obj: raise HTTPException(404, "No encontrado")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit(); db.refresh(obj)
    return obj

@router.delete("/{pos_id}", dependencies=[Depends(require_editor)])
def delete_position(pos_id: UUID, db: Session = Depends(get_db)):
    obj = db.query(models.BankPosition).filter(models.BankPosition.id == pos_id).first()
    if not obj: raise HTTPException(404, "No encontrado")
    db.delete(obj); db.commit()
    return {"ok": True}

@router.get("/summary/today", response_model=schemas.BankPositionSummary)
def get_summary(
    fx_rate: float = Query(default=17.5),
    db: Session = Depends(get_db)
):
    today = date.today()
    yesterday = today - timedelta(days=1)

    today_rows = db.query(models.BankPosition).filter(
        models.BankPosition.position_date == today
    ).all()

    # Si no hay registros hoy, usar el ultimo dia disponible
    if not today_rows:
        latest = db.query(func.max(models.BankPosition.position_date)).scalar()
        if latest:
            today_rows = db.query(models.BankPosition).filter(
                models.BankPosition.position_date == latest
            ).all()
            today = latest

    yesterday_rows = db.query(models.BankPosition).filter(
        models.BankPosition.position_date == yesterday
    ).all()

    # By country
    by_country = {}
    for r in today_rows:
        c = r.country or "Sin pais"
        if c not in by_country:
            by_country[c] = {"country": c, "total_mxn": 0.0, "total_usd": 0.0, "total_usd_equiv": 0.0}
        if r.currency == "MXN":
            by_country[c]["total_mxn"] += float(r.balance_available)
        else:
            by_country[c]["total_usd"] += float(r.balance_available)
        by_country[c]["total_usd_equiv"] += to_usd(r.balance_available, r.currency, fx_rate)

    # By currency
    by_currency = {}
    for r in today_rows:
        cur = r.currency
        if cur not in by_currency:
            by_currency[cur] = {"currency": cur, "total": 0.0, "total_usd_equiv": 0.0}
        by_currency[cur]["total"] += float(r.balance_available)
        by_currency[cur]["total_usd_equiv"] += to_usd(r.balance_available, cur, fx_rate)

    total_today = sum(to_usd(r.balance_available, r.currency, fx_rate) for r in today_rows)
    total_yesterday = sum(to_usd(r.balance_available, r.currency, fx_rate) for r in yesterday_rows)

    # Cuentas sin actualizar hoy
    all_accounts = db.query(models.BankAccount.bank_name, models.BankAccount.account_label).all()
    today_accounts = {(r.bank_name, r.account_label) for r in today_rows}
    missing = [f"{b} - {a}".strip("- ") for b, a in all_accounts if (b, a) not in today_accounts]

    return schemas.BankPositionSummary(
        position_date=today,
        by_country=list(by_country.values()),
        by_currency=list(by_currency.values()),
        total_usd_equiv=round(total_today, 2),
        fx_rate=fx_rate,
        vs_yesterday=round(total_today - total_yesterday, 2),
        missing_today=missing
    )

@router.get("/history/summary")
def get_history(
    days: int = 30,
    fx_rate: float = 17.5,
    db: Session = Depends(get_db)
):
    from datetime import date, timedelta
    from sqlalchemy import func
    today = date.today()
    start = today - timedelta(days=days)
    rows = db.query(models.BankPosition).filter(
        models.BankPosition.position_date >= start
    ).all()
    by_date = {}
    for r in rows:
        d = str(r.position_date)
        if d not in by_date:
            by_date[d] = 0.0
        by_date[d] += to_usd(r.balance_available, r.currency, fx_rate)
    result = [{"date": d, "total_usd": round(v, 2)} for d, v in sorted(by_date.items())]
    return result
@router.get("/history/cashflow")
def get_cashflow(
    days: int = 30,
    fx_rate: float = 17.5,
    db: Session = Depends(get_db)
):
    from datetime import date, timedelta
    from sqlalchemy import func as sqlfunc
    today = date.today()
    start = today - timedelta(days=days+1)

    def to_usd_local(amount, currency):
        return to_usd(amount, currency, fx_rate)

    # Get daily bank totals from bank_positions
    positions = db.query(models.BankPosition).filter(
        models.BankPosition.position_date >= start
    ).all()

    daily_bank = {}
    for p in positions:
        d = str(p.position_date)
        if d not in daily_bank: daily_bank[d] = 0.0
        daily_bank[d] += to_usd_local(p.balance_available, p.currency)

    # Get daily payments
    payments = db.query(models.Payment).filter(
        models.Payment.payment_date >= start
    ).all()
    daily_payments = {}
    for p in payments:
        d = str(p.payment_date)
        if d not in daily_payments: daily_payments[d] = 0.0
        daily_payments[d] += to_usd_local(p.amount, p.currency)

    # Build sorted list of dates with bank data
    sorted_dates = sorted(daily_bank.keys())

    result = []
    for i in range(1, len(sorted_dates)):
        d = sorted_dates[i]
        prev = sorted_dates[i-1]
        balance_today = daily_bank[d]
        balance_yesterday = daily_bank[prev]
        outflows = daily_payments.get(d, 0.0)
        # Inferred inflows = (balance today - balance yesterday) + outflows
        inferred_inflow = (balance_today - balance_yesterday) + outflows
        net_variation = balance_today - balance_yesterday

        result.append({
            "date": d,
            "label": f"{int(d[5:7])}/{int(d[8:10])}",
            "inflow": round(max(inferred_inflow, 0), 2),
            "outflow": round(outflows, 2),
            "net": round(net_variation, 2),
            "balance": round(balance_today, 2),
            "inferred": True
        })

    return result