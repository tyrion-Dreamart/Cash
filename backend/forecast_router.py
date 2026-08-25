from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date, timedelta
import models
from database import get_db
from currency import to_usd

router = APIRouter(prefix="/forecast", tags=["Forecast"])

@router.get("/liquidity")
def liquidity_forecast(
    days: int = 30,
    fx_rate: float = 17.5,
    scenario: str = "base",
    db: Session = Depends(get_db)
):
    today = date.today()
    multipliers = {"optimistic": 1.3, "base": 1.0, "conservative": 0.6}
    m = multipliers.get(scenario, 1.0)

    # Saldo inicial desde ultima posicion bancaria
    from sqlalchemy import func as sqlfunc
    latest_date = db.query(sqlfunc.max(models.BankPosition.position_date)).scalar()
    if latest_date:
        positions = db.query(models.BankPosition).filter(models.BankPosition.position_date == latest_date).all()
        balance = sum(to_usd(p.balance_available, p.currency, fx_rate) for p in positions)
    else:
        banks = db.query(models.BankAccount).all()
        balance = sum(to_usd(b.balance, b.currency, fx_rate) for b in banks)

    # Pagos de hoy ya realizados
    payments_today = db.query(models.Payment).filter(models.Payment.payment_date == today).all()
    receipts_today = db.query(models.Receipt).filter(models.Receipt.receipt_date == today).all()
    balance -= sum(to_usd(p.amount, p.currency, fx_rate) for p in payments_today)
    balance += sum(to_usd(r.amount, r.currency, fx_rate) for r in receipts_today)

    # CXP pendientes agrupadas por fecha
    from sqlalchemy import text as sqtext
    payables = db.query(models.Payable).filter(
        models.Payable.status.in_(["pendiente","programado"]),
        models.Payable.due_date <= today + timedelta(days=days)
    ).all()

    # CXC pendientes agrupadas por fecha
    receivables = db.query(models.Receivable).filter(
        models.Receivable.status.in_(["pendiente","parcial","vencido"]),
        models.Receivable.due_date <= today + timedelta(days=days)
    ).all()

    # Deuda proxima
    debts = db.query(models.DebtObligation).filter(
        models.DebtObligation.next_payment_date <= today + timedelta(days=days),
        models.DebtObligation.status != "vencido"
    ).all()

    # Construir eventos por dia
    events_by_day = {}
    for r in receivables:
        if not r.due_date: continue
        d = str(r.due_date)
        if d not in events_by_day: events_by_day[d] = {"inflows": [], "outflows": []}
        bal = float(r.amount) - float(r.amount_paid or 0)
        if bal > 0:
            events_by_day[d]["inflows"].append({
                "label": r.client_name,
                "amount": round(to_usd(bal, r.currency, fx_rate) * m, 2),
                "currency": str(r.currency).replace("Currency.",""),
                "hotel": r.hotel or "",
                "country": r.country or ""
            })

    for p in payables:
        if not p.due_date: continue
        d = str(p.due_date)
        if d not in events_by_day: events_by_day[d] = {"inflows": [], "outflows": []}
        bal = float(p.amount) - float(p.amount_paid or 0)
        if bal > 0:
            events_by_day[d]["outflows"].append({
                "label": p.vendor_name,
                "amount": round(to_usd(bal, p.currency, fx_rate), 2),
                "currency": str(p.currency).replace("Currency.",""),
                "hotel": p.hotel or "",
                "country": p.country or "",
                "priority": str(p.priority).replace("CXPPriority.","")
            })

    for d in debts:
        if not d.next_payment_date: continue
        dt = str(d.next_payment_date)
        if dt not in events_by_day: events_by_day[dt] = {"inflows": [], "outflows": []}
        events_by_day[dt]["outflows"].append({
            "label": f"Debt: {d.creditor_name}",
            "amount": round(to_usd(d.monthly_payment, d.currency, fx_rate), 2),
            "currency": str(d.currency).replace("Currency.",""),
            "hotel": d.hotel or "",
            "country": d.country or "",
            "priority": "alta"
        })

    # Construir serie de dias
    result = []
    running_balance = balance
    for i in range(1, days + 1):
        day = today + timedelta(days=i)
        day_str = str(day)
        events = events_by_day.get(day_str, {"inflows": [], "outflows": []})
        inflow = sum(e["amount"] for e in events["inflows"])
        outflow = sum(e["amount"] for e in events["outflows"])
        running_balance = running_balance + inflow - outflow
        result.append({
            "date": day_str,
            "day": i,
            "label": f"{day.month}/{day.day}",
            "balance": round(running_balance, 2),
            "inflow": round(inflow, 2),
            "outflow": round(outflow, 2),
            "inflow_events": events["inflows"][:3],
            "outflow_events": events["outflows"][:3],
            "risk": running_balance < 0
        })

    min_balance = min(d["balance"] for d in result)
    days_negative = sum(1 for d in result if d["risk"])
    critical_day = next((d for d in result if d["risk"]), None)

    return {
        "scenario": scenario,
        "starting_balance": round(balance, 2),
        "fx_rate": fx_rate,
        "days": result,
        "summary": {
            "day_30_balance": result[-1]["balance"] if result else 0,
            "min_balance": round(min_balance, 2),
            "days_negative": days_negative,
            "critical_day": critical_day["date"] if critical_day else None,
            "total_inflows": round(sum(d["inflow"] for d in result), 2),
            "total_outflows": round(sum(d["outflow"] for d in result), 2)
        }
    }