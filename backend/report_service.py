import smtplib
import os
from dotenv import load_dotenv
load_dotenv()
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import date, timedelta
from sqlalchemy.orm import Session
import models
from currency import to_usd

GMAIL_USER = "dreamartcontraloria@gmail.com"
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")
RECIPIENTS = ["jlebrija@dreamartphotography.com", "sescalante@dreamartphotography.com"]

def fmt(n): return f"${n:,.0f}"

def generate_daily_report(db: Session, fx_rate: float = 17.5) -> dict:
    today = date.today()
    yesterday = today - timedelta(days=1)
    next_week = today + timedelta(days=7)

    from sqlalchemy import func as sqlfunc

    # Saldos bancarios
    latest_date = db.query(sqlfunc.max(models.BankPosition.position_date)).scalar()
    positions = db.query(models.BankPosition).filter(models.BankPosition.position_date == latest_date).all() if latest_date else []
    total_banks = sum(to_usd(p.balance_available, p.currency, fx_rate) for p in positions)

    # Saldo ayer
    prev_positions = db.query(models.BankPosition).filter(models.BankPosition.position_date == yesterday).all()
    total_banks_yesterday = sum(to_usd(p.balance_available, p.currency, fx_rate) for p in prev_positions)
    bank_change = total_banks - total_banks_yesterday

    # Saldo anteayer (para calcular ventas de ayer)
    day_before = today - timedelta(days=2)
    day_before_positions = db.query(models.BankPosition).filter(models.BankPosition.position_date == day_before).all()
    total_banks_day_before = sum(to_usd(p.balance_available, p.currency, fx_rate) for p in day_before_positions)

    # Pagos de ayer
    payments_yesterday = db.query(models.Payment).filter(models.Payment.payment_date == yesterday).all()
    total_paid_yesterday = sum(to_usd(p.amount, p.currency, fx_rate) for p in payments_yesterday)

    # Ventas generales de ayer (inferidas)
    # ventas = saldo_cierre_ayer - saldo_inicio_ayer + pagos_ayer
    sales_yesterday = round(max(total_banks_yesterday - total_banks_day_before + total_paid_yesterday, 0), 2)

    # Pagos de hoy
    payments_today = db.query(models.Payment).filter(models.Payment.payment_date == today).all()
    total_paid_today = sum(to_usd(p.amount, p.currency, fx_rate) for p in payments_today)

    # CXP urgente esta semana
    payables = db.query(models.Payable).filter(
        models.Payable.status.in_(["pendiente","programado","parcial"]),
        models.Payable.due_date <= next_week
    ).all()
    total_due_week = sum(to_usd(float(p.amount)-float(p.amount_paid or 0), p.currency, fx_rate) for p in payables)
    alta_payables = [p for p in payables if str(p.priority).replace("CXPPriority.","") == "alta"]

    # CXC vencida
    receivables_overdue = db.query(models.Receivable).filter(
        models.Receivable.status.in_(["pendiente","parcial","vencido"]),
        models.Receivable.due_date < today
    ).all()
    total_overdue_cxc = sum(to_usd(float(r.amount)-float(r.amount_paid or 0), r.currency, fx_rate) for r in receivables_overdue)

    # Forecast simple
    all_payables = db.query(models.Payable).filter(
        models.Payable.status.in_(["pendiente","programado","parcial"]),
        models.Payable.due_date <= today + timedelta(days=30)
    ).all()
    total_outflows_30d = sum(to_usd(float(p.amount)-float(p.amount_paid or 0), p.currency, fx_rate) for p in all_payables)
    projected_balance = total_banks - total_outflows_30d

    # Runway
    daily_burn = total_outflows_30d / 30 if total_outflows_30d > 0 else 1
    runway_days = int(total_banks / daily_burn) if daily_burn > 0 else 999

    # Top 3 pagos urgentes
    top_payments = sorted(alta_payables, key=lambda x: (x.due_date or date.max))[:3]

    # Top 3 cobros vencidos
    top_collections = sorted(receivables_overdue, key=lambda x: to_usd(float(x.amount)-float(x.amount_paid or 0), x.currency, fx_rate), reverse=True)[:3]

    return {
        "date": str(today),
        "total_banks": total_banks,
        "total_banks_yesterday": total_banks_yesterday,
        "total_banks_day_before": total_banks_day_before,
        "total_paid_yesterday": total_paid_yesterday,
        "payments_yesterday": payments_yesterday,
        "sales_yesterday": sales_yesterday,
        "date_yesterday": str(yesterday),
        "inferred_inflow": round(max((total_banks - total_banks_yesterday) + total_paid_today, 0), 2),
        "bank_change": bank_change,
        "total_paid_today": total_paid_today,
        "payments_today": payments_today,
        "total_due_week": total_due_week,
        "total_overdue_cxc": total_overdue_cxc,
        "projected_balance_30d": projected_balance,
        "runway_days": runway_days,
        "top_payments": top_payments,
        "top_collections": top_collections,
        "fx_rate": fx_rate
    }

