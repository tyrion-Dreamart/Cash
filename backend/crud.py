from sqlalchemy.orm import Session
from datetime import date, timedelta
from uuid import UUID
import models, schemas
from currency import to_usd as _to_usd

def get_banks(db):
    return db.query(models.BankAccount).order_by(models.BankAccount.bank_name).all()
def get_bank(db, bank_id):
    return db.query(models.BankAccount).filter(models.BankAccount.id == bank_id).first()
def create_bank(db, data):
    obj = models.BankAccount(**data.model_dump()); db.add(obj); db.commit(); db.refresh(obj); return obj
def update_bank(db, bank_id, data):
    obj = get_bank(db, bank_id)
    if not obj: return None
    [setattr(obj, k, v) for k, v in data.model_dump(exclude_unset=True).items()]
    db.commit(); db.refresh(obj); return obj
def delete_bank(db, bank_id):
    obj = get_bank(db, bank_id)
    if obj: db.delete(obj); db.commit()
    return obj

def get_receivables(db, status=None):
    q = db.query(models.Receivable)
    if status: q = q.filter(models.Receivable.status == status)
    return q.order_by(models.Receivable.due_date).all()
def get_receivable(db, rec_id):
    return db.query(models.Receivable).filter(models.Receivable.id == rec_id).first()
def create_receivable(db, data):
    obj = models.Receivable(**data.model_dump()); db.add(obj); db.commit(); db.refresh(obj); return obj
def update_receivable(db, rec_id, data):
    obj = get_receivable(db, rec_id)
    if not obj: return None
    [setattr(obj, k, v) for k, v in data.model_dump(exclude_unset=True).items()]
    db.commit(); db.refresh(obj); return obj
def delete_receivable(db, rec_id):
    obj = get_receivable(db, rec_id)
    if obj: db.delete(obj); db.commit()
    return obj

def get_payables(db, status=None, priority=None):
    q = db.query(models.Payable)
    if status: q = q.filter(models.Payable.status == status)
    if priority: q = q.filter(models.Payable.priority == priority)
    return q.order_by(models.Payable.due_date).all()
def get_payable(db, pay_id):
    return db.query(models.Payable).filter(models.Payable.id == pay_id).first()
def create_payable(db, data):
    obj = models.Payable(**data.model_dump()); db.add(obj); db.commit(); db.refresh(obj); return obj
def update_payable(db, pay_id, data):
    obj = get_payable(db, pay_id)
    if not obj: return None
    [setattr(obj, k, v) for k, v in data.model_dump(exclude_unset=True).items()]
    db.commit(); db.refresh(obj); return obj
def delete_payable(db, pay_id):
    obj = get_payable(db, pay_id)
    if obj: db.delete(obj); db.commit()
    return obj

def get_debts(db):
    return db.query(models.DebtObligation).order_by(models.DebtObligation.next_payment_date).all()
def get_debt(db, debt_id):
    return db.query(models.DebtObligation).filter(models.DebtObligation.id == debt_id).first()
def create_debt(db, data):
    obj = models.DebtObligation(**data.model_dump()); db.add(obj); db.commit(); db.refresh(obj); return obj
def update_debt(db, debt_id, data):
    obj = get_debt(db, debt_id)
    if not obj: return None
    [setattr(obj, k, v) for k, v in data.model_dump(exclude_unset=True).items()]
    db.commit(); db.refresh(obj); return obj
def delete_debt(db, debt_id):
    obj = get_debt(db, debt_id)
    if obj: db.delete(obj); db.commit()
    return obj

def get_others(db, direction=None, category=None):
    q = db.query(models.Other)
    if direction: q = q.filter(models.Other.direction == direction)
    if category: q = q.filter(models.Other.category == category)
    return q.order_by(models.Other.due_date).all()
def get_other(db, other_id):
    return db.query(models.Other).filter(models.Other.id == other_id).first()
def create_other(db, data):
    obj = models.Other(**data.model_dump()); db.add(obj); db.commit(); db.refresh(obj); return obj
def update_other(db, other_id, data):
    obj = get_other(db, other_id)
    if not obj: return None
    [setattr(obj, k, v) for k, v in data.model_dump(exclude_unset=True).items()]
    db.commit(); db.refresh(obj); return obj
def delete_other(db, other_id):
    obj = get_other(db, other_id)
    if obj: db.delete(obj); db.commit()
    return obj

