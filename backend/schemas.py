from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date, datetime
from uuid import UUID
from models import (Currency, CXCStatus, CXPStatus, CXPPriority, DebtStatus, OtherCategory, OtherDirection, OtherStatus)

class BankAccountBase(BaseModel):
    bank_name: str
    account_label: str
    currency: Currency
    balance: float
    updated_at: date
    notes: Optional[str] = None
class BankAccountCreate(BankAccountBase): pass
class BankAccountUpdate(BaseModel):
    bank_name: Optional[str] = None
    account_label: Optional[str] = None
    currency: Optional[Currency] = None
    balance: Optional[float] = None
    updated_at: Optional[date] = None
    notes: Optional[str] = None
class BankAccountOut(BankAccountBase):
    id: UUID
    created_at: datetime
    class Config: from_attributes = True

class ReceivableBase(BaseModel):
    client_name: str
    amount: float
    currency: Currency
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    status: CXCStatus = CXCStatus.pendiente
    responsible: Optional[str] = None
    country: Optional[str] = None
    hotel: Optional[str] = None
    legal_entity: Optional[str] = None
    amount_paid: Optional[float] = 0
    comments: Optional[str] = None
class ReceivableCreate(ReceivableBase): pass
class ReceivableUpdate(BaseModel):
    client_name: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[Currency] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    status: Optional[CXCStatus] = None
    responsible: Optional[str] = None
    country: Optional[str] = None
    hotel: Optional[str] = None
    legal_entity: Optional[str] = None
    amount_paid: Optional[float] = None
    comments: Optional[str] = None
class ReceivableOut(ReceivableBase):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True

class PayableBase(BaseModel):
    vendor_name: str
    amount: float
    currency: Currency
    due_date: date
    priority: CXPPriority = CXPPriority.media
    status: CXPStatus = CXPStatus.pendiente
    country: Optional[str] = None
    hotel: Optional[str] = None
    legal_entity: Optional[str] = None
    amount_paid: Optional[float] = 0
    comments: Optional[str] = None
class PayableCreate(PayableBase): pass
class PayableUpdate(BaseModel):
    vendor_name: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[Currency] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    priority: Optional[CXPPriority] = None
    status: Optional[CXPStatus] = None
    country: Optional[str] = None
    hotel: Optional[str] = None
    legal_entity: Optional[str] = None
    amount_paid: Optional[float] = None
    comments: Optional[str] = None
class PayableOut(PayableBase):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True

class DebtBase(BaseModel):
    creditor_name: str
    total_amount: float
    monthly_payment: float
    currency: Currency
    next_payment_date: date
    status: DebtStatus = DebtStatus.al_corriente
    comments: Optional[str] = None
class DebtCreate(DebtBase): pass
class DebtUpdate(BaseModel):
    creditor_name: Optional[str] = None
    total_amount: Optional[float] = None
    monthly_payment: Optional[float] = None
    currency: Optional[Currency] = None
    next_payment_date: Optional[date] = None
    status: Optional[DebtStatus] = None
    comments: Optional[str] = None
class DebtOut(DebtBase):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True

class OtherBase(BaseModel):
    concept: str
    category: OtherCategory
    direction: OtherDirection
    amount: float
    currency: Currency
    counterparty: Optional[str] = None
    due_date: Optional[date] = None
    status: OtherStatus = OtherStatus.pendiente
    comments: Optional[str] = None
class OtherCreate(OtherBase): pass
class OtherUpdate(BaseModel):
    priority: Optional[str] = None
    concept: Optional[str] = None
    category: Optional[OtherCategory] = None
    direction: Optional[OtherDirection] = None
    amount: Optional[float] = None
    currency: Optional[Currency] = None
    counterparty: Optional[str] = None
    due_date: Optional[date] = None
    status: Optional[OtherStatus] = None
    comments: Optional[str] = None
class OtherOut(OtherBase):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True

class CountryTotal(BaseModel):
    country: str
    total_cxc: float
    total_cxp: float
    net: float