def build_html_report(data: dict) -> str:
    today_str = data["date"]
    change_color = "#059669" if data["bank_change"] >= 0 else "#dc2626"
    change_arrow = "▲" if data["bank_change"] >= 0 else "▼"
    runway_color = "#059669" if data["runway_days"] > 30 else "#dc2626"
    proj_color = "#059669" if data["projected_balance_30d"] >= 0 else "#dc2626"

    top_payments_html = ""
    for p in data["top_payments"]:
        bal = float(p.amount) - float(p.amount_paid or 0)
        top_payments_html += f"""
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;">{p.vendor_name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;">{p.due_date}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#dc2626;font-weight:500;">{fmt(to_usd(bal, p.currency, data["fx_rate"]))}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;">{p.country or "--"}</td>
        </tr>"""

    top_collections_html = ""
    for r in data["top_collections"]:
        bal = float(r.amount) - float(r.amount_paid or 0)
        top_collections_html += f"""
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;">{r.client_name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;">{r.due_date}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#059669;font-weight:500;">{fmt(to_usd(bal, r.currency, data["fx_rate"]))}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;">{r.country or "--"}</td>
        </tr>"""

    payments_today_html = ""
    for p in data["payments_today"][:5]:
        payments_today_html += f"<li style='margin:4px 0;font-size:13px;'>{p.vendor_name} — {fmt(to_usd(p.amount, p.currency, data['fx_rate']))}</li>"

    payments_section = ""
    if data["payments_today"]:
        payments_section = f'''<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;">
      <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 12px;">Payments made today</p>
      <ul style="margin:0;padding-left:16px;">{payments_today_html}</ul>
    </div>'''

    # Build payments rows
    payments_rows_html = ""
    for p in data["payments_yesterday"]:
        payments_rows_html += f'''<tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:6px 0 6px 16px;font-size:12px;color:#dc2626;">- {p.vendor_name}</td>
          <td style="padding:6px 0;font-size:12px;text-align:right;color:#dc2626;">-{fmt(to_usd(p.amount, p.currency, data["fx_rate"]))} USD</td>
        </tr>'''
    if not data["payments_yesterday"]:
        payments_rows_html = '''<tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:8px 0;font-size:13px;color:#dc2626;">- Pagos registrados</td>
          <td style="padding:8px 0;font-size:13px;text-align:right;color:#dc2626;">-$0 USD</td>
        </tr>'''

    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;">

    <div style="background:#111827;borderRadius:12px;padding:24px;marginBottom:20px;border-radius:12px;">
      <p style="color:#9ca3af;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">Dreamart Photography Group</p>
      <h1 style="color:#f9fafb;font-size:22px;margin:0 0 4px;">Daily CFO Report</h1>
      <p style="color:#6b7280;font-size:13px;margin:0;">{today_str}</p>
    </div>

    <div style="display:grid;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;">
      <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 8px;">Liquidity position</p>
      <p style="font-size:32px;font-weight:500;color:#1e40af;margin:0;">{fmt(data["total_banks"])} USD</p>
      <p style="font-size:13px;color:{change_color};margin:6px 0 0;">{change_arrow} {fmt(abs(data["bank_change"]))} vs yesterday</p>
    </div>

    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;">
      <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 4px;">Cierre de ayer</p>
      <p style="font-size:11px;color:#9ca3af;margin:0 0 12px;">{data["date_yesterday"]}</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:8px 0;font-size:13px;color:#6b7280;">Saldo inicio del dia</td>
          <td style="padding:8px 0;font-size:13px;text-align:right;font-weight:500;">{fmt(data["total_banks_day_before"])} USD</td>
        </tr>
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:8px 0;font-size:13px;color:#dc2626;">- Pagos registrados</td>
          <td style="padding:8px 0;font-size:13px;text-align:right;font-weight:500;color:#dc2626;">-{fmt(data["total_paid_yesterday"])} USD</td>
        </tr>
        {payments_rows_html}
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:8px 0;font-size:13px;color:#059669;">+ Ventas generales</td>
          <td style="padding:8px 0;font-size:13px;text-align:right;font-weight:500;color:#059669;">+{fmt(data["sales_yesterday"])} USD</td>
        </tr>
        <tr style="border-top:2px solid #e5e7eb;">
          <td style="padding:10px 0;font-size:13px;font-weight:500;">Saldo cierre ayer</td>
          <td style="padding:10px 0;font-size:13px;text-align:right;font-weight:500;color:#1e40af;">{fmt(data["total_banks_yesterday"])} USD</td>
        </tr>
      </table>
    </div>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;">
      <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 12px;">Hoy — {data["date"]}</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:8px 0;font-size:13px;font-weight:500;">Saldo actual</td>
          <td style="padding:8px 0;font-size:14px;text-align:right;font-weight:500;color:#1e40af;">{fmt(data["total_banks"])} USD</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#6b7280;">Variacion vs ayer</td>
          <td style="padding:8px 0;font-size:13px;text-align:right;font-weight:500;color:{'#059669' if data['bank_change'] >= 0 else '#dc2626'};">{"+" if data["bank_change"] >= 0 else ""}{fmt(data["bank_change"])} USD</td>
        </tr>
      </table>
    </div>

    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:16px;overflow:hidden;">
      <tr>
        <td style="padding:16px 20px;border-right:1px solid #f3f4f6;">
          <p style="font-size:11px;color:#6b7280;text-transform:uppercase;margin:0 0 6px;">Due this week (CXP)</p>
          <p style="font-size:20px;font-weight:500;color:#dc2626;margin:0;">{fmt(data["total_due_week"])}</p>
        </td>
        <td style="padding:16px 20px;border-right:1px solid #f3f4f6;">
          <p style="font-size:11px;color:#6b7280;text-transform:uppercase;margin:0 0 6px;">Overdue CXC</p>
          <p style="font-size:20px;font-weight:500;color:#92400e;margin:0;">{fmt(data["total_overdue_cxc"])}</p>
        </td>
        <td style="padding:16px 20px;">
          <p style="font-size:11px;color:#6b7280;text-transform:uppercase;margin:0 0 6px;">Runway</p>
          <p style="font-size:20px;font-weight:500;color:{runway_color};margin:0;">{data["runway_days"]} days</p>
        </td>
      </tr>
    </table>

    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;">
      <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 8px;">30-day projection</p>
      <p style="font-size:20px;font-weight:500;color:{proj_color};margin:0;">{fmt(data["projected_balance_30d"])} USD</p>
      <p style="font-size:12px;color:#9ca3af;margin:4px 0 0;">After all known payables</p>
    </div>

    {payments_section}

    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;">
      <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 12px;">🔴 Priority payments this week</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="background:#f9fafb;">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;">Vendor</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;">Due</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;">Amount</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;">Country</th>
        </tr>
        {top_payments_html if top_payments_html else "<tr><td colspan='4' style='padding:12px;color:#9ca3af;font-size:13px;'>No high priority payments this week</td></tr>"}
      </table>
    </div>

    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;">
      <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 12px;">🟡 Top overdue collections</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="background:#f9fafb;">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;">Client</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;">Due date</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;">Amount</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;">Country</th>
        </tr>
        {top_collections_html if top_collections_html else "<tr><td colspan='4' style='padding:12px;color:#9ca3af;font-size:13px;'>No overdue collections</td></tr>"}
      </table>
    </div>

    <div style="background:#111827;border-radius:12px;padding:16px 20px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">Dreamart Cash Control · <a href="https://cash.dreamartworkingcapital.com" style="color:#3b82f6;">Open dashboard</a></p>
    </div>

  </div>
</body>
</html>"""

def send_daily_report(db: Session, fx_rate: float = 17.5):
    try:
        data = generate_daily_report(db, fx_rate)
        html = build_html_report(data)
        change_str = f"+{fmt(data['bank_change'])}" if data['bank_change'] >= 0 else fmt(data['bank_change'])
        subject = f"☀️ Daily CFO Report — {data['date']} | Banks: {fmt(data['total_banks'])} USD ({change_str})"

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = GMAIL_USER
        msg["To"] = ", ".join(RECIPIENTS)
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_USER, RECIPIENTS, msg.as_string())

        return {"ok": True, "sent_to": RECIPIENTS, "subject": subject}
    except Exception as e:
        return {"ok": False, "error": str(e)}