def calc_dashboard(db, fx_rate=17.5):
    today = date.today()
    week_end = today + timedelta(days=7)
    month_end = today + timedelta(days=30)
    def to_usd(amount, currency):
        return _to_usd(amount, currency, fx_rate)

    # Use latest bank_positions instead of bank_accounts static balance
    from sqlalchemy import func as sqlfunc2
    latest_date = db.query(sqlfunc2.max(models.BankPosition.position_date)).scalar()
    if latest_date:
        bank_positions = db.query(models.BankPosition).filter(models.BankPosition.position_date == latest_date).all()
        total_mxn = sum(float(b.balance_available) for b in bank_positions if str(b.currency) in ("MXN","Currency.MXN"))
        total_usd = sum(float(b.balance_available) for b in bank_positions if str(b.currency) in ("USD","Currency.USD"))
        total_banks_usd_equiv = sum(to_usd(b.balance_available, b.currency) for b in bank_positions)
    else:
        banks = db.query(models.BankAccount).all()
        total_mxn = sum(float(b.balance) for b in banks if str(b.currency) in ("MXN","Currency.MXN"))
        total_usd = sum(float(b.balance) for b in banks if str(b.currency) in ("USD","Currency.USD"))
        total_banks_usd_equiv = sum(to_usd(b.balance, b.currency) for b in banks)
    cxc_active = db.query(models.Receivable).filter(models.Receivable.status.in_(["pendiente","parcial"])).all()
    cxc_overdue = db.query(models.Receivable).filter(models.Receivable.status == "vencido").all()
    total_cxc_active = sum(to_usd(r.amount, r.currency) for r in cxc_active)
    total_cxc_overdue = sum(to_usd(r.amount, r.currency) for r in cxc_overdue)
    cxc_due_week = sum(to_usd(r.amount, r.currency) for r in cxc_active if r.due_date <= week_end)
    cxc_due_month = sum(to_usd(r.amount, r.currency) for r in cxc_active if r.due_date <= month_end)
    cxp_pending = db.query(models.Payable).filter(models.Payable.status.in_(["pendiente","programado"])).all()
    cxp_alta = [p for p in cxp_pending if str(p.priority) in ("alta","CXPPriority.alta")]
    total_cxp_pending = sum(to_usd(p.amount, p.currency) for p in cxp_pending)
    total_cxp_alta = sum(to_usd(p.amount, p.currency) for p in cxp_alta)
    cxp_due_week = sum(to_usd(p.amount, p.currency) for p in cxp_pending if p.due_date <= week_end)
    cxp_due_month = sum(to_usd(p.amount, p.currency) for p in cxp_pending if p.due_date <= month_end)
    debts = db.query(models.DebtObligation).filter(models.DebtObligation.status != "vencido").all()
    total_debt = sum(to_usd(d.total_amount, d.currency) for d in debts)
    debt_30d = sum(to_usd(d.monthly_payment, d.currency) for d in debts if d.next_payment_date <= month_end)
    others_active = db.query(models.Other).filter(models.Other.status.in_(["pendiente","parcial"])).all()
    others_collect = sum(to_usd(o.amount, o.currency) for o in others_active if str(o.direction) in ("cobrar","OtherDirection.cobrar"))
    others_pay = sum(to_usd(o.amount, o.currency) for o in others_active if str(o.direction) in ("pagar","OtherDirection.pagar"))
    working_capital = total_banks_usd_equiv + total_cxc_active - total_cxp_pending
    cxc_cxp_ratio = round(total_cxc_active / total_cxp_pending, 2) if total_cxp_pending > 0 else 0
    debt_coverage = round(total_banks_usd_equiv / debt_30d, 2) if debt_30d > 0 else 0
    net_flow_30d = cxc_due_month - cxp_due_month - debt_30d
    all_cxc_c = db.query(models.Receivable).filter(models.Receivable.status.in_(["pendiente","parcial","vencido"])).all()
    all_cxp_c = db.query(models.Payable).filter(models.Payable.status.in_(["pendiente","programado"])).all()
    countries = set([r.country or "Sin pais" for r in all_cxc_c] + [p.country or "Sin pais" for p in all_cxp_c])
    by_country = []
    for c in sorted(countries):
        c_cxc = sum(to_usd(r.amount, r.currency) for r in all_cxc_c if (r.country or "Sin pais") == c)
        c_cxp = sum(to_usd(p.amount, p.currency) for p in all_cxp_c if (p.country or "Sin pais") == c)
        by_country.append(schemas.CountryTotal(country=c, total_cxc=round(c_cxc,2), total_cxp=round(c_cxp,2), net=round(c_cxc-c_cxp,2)))
    alerts = []
    for r in cxc_active + cxc_overdue:
        if r.due_date < today:
            days_over = (today - r.due_date).days
            cur = str(r.currency).replace("Currency.","")
            alerts.append({"type":"cxc_overdue","severity":"red","message":f"CXC vencida {days_over}d: {r.client_name} - ${float(r.amount):,.0f} {cur}"})
    for p in cxp_pending:
        days_left = (p.due_date - today).days
        cur = str(p.currency).replace("Currency.","")
        if days_left < 0:
            alerts.append({"type":"cxp_overdue","severity":"red","message":f"CXP VENCIDA: {p.vendor_name} - ${float(p.amount):,.0f} {cur}"})
        elif days_left <= 3:
            alerts.append({"type":"cxp_due_soon","severity":"red","message":f"CXP vence en {days_left}d: {p.vendor_name} - ${float(p.amount):,.0f} {cur}"})
    for d in debts:
        if (d.next_payment_date - today).days <= 7:
            cur = str(d.currency).replace("Currency.","")
            alerts.append({"type":"debt_due","severity":"orange","message":f"Deuda vence en {(d.next_payment_date-today).days}d: {d.creditor_name} - ${float(d.monthly_payment):,.0f} {cur}"})
    if total_banks_usd_equiv < total_cxp_alta:
        alerts.append({"type":"liquidity_critical","severity":"red","message":f"Bancos (${total_banks_usd_equiv:,.0f}) insuficientes para CXP alta prioridad (${total_cxp_alta:,.0f})"})
    return schemas.DashboardKPIs(
        total_banks_mxn=round(total_mxn,2), total_banks_usd=round(total_usd,2),
        total_banks_usd_equiv=round(total_banks_usd_equiv,2), fx_rate_used=fx_rate,
        total_cxc_active=round(total_cxc_active,2), total_cxc_overdue=round(total_cxc_overdue,2),
        cxc_due_this_week=round(cxc_due_week,2), cxc_due_this_month=round(cxc_due_month,2),
        total_cxp_pending=round(total_cxp_pending,2), cxp_alta_prioridad=round(total_cxp_alta,2),
        cxp_due_this_week=round(cxp_due_week,2), cxp_due_this_month=round(cxp_due_month,2),
        total_debt_balance=round(total_debt,2), debt_due_next_30d=round(debt_30d,2),
        others_to_collect=round(others_collect,2), others_to_pay=round(others_pay,2),
        working_capital_net=round(working_capital,2), cxc_cxp_ratio=cxc_cxp_ratio,
        debt_coverage_ratio=debt_coverage, estimated_net_flow_30d=round(net_flow_30d,2),
        by_country=by_country,
        payments_today=get_today_payments_total(db, fx_rate),
        receipts_today=get_today_receipts_total(db, fx_rate),
        estimated_balance=round(total_banks_usd_equiv - get_today_payments_total(db, fx_rate) + get_today_receipts_total(db, fx_rate), 2),
        alerts=alerts)