class DashboardKPIs(BaseModel):
    total_banks_mxn: float
    total_banks_usd: float
    total_banks_usd_equiv: float
    fx_rate_used: float
    total_cxc_active: float
    total_cxc_overdue: float
    cxc_due_this_week: float
    cxc_due_this_month: float
    total_cxp_pending: float
    cxp_alta_prioridad: float
    cxp_due_this_week: float
    cxp_due_this_month: float
    total_debt_balance: float
    debt_due_next_30d: float
    others_to_collect: float
    others_to_pay: float
    working_capital_net: float
    cxc_cxp_ratio: float
    debt_coverage_ratio: float
    estimated_net_flow_30d: float
    by_country: list[CountryTotal]
    payments_today: float
    receipts_today: float
    estimated_balance: float
    alerts: list[dict]
class BankPositionBase(BaseModel):
    position_date: date
    country: Optional[str] = None
    bank_name: str
    account_label: str
    currency: str
    balance_available: float
    balance_book: Optional[float] = None
    notes: Optional[str] = None

    @field_validator("bank_name", "account_label")
    @classmethod
    def not_blank(cls, v):
        v = v.strip() if v else v
        if not v:
            raise ValueError("no puede estar vacio")
        return v

class BankPositionCreate(BankPositionBase): pass

class BankPositionUpdate(BaseModel):
    position_date: Optional[date] = None
    country: Optional[str] = None
    bank_name: Optional[str] = None
    account_label: Optional[str] = None
    currency: Optional[str] = None
    balance_available: Optional[float] = None
    balance_book: Optional[float] = None
    notes: Optional[str] = None

    @field_validator("bank_name", "account_label")
    @classmethod
    def not_blank(cls, v):
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("no puede estar vacio")
        return v

class BankPositionOut(BankPositionBase):
    id: UUID
    created_at: datetime
    class Config: from_attributes = True

class BankPositionSummary(BaseModel):
    position_date: date
    by_country: list[dict]
    by_currency: list[dict]
    total_usd_equiv: float
    fx_rate: float
    vs_yesterday: float
    missing_today: list[str]
class OtherBase(BaseModel):
    concept: str
    category: OtherCategory = OtherCategory.otro
    direction: OtherDirection = OtherDirection.cobrar
    amount: float
    currency: Currency = Currency.MXN
    counterparty: Optional[str] = None
    due_date: Optional[date] = None
    status: OtherStatus = OtherStatus.pendiente
    priority: Optional[str] = "media"
    amount_paid: Optional[float] = 0
    comments: Optional[str] = None

class OtherCreate(OtherBase): pass

class OtherUpdate(BaseModel):
    concept: Optional[str] = None
    category: Optional[OtherCategory] = None
    direction: Optional[OtherDirection] = None
    amount: Optional[float] = None
    currency: Optional[Currency] = None
    counterparty: Optional[str] = None
    due_date: Optional[date] = None
    status: Optional[OtherStatus] = None
    priority: Optional[str] = None
    amount_paid: Optional[float] = None
    comments: Optional[str] = None

class OtherOut(OtherBase):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True

class PayableBase(BaseModel):
    vendor_name: str
    amount: float
    currency: Currency = Currency.USD
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    priority: CXPPriority = CXPPriority.media
    status: CXPStatus = CXPStatus.pendiente
    country: Optional[str] = None
    hotel: Optional[str] = None
    legal_entity: Optional[str] = None
    amount_paid: Optional[float] = 0
    comments: Optional[str] = None

class PayableCreate(PayableBase): pass

class PayableUpdate(BaseModel):
    vendor_name: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[Currency] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    priority: Optional[CXPPriority] = None
    status: Optional[CXPStatus] = None
    country: Optional[str] = None
    hotel: Optional[str] = None
    legal_entity: Optional[str] = None
    amount_paid: Optional[float] = None
    comments: Optional[str] = None

class PayableOut(PayableBase):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    score: Optional[int] = None
    score_label: Optional[str] = None
    class Config: from_attributes = True
