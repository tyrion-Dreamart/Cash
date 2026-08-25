from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
from datetime import date, timedelta
from typing import List
import models
import anthropic
import os
from database import get_db
from currency import to_usd as _to_usd, DEFAULT_FX_RATE as FX
from auth_router import require_editor

router = APIRouter(prefix="/agent/reclassify", tags=["Reclassify Agent"])

def to_usd(amount, currency):
    return _to_usd(amount, currency, FX)

@router.get("/suggestions")
def get_suggestions(db: Session = Depends(get_db)):
    today = date.today()

    # Get overdue items
    cxp_overdue = db.query(models.Payable).filter(
        models.Payable.due_date < today,
        models.Payable.status.in_(["pendiente","programado","parcial"])
    ).order_by(models.Payable.due_date).all()

    cxc_overdue = db.query(models.Receivable).filter(
        models.Receivable.due_date < today,
        models.Receivable.status.in_(["pendiente","parcial","vencido"])
    ).order_by(models.Receivable.due_date).all()

    others_overdue = db.query(models.Other).filter(
        models.Other.due_date < today,
        models.Other.status.in_(["pendiente","parcial"])
    ).order_by(models.Other.due_date).all()

    # Get forecast next 60 days
    latest_date = db.query(sqlfunc.max(models.BankPosition.position_date)).scalar()
    positions = db.query(models.BankPosition).filter(models.BankPosition.position_date == latest_date).all() if latest_date else []
    current_balance = sum(to_usd(p.balance_available, p.currency) for p in positions)

    # Get future payments already scheduled
    future_payables = db.query(models.Payable).filter(
        models.Payable.due_date >= today,
        models.Payable.due_date <= today + timedelta(days=60),
        models.Payable.status.in_(["pendiente","programado","parcial"])
    ).all()

    future_receivables = db.query(models.Receivable).filter(
        models.Receivable.due_date >= today,
        models.Receivable.due_date <= today + timedelta(days=60),
        models.Receivable.status.in_(["pendiente","parcial","vencido"])
    ).all()

    # Build daily cashflow for next 60 days
    daily_flow = {}
    for i in range(60):
        d = today + timedelta(days=i)
        daily_flow[str(d)] = {"inflow": 0.0, "outflow": 0.0}

    for r in future_receivables:
        if r.due_date:
            d = str(r.due_date)
            if d in daily_flow:
                daily_flow[d]["inflow"] += to_usd(float(r.amount) - float(r.amount_paid or 0), r.currency)

    for p in future_payables:
        if p.due_date:
            d = str(p.due_date)
            if d in daily_flow:
                daily_flow[d]["outflow"] += to_usd(float(p.amount) - float(p.amount_paid or 0), p.currency)

    # Calculate running balance
    running = current_balance
    balance_by_day = {}
    for i in range(60):
        d = str(today + timedelta(days=i))
        running = running + daily_flow[d]["inflow"] - daily_flow[d]["outflow"]
        balance_by_day[d] = running

    # Find best days for payments (balance > threshold)
    good_payment_days = [d for d, bal in balance_by_day.items() if bal > 5000]
    good_collection_days = [d for d, bal in balance_by_day.items() if bal < 15000]

    # Build context for Claude
    cxp_list = "\n".join([
        f"- {p.vendor_name} | {p.invoice_number or '--'} | ${to_usd(float(p.amount)-float(p.amount_paid or 0), p.currency):,.0f} USD | Vencida: {p.due_date} | {p.country or '--'} | Prioridad: {str(p.priority).replace('CXPPriority.','')}"
        for p in cxp_overdue[:10]
    ])

    cxc_list = "\n".join([
        f"- {r.client_name} | {r.invoice_number or '--'} | ${to_usd(float(r.amount)-float(r.amount_paid or 0), r.currency):,.0f} USD | Vencida: {r.due_date} | {r.country or '--'}"
        for r in cxc_overdue[:10]
    ])

    others_list = "\n".join([
        f"- {o.concept} | {o.counterparty or '--'} | ${to_usd(float(o.amount)-float(o.amount_paid or 0), o.currency):,.0f} USD | Vencida: {o.due_date} | {str(o.direction).replace('OtherDirection.','')}"
        for o in others_overdue[:8]
    ])

    balance_summary = "\n".join([
        f"- {d}: ${bal:,.0f} USD"
        for d, bal in list(balance_by_day.items())[:30]
    ])

    prompt = f"""Eres el CFO de Dreamart Photography Group. Analiza las facturas vencidas y propone nuevas fechas realistas basadas en el flujo de caja disponible.

SALDO ACTUAL: ${current_balance:,.0f} USD
FECHA HOY: {today}

FLUJO DE CAJA PROYECTADO (próximos 30 días):
{balance_summary}

CXP VENCIDAS ({len(cxp_overdue)} facturas):
{cxp_list}

CXC VENCIDAS ({len(cxc_overdue)} facturas):
{cxc_list}

OTROS VENCIDOS ({len(others_overdue)} registros):
{others_list}

Proporciona sugerencias de reclasificación en formato JSON exacto:
{{
  "summary": "resumen ejecutivo en 2-3 oraciones",
  "cxp": [
    {{"vendor": "nombre", "invoice": "factura", "current_date": "fecha actual", "suggested_date": "YYYY-MM-DD", "reason": "razón corta", "amount": 1234.56}}
  ],
  "cxc": [
    {{"client": "nombre", "invoice": "factura", "current_date": "fecha actual", "suggested_date": "YYYY-MM-DD", "reason": "razón corta", "amount": 1234.56}}
  ],
  "others": [
    {{"concept": "concepto", "current_date": "fecha actual", "suggested_date": "YYYY-MM-DD", "reason": "razón corta", "amount": 1234.56}}
  ]
}}

Reglas:
- CXP: propone fechas donde el saldo proyectado sea suficiente para cubrir el pago sin caer en negativo
- CXC: propone fechas de seguimiento/cobro realistas (próximas 2-4 semanas)
- Otros: según si es cobrar o pagar, aplica la misma lógica
- Todas las fechas propuestas deben ser futuras (después de {today})
- Responde SOLO con el JSON, sin texto adicional"""

    try:
        from dotenv import load_dotenv
        load_dotenv()
        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY",""))
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8000,
            messages=[{"role": "user", "content": prompt}]
        )
        import json, re
        text = response.content[0].text.strip()
        # Extract JSON from response
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            try:
                suggestions = json.loads(json_match.group())
            except json.JSONDecodeError as je:
                # Try to fix truncated JSON
                raw = json_match.group()
                # Count open/close braces and brackets
                suggestions = {"summary": f"Claude response was truncated. Partial data received. Error: {str(je)}", "cxp": [], "cxc": [], "others": []}
        else:
            suggestions = {"summary": text[:500] if text else "No response from AI", "cxp": [], "cxc": [], "others": []}
    except Exception as e:
        suggestions = {"summary": f"Error: {str(e)}", "cxp": [], "cxc": [], "others": []}

    return {
        "current_balance": round(current_balance, 2),
        "total_overdue_cxp": len(cxp_overdue),
        "total_overdue_cxc": len(cxc_overdue),
        "total_overdue_others": len(others_overdue),
        "suggestions": suggestions,
        "balance_by_day": {k: round(v, 2) for k, v in list(balance_by_day.items())[:30]}
    }

@router.post("/apply", dependencies=[Depends(require_editor)])
def apply_suggestion(data: dict, db: Session = Depends(get_db)):
    """Apply a single date suggestion"""
    tipo = data.get("type")
    id = data.get("id")
    new_date = data.get("new_date")

    if not all([tipo, id, new_date]):
        return {"ok": False, "error": "Missing fields"}

    try:
        from datetime import datetime
        parsed_date = datetime.strptime(new_date, "%Y-%m-%d").date()

        if tipo == "cxp":
            obj = db.query(models.Payable).filter(models.Payable.id == id).first()
            if obj: obj.due_date = parsed_date
        elif tipo == "cxc":
            obj = db.query(models.Receivable).filter(models.Receivable.id == id).first()
            if obj: obj.due_date = parsed_date
        elif tipo == "other":
            obj = db.query(models.Other).filter(models.Other.id == id).first()
            if obj: obj.due_date = parsed_date

        db.commit()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}