def get_today_payments_total(db, fx_rate=17.5):
    from datetime import date
    today = date.today()
    payments = db.query(models.Payment).filter(models.Payment.payment_date == today).all()
    return round(sum(_to_usd(p.amount, p.currency, fx_rate) for p in payments), 2)
def get_today_receipts_total(db, fx_rate=17.5):
    from datetime import date
    today = date.today()
    receipts = db.query(models.Receipt).filter(models.Receipt.receipt_date == today).all()
    return round(sum(_to_usd(r.amount, r.currency, fx_rate) for r in receipts), 2)
def calc_payment_score(payable, today) -> int:
    score = 0
    # Dias vencido (40 pts max)
    if payable.due_date:
        days_overdue = (today - payable.due_date).days
        if days_overdue > 0:
            score += min(40, int(days_overdue / 3))
        elif days_overdue > -7:
            score += 20
        elif days_overdue > -30:
            score += 10
    # Prioridad (30 pts)
    priority_str = str(payable.priority).replace("CXPPriority.","")
    if priority_str == "alta": score += 30
    elif priority_str == "media": score += 15
    # Monto (20 pts)
    balance = float(payable.amount) - float(payable.amount_paid or 0)
    if balance > 10000: score += 20
    elif balance > 5000: score += 15
    elif balance > 1000: score += 10
    elif balance > 0: score += 5
    # Vence esta semana (10 pts bonus)
    if payable.due_date:
        days_to_due = (payable.due_date - today).days
        if 0 <= days_to_due <= 7: score += 10
    return min(100, score)