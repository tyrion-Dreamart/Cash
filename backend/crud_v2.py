from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import date, timedelta
from uuid import UUID
import models, schemas


def get_banks(db: Session):
    return db.query(models.BankAccount).order_by(models.BankAccount.bank_name).all()

def get_bank(db: Session, bank_id: UUID):
    return db.query(models.BankAccount).filter(models.BankAccount.id == bank_id).first()

def create_bank(db: Session, data: schemas.BankAccountCreate):
    obj = models.BankAccount(**data.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def update_bank(db: Session, bank_id: UUID, data: schemas.BankAccountUpdate):
    obj = get_bank(db, bank_id)
    if not obj: return None
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit(); db.refresh(obj)
    return obj

def delete_bank(db: Session, bank_id: UUID):
    obj = get_bank(db, bank_id)
    if obj: db.delete(obj); db.commit()
    return obj


def get_receivables(db: Session, status: str = None):
    q = db.query(models.Receivable)
    if status:
        q = q.filter(models.Receivable.status == status)
    return q.order_by(models.Receivable.due_date).all()

def get_receivable(db: Session, rec_id: UUID):
    return db.query(models.Receivable).filter(models.Receivable.id == rec_id).first()

def create_receivable(db: Session, data: schemas.ReceivableCreate):
    obj = models.Receivable(**data.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def update_receivable(db: Session, rec_id: UUID, data: schemas.ReceivableUpdate):
    obj = get_receivable(db, rec_id)
    if not obj: return None
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit(); db.refresh(obj)
    return obj

def delete_receivable(db: Session, rec_id: UUID):
    obj = get_receivable(db, rec_id)
    if obj: db.delete(obj); db.commit()
    return obj


def get_payables(db: Session, status: str = None, priority: str = None):
    q = db.query(models.Payable)
    if status: q = q.filter(models.Payable.status == status)
    if priority: q = q.filter(models.Payable.priority == priority)
    return q.order_by(models.Payable.due_date).all()

def get_payable(db: Session, pay_id: UUID):
    return db.query(models.Payable).filter(models.Payable.id == pay_id).first()

def create_payable(db: Session, data: schemas.PayableCreate):
    obj = models.Payable(**data.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def update_payable(db: Session, pay_id: UUID, data: schemas.PayableUpdate):
    obj = get_payable(db, pay_id)
    if not obj: return None
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit(); db.refresh(obj)
    return obj

def delete_payable(db: Session, pay_id: UUID):
    obj = get_payable(db, pay_id)
    if obj: db.delete(obj); db.commit()
    return obj


def get_debts(db: Session):
    return db.query(models.DebtObligation).order_by(models.DebtObligation.next_payment_date).all()

def get_debt(db: Session, debt_id: UUID):
    return db.query(models.DebtObligation).filter(models.DebtObligation.id == debt_id).first()

def create_debt(db: Session, data: schemas.DebtCreate):
    obj = models.DebtObligation(**data.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def update_debt(db: Session, debt_id: UUID, data: schemas.DebtUpdate):
    obj = get_debt(db, debt_id)
    if not obj: return None
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit(); db.refresh(obj)
    return obj

def delete_debt(db: Session, debt_id: UUID):
    obj = get_debt(db, debt_id)
    if obj: db.delete(obj); db.commit()
    return obj


def get_others(db: Session, direction: str = None, category: str = None):
    q = db.query(models.Other)
    if direction: q = q.filter(models.Other.direction == direction)
    if category: q = q.filter(models.Other.category == category)
    return q.order_by(models.Other.due_date).all()

def get_other(db: Session, other_id: UUID):
    return db.query(models.Other).filter(models.Other.id == other_id).first()

def create_other(db: Session, data: schemas.OtherCreate):
    obj = models.Other(**data.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def update_other(db: Session, other_id: UUID, data: schemas.OtherUpdate):
    obj = get_other(db, other_id)
    if not obj: return None
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit(); db.refresh(obj)
    return obj

def delete_other(db: Session, other_id: UUID):
    obj = get_other(db, other_id)
    if obj: db.delete(obj); db.commit()
    return obj


def calc_dashboard(db: Session, fx_rate: float = 17.5) -> schemas.DashboardKPIs:
    today = date.today()
    week_end = today + timedelta(days=7)
    month_end = today + timedelta(days=30)

    def to_usd(amount, currency):
        if str(currency) == "USD":
            return float(amount)
        return float(amount) / fx_rate

    # Bancos
    banks = db.query(models.BankAccount).all()
    total_mxn = sum(float(b.balance) for b in banks if str(b.currency) == "MXN")
    total_usd = sum(float(b.balance) for b in banks if str(b.currency) == "USD")
    total_banks_usd_equiv = total_usd + (total_mxn / fx_rate)

    # CXC
    active_statuses = ["pendiente", "parcial"]
    cxc_active = db.query(models.Receivable).filter(
        models.Receivable.status.in_(active_statuses)
    ).all()
    cxc_overdue = db.query(models.Receivable).filter(
        models.Receivable.status == "vencido"
    ).all()
    cxc_week = [r for r in cxc_active if r.due_date <= week_end]
    cxc_month = [r for r in cxc_active if r.due_date <= month_end]

    total_cxc_active = sum(to_usd(r.amount, r.currency) for r in cxc_active)
    total_cxc_overdue = sum(to_usd(r.amount, r.currency) for r in cxc_overdue)
    cxc_due_week = sum(to_usd(r.amount, r.currency) for r in cxc_week)
    cxc_due_month = sum(to_usd(r.amount, r.currency) for r in cxc_month)

    # CXP
    pending_statuses = ["pendiente", "programado"]
    cxp_pending = db.query(models.Payable).filter(
        models.Payable.status.in_(pending_statuses)
    ).all()
    cxp_alta = [p for p in cxp_pending if str(p.priority) == "alta"]
    cxp_week = [p for p in cxp_pending if p.due_date <= week_end]
    cxp_month = [p for p in cxp_pending if p.due_date <= month_end]

    total_cxp_pending = sum(to_usd(p.amount, p.currency) for p in cxp_pending)
    total_cxp_alta = sum(to_usd(p.amount, p.currency) for p in cxp_alta)
    cxp_due_week = sum(to_usd(p.amount, p.currency) for p in cxp_week)
    cxp_due_month = sum(to_usd(p.amount, p.currency) for p in cxp_month)

    # Deuda
    debts = db.query(models.DebtObligation).filter(
        models.DebtObligation.status != "vencido"
    ).all()
    total_debt = sum(to_usd(d.total_amount, d.currency) for d in debts)
    debt_30d = sum(
        to_usd(d.monthly_payment, d.currency)
        for d in debts if d.next_payment_date <= month_end
    )

    # Otros
    others_active = db.query(models.Other).filter(
        models.Other.status.in_(["pendiente", "parcial"])
    ).all()
    others_collect = sum(to_usd(o.amount, o.currency) for o in others_active if str(o.direction) == "cobrar")
    others_pay = sum(to_usd(o.amount, o.currency) for o in others_active if str(o.direction) == "pagar")

    # Ratios
    working_capital = total_banks_usd_equiv + total_cxc_active - total_cxp_pending
    cxc_cxp_ratio = round(total_cxc_active / total_cxp_pending, 2) if total_cxp_pending > 0 else 0
    debt_coverage = round(total_banks_usd_equiv / debt_30d, 2) if debt_30d > 0 else 0
    net_flow_30d = cxc_due_month - cxp_due_month - debt_30d

    # By country
    all_cxc_country = db.query(models.Receivable).filter(
        models.Receivable.status.in_(["pendiente", "parcial", "vencido"])
    ).all()
    all_cxp_country = db.query(models.Payable).filter(
        models.Payable.status.in_(["pendiente", "programado"])
    ).all()
    countries = set(
        [r.country or "Sin pais" for r in all_cxc_country] +
        [p.country or "Sin pais" for p in all_cxp_country]
    )
    by_country = []
    for c in sorted(countries):
        c_cxc = sum(to_usd(r.amount, r.currency) for r in all_cxc_country if (r.country or "Sin pais") == c)
        c_cxp = sum(to_usd(p.amount, p.currency) for p in all_cxp_country if (p.country or "Sin pais") == c)
        by_country.append(schemas.CountryTotal(
            country=c,
            total_cxc=round(c_cxc, 2),
            total_cxp=round(c_cxp, 2),
            net=round(c_cxc - c_cxp, 2)
        ))

    # Alertas
    alerts = []
    for r in cxc_active + cxc_overdue:
        if r.due_date < today:
            days_over = (today - r.due_date).days
            alerts.append({
                "type": "cxc_overdue", "severity": "red",
                "message": f"CXC vencida {days_over}d: {r.client_name} — ${float(r.amount):,.0f} {r.currency.value if hasattr(r.currency, 'value') else r.currency}"
            })
    for p in cxp_pending:
        days_left = (p.due_date - today).days
        cur = p.currency.value if hasattr(p.currency, 'value') else p.currency
        if days_left < 0:
            alerts.append({"type": "cxp_overdue", "severity": "red",
                "message": f"CXP VENCIDA: {p.vendor_name} — ${float(p.amount):,.0f} {cur}"})
        elif days_left <= 3:
            alerts.append({"type": "cxp_due_soon", "severity": "red",
                "message": f"CXP vence en {days_left}d: {p.vendor_name} — ${float(p.amount):,.0f} {cur}"})
    for d in debts:
        days_left = (d.next_payment_date - today).days
        if days_left <= 7:
            cur = d.currency.value if hasattr(d.currency, 'value') else d.currency
            alerts.append({"type": "debt_due", "severity": "orange",
                "message": f"Pago deuda en {days_left}d: {d.creditor_name} — ${float(d.monthly_payment):,.0f} {cur}"})
    if total_banks_usd_equiv < total_cxp_alta:
        alerts.append({"type": "liquidity_critical", "severity": "red",
            "message": f"Bancos (${total_banks_usd_equiv:,.0f}) insuficientes para CXP alta prioridad (${total_cxp_alta:,.0f})"})

    return schemas.DashboardKPIs(
        total_banks_mxn=round(total_mxn, 2),
        total_banks_usd=round(total_usd, 2),
        total_banks_usd_equiv=round(total_banks_usd_equiv, 2),
        fx_rate_used=fx_rate,
        total_cxc_active=round(total_cxc_active, 2),
        total_cxc_overdue=round(total_cxc_overdue, 2),
        cxc_due_this_week=round(cxc_due_week, 2),
        cxc_due_this_month=round(cxc_due_month, 2),
        total_cxp_pending=round(total_cxp_pending, 2),
        cxp_alta_prioridad=round(total_cxp_alta, 2),
        cxp_due_this_week=round(cxp_due_week, 2),
        cxp_due_this_month=round(cxp_due_month, 2),
        total_debt_balance=round(total_debt, 2),
        debt_due_next_30d=round(debt_30d, 2),
        others_to_collect=round(others_collect, 2),
        others_to_pay=round(others_pay, 2),
        working_capital_net=round(working_capital, 2),
        cxc_cxp_ratio=cxc_cxp_ratio,
        debt_coverage_ratio=debt_coverage,
        estimated_net_flow_30d=round(net_flow_30d, 2),
        by_country=by_country,
        alerts=alerts
    )
