#!/usr/bin/env python3
"""Generate a PDF invoice for work hours for a given week."""
import sqlite3
import sys
import os
from datetime import datetime, timedelta
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
DB = Path(os.getenv("DB_PATH", BASE / "data" / "lar.db"))
TEMPLATE = BASE / "template" / "invoice_template.html"
OUTPUT_DIR = BASE / "data" / "invoices"
WORKER_NAME = os.getenv("WORKER_NAME", "worker")


def get_db():
    con = sqlite3.connect(str(DB))
    con.row_factory = sqlite3.Row
    return con


def week_range(date=None):
    """Return (monday, sunday) for the week containing `date`."""
    if date is None:
        date = datetime.now()
    monday = date - timedelta(days=date.weekday())
    sunday = monday + timedelta(days=6)
    return monday.strftime("%Y-%m-%d"), sunday.strftime("%Y-%m-%d")


def next_invoice_number(con):
    row = con.execute("SELECT MAX(invoice_number) as n FROM invoices").fetchone()
    return (row["n"] or 0) + 1


def generate(week_of=None, force=False):
    """Generate invoice for the week containing `week_of` date string (YYYY-MM-DD)."""
    if week_of:
        dt = datetime.strptime(week_of, "%Y-%m-%d")
    else:
        # Default: last completed week (previous Sunday)
        today = datetime.now()
        last_sun = today - timedelta(days=today.weekday() + 1)
        dt = last_sun

    mon, sun = week_range(dt)
    end_query = (datetime.strptime(sun, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")

    con = get_db()

    # Ensure invoices table exists
    con.execute("""CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number INTEGER UNIQUE NOT NULL,
        week_start TEXT NOT NULL,
        week_end TEXT NOT NULL,
        total REAL NOT NULL,
        pdf_path TEXT,
        created TEXT NOT NULL
    )""")
    con.commit()

    # Check if already generated
    existing = con.execute("SELECT * FROM invoices WHERE week_start=?", [mon]).fetchone()
    if existing and not force:
        print(f"Invoice #{existing['invoice_number']} already exists for week {mon} to {sun}")
        print(f"  PDF: {existing['pdf_path']}")
        return existing["pdf_path"]

    # Get work log entries for the week
    logs = con.execute(
        "SELECT * FROM work_log WHERE person=? AND date >= ? AND date < ? ORDER BY date",
        [WORKER_NAME, mon, end_query]
    ).fetchall()

    if not logs:
        print(f"No work logged for week {mon} to {sun}")
        con.close()
        return None

    # Calculate total invoice amount
    total = sum(l["invoice_amount"] or 0 for l in logs)

    if total <= 0:
        print(f"No invoice amount for week {mon} to {sun}")
        con.close()
        return None

    inv_num = next_invoice_number(con) if not existing else existing["invoice_number"]

    # Format dates for display
    mon_dt = datetime.strptime(mon, "%Y-%m-%d")
    sun_dt = datetime.strptime(sun, "%Y-%m-%d")
    inv_date = sun_dt.strftime("%-d/%m/%Y")
    start_display = mon_dt.strftime("%-d/%m/%Y")
    end_display = sun_dt.strftime("%-d/%m/%Y")

    # Build line item
    line_items = f'<tr><td>{start_display}</td><td>{end_display}</td><td>Services rendered</td><td>${logs[0]["rate"]:.0f}/hr</td><td>${total:,.2f}</td></tr>'

    # Render template if available
    if TEMPLATE.exists():
        html = TEMPLATE.read_text()
        html = html.replace("{{invoice_number}}", str(inv_num))
        html = html.replace("{{invoice_date}}", inv_date)
        html = html.replace("{{line_items}}", line_items)
        html = html.replace("{{subtotal}}", f"${total:,.2f}")
        html = html.replace("{{total}}", f"${total:,.2f}")

        # Embed images as base64 if present
        import base64
        logo_path = BASE / "template" / "logo.png"
        sig_path = BASE / "template" / "signature.png"
        if logo_path.exists():
            b64 = base64.b64encode(logo_path.read_bytes()).decode()
            html = html.replace("{{logo_data}}", f"data:image/png;base64,{b64}")
        if sig_path.exists():
            b64 = base64.b64encode(sig_path.read_bytes()).decode()
            html = html.replace("{{signature_data}}", f"data:image/png;base64,{b64}")
    else:
        # Simple HTML fallback
        html = f"<html><body><h1>Invoice #{inv_num}</h1><p>Date: {inv_date}</p><p>Period: {start_display} - {end_display}</p><p>Total: ${total:,.2f}</p></body></html>"

    # Generate PDF
    year_dir = OUTPUT_DIR / str(mon_dt.year)
    year_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = year_dir / f"inv{inv_num}_{mon}_{sun}.pdf"

    try:
        from weasyprint import HTML
        HTML(string=html).write_pdf(str(pdf_path))
    except ImportError:
        # Fallback: save HTML
        html_path = year_dir / f"inv{inv_num}_{mon}_{sun}.html"
        html_path.write_text(html)
        pdf_path = html_path
        print("⚠️  weasyprint not installed, saved as HTML instead")

    # Save to DB
    if existing:
        con.execute("UPDATE invoices SET total=?, pdf_path=?, created=? WHERE id=?",
                    [total, str(pdf_path), datetime.now().isoformat(), existing["id"]])
    else:
        con.execute("INSERT INTO invoices (invoice_number, week_start, week_end, total, pdf_path, created) VALUES (?,?,?,?,?,?)",
                    [inv_num, mon, sun, total, str(pdf_path), datetime.now().isoformat()])
    con.commit()
    con.close()

    print(f"✅ Invoice #{inv_num} generated")
    print(f"   Week: {mon} to {sun}")
    print(f"   Total: ${total:,.2f}")
    print(f"   PDF: {pdf_path}")

    return str(pdf_path)


if __name__ == "__main__":
    date_arg = sys.argv[1] if len(sys.argv) > 1 else None
    force = "--force" in sys.argv
    generate(date_arg, force)
