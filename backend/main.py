from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Optional, List
from uuid import UUID
import models, schemas, crud
from schemas import OtherCreate, OtherUpdate, OtherOut
import bank_positions_router
import auth_router
import payments_router
import receipts_router
import collection_router
import forecast_router
import agent_router
import feedback_router
import export_router
import contacts_router
import reclassify_router
from database import engine, get_db
from auth_router import get_current_user, require_editor

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Dreamart Cash Control",
    description="Control de capital de trabajo — Fase 1",
    version="1.0.0"
)

app.include_router(bank_positions_router.router, dependencies=[Depends(get_current_user)])
app.include_router(auth_router.router)
app.include_router(payments_router.router, dependencies=[Depends(get_current_user)])
app.include_router(receipts_router.router, dependencies=[Depends(get_current_user)])
app.include_router(collection_router.router, dependencies=[Depends(get_current_user)])
app.include_router(forecast_router.router, dependencies=[Depends(get_current_user)])
app.include_router(agent_router.router, dependencies=[Depends(get_current_user)])
app.include_router(feedback_router.router, dependencies=[Depends(get_current_user)])
app.include_router(export_router.router, dependencies=[Depends(get_current_user)])
app.include_router(contacts_router.router, dependencies=[Depends(get_current_user)])
app.include_router(reclassify_router.router, dependencies=[Depends(get_current_user)])
ALLOWED_ORIGINS = [
    "https://cash.dreamartworkingcapital.com",
    "http://localhost:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Dashboard ──────────────────────────────────────────────────
@app.get("/dashboard", response_model=schemas.DashboardKPIs, tags=["Dashboard"], dependencies=[Depends(get_current_user)])
def get_dashboard(
    fx_rate: float = Query(default=17.5, description="Tipo de cambio MXN/USD"),
    db: Session = Depends(get_db)
):
    return crud.calc_dashboard(db, fx_rate=fx_rate)


# ── Bank Accounts ──────────────────────────────────────────────
@app.get("/banks", response_model=List[schemas.BankAccountOut], tags=["Bancos"], dependencies=[Depends(get_current_user)])
def list_banks(db: Session = Depends(get_db)):
    return crud.get_banks(db)

@app.post("/banks", response_model=schemas.BankAccountOut, tags=["Bancos"], dependencies=[Depends(require_editor)])
def create_bank(data: schemas.BankAccountCreate, db: Session = Depends(get_db)):
    return crud.create_bank(db, data)

@app.put("/banks/{bank_id}", response_model=schemas.BankAccountOut, tags=["Bancos"], dependencies=[Depends(require_editor)])
def update_bank(bank_id: UUID, data: schemas.BankAccountUpdate, db: Session = Depends(get_db)):
    obj = crud.update_bank(db, bank_id, data)
    if not obj:
        raise HTTPException(404, "Cuenta no encontrada")
    return obj

@app.delete("/banks/{bank_id}", tags=["Bancos"], dependencies=[Depends(require_editor)])
def delete_bank(bank_id: UUID, db: Session = Depends(get_db)):
    obj = crud.delete_bank(db, bank_id)
    if not obj:
        raise HTTPException(404, "Cuenta no encontrada")
    return {"ok": True}


# ── Receivables (CXC) ──────────────────────────────────────────
@app.get("/receivables", response_model=List[schemas.ReceivableOut], tags=["CXC"], dependencies=[Depends(get_current_user)])
def list_receivables(status: Optional[str] = None, db: Session = Depends(get_db)):
    return crud.get_receivables(db, status=status)

@app.post("/receivables", response_model=schemas.ReceivableOut, tags=["CXC"], dependencies=[Depends(require_editor)])
def create_receivable(data: schemas.ReceivableCreate, db: Session = Depends(get_db)):
    return crud.create_receivable(db, data)

@app.put("/receivables/{rec_id}", response_model=schemas.ReceivableOut, tags=["CXC"], dependencies=[Depends(require_editor)])
def update_receivable(rec_id: UUID, data: schemas.ReceivableUpdate, db: Session = Depends(get_db)):
    obj = crud.update_receivable(db, rec_id, data)
    if not obj:
        raise HTTPException(404, "Registro no encontrado")
    return obj

@app.delete("/receivables/{rec_id}", tags=["CXC"], dependencies=[Depends(require_editor)])
def delete_receivable(rec_id: UUID, db: Session = Depends(get_db)):
    obj = crud.delete_receivable(db, rec_id)
    if not obj:
        raise HTTPException(404, "Registro no encontrado")
    return {"ok": True}


# ── Payables (CXP) ─────────────────────────────────────────────
@app.get("/payables", response_model=List[schemas.PayableOut], tags=["CXP"], dependencies=[Depends(get_current_user)])
def list_payables(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return crud.get_payables(db, status=status, priority=priority)

@app.post("/payables", response_model=schemas.PayableOut, tags=["CXP"], dependencies=[Depends(require_editor)])
def create_payable(data: schemas.PayableCreate, db: Session = Depends(get_db)):
    return crud.create_payable(db, data)

@app.put("/payables/{pay_id}", response_model=schemas.PayableOut, tags=["CXP"], dependencies=[Depends(require_editor)])
def update_payable(pay_id: UUID, data: schemas.PayableUpdate, db: Session = Depends(get_db)):
    obj = crud.update_payable(db, pay_id, data)
    if not obj:
        raise HTTPException(404, "Registro no encontrado")
    return obj

@app.delete("/payables/{pay_id}", tags=["CXP"], dependencies=[Depends(require_editor)])
def delete_payable(pay_id: UUID, db: Session = Depends(get_db)):
    obj = crud.delete_payable(db, pay_id)
    if not obj:
        raise HTTPException(404, "Registro no encontrado")
    return {"ok": True}


# ── Debt Obligations ───────────────────────────────────────────
@app.get("/debt", response_model=List[schemas.DebtOut], tags=["Deuda"], dependencies=[Depends(get_current_user)])
def list_debt(db: Session = Depends(get_db)):
    return crud.get_debts(db)

@app.post("/debt", response_model=schemas.DebtOut, tags=["Deuda"], dependencies=[Depends(require_editor)])
def create_debt(data: schemas.DebtCreate, db: Session = Depends(get_db)):
    return crud.create_debt(db, data)

@app.put("/debt/{debt_id}", response_model=schemas.DebtOut, tags=["Deuda"], dependencies=[Depends(require_editor)])
def update_debt(debt_id: UUID, data: schemas.DebtUpdate, db: Session = Depends(get_db)):
    obj = crud.update_debt(db, debt_id, data)
    if not obj:
        raise HTTPException(404, "Registro no encontrado")
    return obj

@app.delete("/debt/{debt_id}", tags=["Deuda"], dependencies=[Depends(require_editor)])
def delete_debt(debt_id: UUID, db: Session = Depends(get_db)):
    obj = crud.delete_debt(db, debt_id)
    if not obj:
        raise HTTPException(404, "Registro no encontrado")
    return {"ok": True}


# ── Others ─────────────────────────────────────────────────────
@app.get("/others", response_model=List[OtherOut], tags=["Otros"], dependencies=[Depends(get_current_user)])
def list_others(
    direction: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return crud.get_others(db, direction=direction, category=category)

@app.post("/others", response_model=OtherOut, tags=["Otros"], dependencies=[Depends(require_editor)])
def create_other(data: schemas.OtherCreate, db: Session = Depends(get_db)):
    return crud.create_other(db, data)

@app.put("/others/{other_id}", response_model=OtherOut, tags=["Otros"], dependencies=[Depends(require_editor)])
def update_other(other_id: UUID, data: schemas.OtherUpdate, db: Session = Depends(get_db)):
    obj = crud.update_other(db, other_id, data)
    if not obj:
        raise HTTPException(404, "Registro no encontrado")
    return obj

@app.delete("/others/{other_id}", tags=["Otros"], dependencies=[Depends(require_editor)])
def delete_other(other_id: UUID, db: Session = Depends(get_db)):
    obj = crud.delete_other(db, other_id)
    if not obj:
        raise HTTPException(404, "Registro no encontrado")
    return {"ok": True}




# ── Payables with priority score ──────────────────────────────────
@app.get("/payables/scored", tags=["CXP"], dependencies=[Depends(get_current_user)])
def list_payables_scored(
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    from datetime import date
    today = date.today()
    payables = crud.get_payables(db, status=status)
    result = []
    for p in payables:
        score = crud.calc_payment_score(p, today)
        d = schemas.PayableOut.model_validate(p).model_dump()
        d["score"] = score
        d["score_label"] = "critical" if score >= 70 else "warning" if score >= 40 else "normal"
        result.append(d)
    result.sort(key=lambda x: x["score"], reverse=True)
    return result


@app.get("/health", tags=["Sistema"])
def health():
    return {"status": "ok", "app": "Dreamart Cash Control v1"}


# -- Daily CFO Report --
from report_service import send_daily_report

@app.post("/report/send-daily", tags=["Reportes"], dependencies=[Depends(require_editor)])
def send_daily_report_endpoint(
    fx_rate: float = Query(default=17.5),
    db: Session = Depends(get_db)
):
    return send_daily_report(db, fx_rate)

@app.get("/report/preview-daily", tags=["Reportes"], dependencies=[Depends(get_current_user)])
def preview_daily_report(
    fx_rate: float = Query(default=17.5),
    db: Session = Depends(get_db)
):
    from report_service import generate_daily_report
    return generate_daily_report(db, fx_rate)