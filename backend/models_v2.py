from sqlalchemy import Column, String, Numeric, Date, DateTime, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum
from database import Base


class Currency(str, enum.Enum):
    MXN = "MXN"
    USD = "USD"

class CXCStatus(str, enum.Enum):
    pendiente = "pendiente"
    parcial = "parcial"
    cobrado = "cobrado"
    vencido = "vencido"

class CXPStatus(str, enum.Enum):
    pendiente = "pendiente"
    programado = "programado"
    pagado = "pagado"

class CXPPriority(str, enum.Enum):
    alta = "alta"
    media = "media"
    baja = "baja"

class DebtStatus(str, enum.Enum):
    al_corriente = "al_corriente"
    por_vencer = "por_vencer"
    vencido = "vencido"

class OtherCategory(str, enum.Enum):
    reembolso = "reembolso"
    anticipo = "anticipo"
    garantia = "garantia"
    prestamo_interno = "prestamo_interno"
    otro = "otro"

class OtherDirection(str, enum.Enum):
    cobrar = "cobrar"
    pagar = "pagar"

class OtherStatus(str, enum.Enum):
    pendiente = "pendiente"
    parcial = "parcial"
    liquidado = "liquidado"
    cancelado = "cancelado"

class BankAccount(Base):
    __tablename__ = "bank_accounts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bank_name = Column(String(100), nullable=False)
    account_label = Column(String(150), nullable=False)
    currency = Column(Enum(Currency), nullable=False)
    balance = Column(Numeric(18, 2), nullable=False, default=0)
    updated_at = Column(Date, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Receivable(Base):
    __tablename__ = "receivables"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_name = Column(String(200), nullable=False)
    amount = Column(Numeric(18, 2), nullable=False)
    currency = Column(Enum(Currency), nullable=False)
    due_date = Column(Date, nullable=False)
    status = Column(Enum(CXCStatus), nullable=False, default=CXCStatus.pendiente)
    responsible = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    hotel = Column(String(200), nullable=True)
    legal_entity = Column(String(200), nullable=True)
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Payable(Base):
    __tablename__ = "payables"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_name = Column(String(200), nullable=False)
    amount = Column(Numeric(18, 2), nullable=False)
    currency = Column(Enum(Currency), nullable=False)
    due_date = Column(Date, nullable=False)
    priority = Column(Enum(CXPPriority), nullable=False, default=CXPPriority.media)
    status = Column(Enum(CXPStatus), nullable=False, default=CXPStatus.pendiente)
    country = Column(String(100), nullable=True)
    hotel = Column(String(200), nullable=True)
    legal_entity = Column(String(200), nullable=True)
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class DebtObligation(Base):
    __tablename__ = "debt_obligations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    creditor_name = Column(String(200), nullable=False)
    total_amount = Column(Numeric(18, 2), nullable=False)
    monthly_payment = Column(Numeric(18, 2), nullable=False)
    currency = Column(Enum(Currency), nullable=False)
    next_payment_date = Column(Date, nullable=False)
    status = Column(Enum(DebtStatus), nullable=False, default=DebtStatus.al_corriente)
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Other(Base):
    __tablename__ = "others"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    concept = Column(String(250), nullable=False)
    category = Column(Enum(OtherCategory), nullable=False)
    direction = Column(Enum(OtherDirection), nullable=False)
    amount = Column(Numeric(18, 2), nullable=False)
    currency = Column(Enum(Currency), nullable=False)
    counterparty = Column(String(200), nullable=True)
    due_date = Column(Date, nullable=True)
    status = Column(Enum(OtherStatus), nullable=False, default=OtherStatus.pendiente)
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
