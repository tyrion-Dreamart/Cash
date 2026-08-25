from dotenv import load_dotenv
load_dotenv()
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, timedelta
from database import get_db
import models
import anthropic
import os
from currency import to_usd

router = APIRouter(prefix="/agent", tags=["CFO Agent"])

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    fx_rate: float = 17.5

def get_financial_context(db: Session, fx_rate: float = 17.5) -> str:
    today = date.today()

    # Bancos
    latest_date = db.query(sqlfunc.max(models.BankPosition.position_date)).scalar()
    if latest_date:
        positions = db.query(models.BankPosition).filter(models.BankPosition.position_date == latest_date).all()
        total_banks = sum(to_usd(p.balance_available, p.currency, fx_rate) for p in positions)
        banks_date = str(latest_date)
    else:
        banks = db.query(models.BankAccount).all()
        total_banks = sum(to_usd(b.balance, b.currency, fx_rate) for b in banks)
        banks_date = str(today)

    # CXC
    receivables = db.query(models.Receivable).filter(
        models.Receivable.status.in_(["pendiente","parcial","vencido"])
    ).all()
    total_cxc = sum(to_usd(float(r.amount)-float(r.amount_paid or 0), r.currency, fx_rate) for r in receivables)
    overdue_cxc = [r for r in receivables if r.due_date and r.due_date < today]
    total_overdue_cxc = sum(to_usd(float(r.amount)-float(r.amount_paid or 0), r.currency, fx_rate) for r in overdue_cxc)

    # CXP
    payables = db.query(models.Payable).filter(
        models.Payable.status.in_(["pendiente","programado","parcial"])
    ).all()
    total_cxp = sum(to_usd(float(p.amount)-float(p.amount_paid or 0), p.currency, fx_rate) for p in payables)
    alta_cxp = [p for p in payables if str(p.priority).replace("CXPPriority.","") == "alta"]
    total_alta = sum(to_usd(float(p.amount)-float(p.amount_paid or 0), p.currency, fx_rate) for p in alta_cxp)

    # Proximos 7 dias
    next_week = today + timedelta(days=7)
    due_this_week_cxp = [p for p in payables if p.due_date and p.due_date <= next_week]
    total_due_week = sum(to_usd(float(p.amount)-float(p.amount_paid or 0), p.currency, fx_rate) for p in due_this_week_cxp)

    due_this_week_cxc = [r for r in receivables if r.due_date and r.due_date <= next_week]
    total_collect_week = sum(to_usd(float(r.amount)-float(r.amount_paid or 0), r.currency, fx_rate) for r in due_this_week_cxc)

    # Deuda
    debts = db.query(models.DebtObligation).filter(
        models.DebtObligation.status != "vencido"
    ).all()
    total_debt = sum(to_usd(d.total_amount, d.currency, fx_rate) for d in debts)
    debt_next_30 = [d for d in debts if d.next_payment_date and d.next_payment_date <= today + timedelta(days=30)]
    total_debt_30 = sum(to_usd(d.monthly_payment, d.currency, fx_rate) for d in debt_next_30)

    # Pagos y cobros recientes
    payments_today_list = db.query(models.Payment).filter(models.Payment.payment_date == today).all()
    receipts_today_list = db.query(models.Receipt).filter(models.Receipt.receipt_date == today).all()
    total_paid_today = sum(to_usd(p.amount, p.currency, fx_rate) for p in payments_today_list)
    total_collected_today = sum(to_usd(r.amount, r.currency, fx_rate) for r in receipts_today_list)
    payments_today_list = db.query(models.Payment).filter(models.Payment.payment_date == today).all()
    receipts_today_list = db.query(models.Receipt).filter(models.Receipt.receipt_date == today).all()
    total_paid_today = sum(to_usd(p.amount, p.currency, fx_rate) for p in payments_today_list)
    total_collected_today = sum(to_usd(r.amount, r.currency, fx_rate) for r in receipts_today_list)
    vendors_today = ", ".join([f"{p.vendor_name} ${to_usd(p.amount,p.currency,fx_rate):,.0f}" for p in payments_today_list])
    payments_7d = db.query(models.Payment).filter(
        models.Payment.payment_date >= today - timedelta(days=7)
    ).all()
    receipts_7d = db.query(models.Receipt).filter(
        models.Receipt.receipt_date >= today - timedelta(days=7)
    ).all()
    total_paid_7d = sum(to_usd(p.amount, p.currency, fx_rate) for p in payments_7d)
    total_collected_7d = sum(to_usd(r.amount, r.currency, fx_rate) for r in receipts_7d)

    # Cobranza
    overdue_without_followup = db.query(models.Receivable).filter(
        models.Receivable.status.in_(["pendiente","parcial","vencido"]),
        models.Receivable.due_date < today
    ).all()
    without_log = sum(1 for r in overdue_without_followup if not db.query(models.CollectionLog).filter(models.CollectionLog.receivable_id == r.id).first())

    # Por pais
    by_country = {}
    for r in receivables:
        c = r.country or "Unknown"
        if c not in by_country: by_country[c] = {"cxc":0,"cxp":0}
        by_country[c]["cxc"] += to_usd(float(r.amount)-float(r.amount_paid or 0), r.currency, fx_rate)
    for p in payables:
        c = p.country or "Unknown"
        if c not in by_country: by_country[c] = {"cxc":0,"cxp":0}
        by_country[c]["cxp"] += to_usd(float(p.amount)-float(p.amount_paid or 0), p.currency, fx_rate)


    # Otros (reembolsos, anticipos, garantias)
    others = db.query(models.Other).filter(
        models.Other.status.in_(["pendiente","parcial"])
    ).all()
    others_to_pay = sum(to_usd(float(o.amount)-float(o.amount_paid or 0), o.currency, fx_rate) for o in others if str(o.direction).replace("OtherDirection.","") == "pagar")
    others_to_collect = sum(to_usd(float(o.amount)-float(o.amount_paid or 0), o.currency, fx_rate) for o in others if str(o.direction).replace("OtherDirection.","") == "cobrar")

    # Pagos recientes (ultimos 30 dias)
    payments_30d = db.query(models.Payment).filter(
        models.Payment.payment_date >= today - timedelta(days=30)
    ).all()
    total_paid_30d = sum(to_usd(p.amount, p.currency, fx_rate) for p in payments_30d)
    top_vendors = {}
    for p in payments_30d:
        v = p.vendor_name
        if v not in top_vendors: top_vendors[v] = 0
        top_vendors[v] += to_usd(p.amount, p.currency, fx_rate)
    top_vendors_list = sorted(top_vendors.items(), key=lambda x: x[1], reverse=True)[:5]

    # Cobros recientes (ultimos 30 dias)
    receipts_30d = db.query(models.Receipt).filter(
        models.Receipt.receipt_date >= today - timedelta(days=30)
    ).all()
    total_collected_30d = sum(to_usd(r.amount, r.currency, fx_rate) for r in receipts_30d)
    top_clients = {}
    for r in receipts_30d:
        c = r.client_name
        if c not in top_clients: top_clients[c] = 0
        top_clients[c] += to_usd(r.amount, r.currency, fx_rate)
    top_clients_list = sorted(top_clients.items(), key=lambda x: x[1], reverse=True)[:5]
    country_summary = "\n".join([f"  - {c}: CXC ${v['cxc']:,.0f} | CXP ${v['cxp']:,.0f} | Net ${v['cxc']-v['cxp']:,.0f}" for c,v in sorted(by_country.items())])

    context = f"""DREAMART PHOTOGRAPHY GROUP — REAL-TIME FINANCIAL DATA
Date: {today} | FX Rate: {fx_rate} MXN/USD

BANK POSITION (as of {banks_date}):
  Total banks: ${total_banks:,.0f} USD

ACCOUNTS RECEIVABLE (CXC):
  Active balance: ${total_cxc:,.0f} USD
  Overdue: ${total_overdue_cxc:,.0f} USD ({len(overdue_cxc)} invoices)
  Due this week: ${total_collect_week:,.0f} USD
  Overdue without follow-up: {without_log} invoices

ACCOUNTS PAYABLE (CXP):
  Total pending: ${total_cxp:,.0f} USD
  High priority: ${total_alta:,.0f} USD
  Due this week: ${total_due_week:,.0f} USD ({len(due_this_week_cxp)} invoices)

DEBT:
  Total: ${total_debt:,.0f} USD
  Due next 30 days: ${total_debt_30:,.0f} USD

TODAY ({today}):
  Payments made: ${total_paid_today:,.0f} USD ({len(payments_today_list)} transactions)
  Vendors paid today: {vendors_today if vendors_today else "None"}
  Receipts collected: ${total_collected_today:,.0f} USD ({len(receipts_today_list)} transactions)

LAST 7 DAYS ACTIVITY:
  Payments made: ${total_paid_7d:,.0f} USD
  Receipts collected: ${total_collected_7d:,.0f} USD

WORKING CAPITAL:
  Net (Banks + CXC - CXP): ${total_banks + total_cxc - total_cxp:,.0f} USD
  CXC/CXP ratio: {round(total_cxc/total_cxp,2) if total_cxp > 0 else 'N/A'} (healthy >1.2)

OTHERS (Reimbursements/Advances/Guarantees):
  Pending to pay: ${others_to_pay:,.0f} USD
  Pending to collect: ${others_to_collect:,.0f} USD

PAYMENTS MADE (last 30 days):
  Total paid: ${total_paid_30d:,.0f} USD ({len(payments_30d)} payments)
  Top vendors: {', '.join([f'{v}: ${a:,.0f}' for v,a in top_vendors_list])}

RECEIPTS COLLECTED (last 30 days):
  Total collected: ${total_collected_30d:,.0f} USD ({len(receipts_30d)} receipts)
  Top clients: {', '.join([f'{c}: ${a:,.0f}' for c,a in top_clients_list])}

POSITION BY COUNTRY:
{country_summary}"""

    return context

@router.post("/chat")
def chat(request: ChatRequest, db: Session = Depends(get_db)):
    context = get_financial_context(db, request.fx_rate)

    system_prompt = f"""You are the CFO advisor for Dreamart Photography Group, a multi-hotel photography company operating in Mexico, Costa Rica, Jamaica, and St. Lucia.

{context}

Be direct, concise and action-oriented. Give specific recommendations with exact numbers from the data above.
- Use bullet points for lists
- Always reference specific amounts and dates
- Flag risks clearly
- Prioritize actionable advice
- Respond in the same language the user writes in (Spanish or English)
- When asked about Monday or future days, calculate from today ({date.today()})"""

    client = anthropic.Anthropic(api_key=os.environ.get('ANTHROPIC_API_KEY',''))
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        system=system_prompt,
        messages=[{"role": m.role, "content": m.content} for m in request.messages]
    )

    return {"content": response.content[0].text}