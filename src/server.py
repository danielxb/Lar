import os
import re
from pathlib import Path
from flask import Flask, jsonify, send_file, request
import sqlite3
from datetime import datetime, timedelta
import logging
import shutil

PROJECT_ROOT = Path(os.getenv("PROJECT_ROOT", Path(__file__).parent.parent))
DEMO_MODE = os.getenv("DEMO_MODE", "0") == "1"
DB_PATH = Path(os.getenv("DB_PATH", PROJECT_ROOT / "data" / ("demo.db" if DEMO_MODE else "lar.db")))
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", PROJECT_ROOT / "data" / "inbox"))
PROCESSED_DIR = Path(os.getenv("PROCESSED_DIR", PROJECT_ROOT / "data" / "processed"))

app = Flask(__name__, static_folder=str(PROJECT_ROOT / "static"))
app.secret_key = os.getenv("SECRET_KEY", "change-me-in-production")
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


def get_db():
    con = sqlite3.connect(str(DB_PATH))
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    return con


def init_db():
    con = sqlite3.connect(str(DB_PATH))
    con.executescript("""
        CREATE TABLE IF NOT EXISTS purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            created TEXT NOT NULL,
            person TEXT DEFAULT 'shared',
            receipt_file TEXT,
            qty REAL DEFAULT 1,
            unit TEXT,
            payment_method TEXT DEFAULT 'card',
            work_related INTEGER DEFAULT 0,
            original_total REAL
        );
        CREATE TABLE IF NOT EXISTS recurring (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            person TEXT DEFAULT 'shared',
            frequency TEXT DEFAULT 'monthly',
            active INTEGER DEFAULT 1,
            remind INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS savings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_name TEXT NOT NULL,
            balance REAL NOT NULL,
            currency TEXT DEFAULT 'AUD',
            include_in_total INTEGER DEFAULT 1,
            updated TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS work_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            person TEXT NOT NULL,
            date TEXT NOT NULL,
            hours REAL NOT NULL,
            rate REAL,
            note TEXT,
            receipt_file TEXT
        );
    """)
    # Add columns if missing
    cols = [r[1] for r in con.execute("PRAGMA table_info(purchases)").fetchall()]
    if "person" not in cols:
        con.execute("ALTER TABLE purchases ADD COLUMN person TEXT DEFAULT 'shared'")
    if "receipt_file" not in cols:
        con.execute("ALTER TABLE purchases ADD COLUMN receipt_file TEXT")
    if "qty" not in cols:
        con.execute("ALTER TABLE purchases ADD COLUMN qty REAL DEFAULT 1")
    if "unit" not in cols:
        con.execute("ALTER TABLE purchases ADD COLUMN unit TEXT")
    # Savings migrations
    scols = [r[1] for r in con.execute("PRAGMA table_info(savings)").fetchall()]
    if "account_type" not in scols:
        con.execute("ALTER TABLE savings ADD COLUMN account_type TEXT DEFAULT 'savings'")
    # Recurring migrations
    rcols = [r[1] for r in con.execute("PRAGMA table_info(recurring)").fetchall()]
    if "start_date" not in rcols:
        con.execute("ALTER TABLE recurring ADD COLUMN start_date TEXT")
    # Budgets table
    con.execute("""CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL UNIQUE,
        monthly_limit REAL NOT NULL,
        frequency TEXT DEFAULT 'monthly',
        alert_thresholds TEXT DEFAULT '90,100'
    )""")
    # Shopping list table
    con.execute("""CREATE TABLE IF NOT EXISTS shopping_list (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item TEXT NOT NULL,
        checked INTEGER DEFAULT 0,
        added_by TEXT DEFAULT 'user',
        created TEXT NOT NULL
    )""")
    con.execute("""CREATE TABLE IF NOT EXISTS savings_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        target REAL NOT NULL,
        current REAL DEFAULT 0,
        deadline TEXT,
        created TEXT NOT NULL
    )""")
    # Work log migrations
    wcols = [r[1] for r in con.execute("PRAGMA table_info(work_log)").fetchall()]
    if "cash_amount" not in wcols:
        con.execute("ALTER TABLE work_log ADD COLUMN cash_amount REAL DEFAULT 0")
    if "invoice_amount" not in wcols:
        con.execute("ALTER TABLE work_log ADD COLUMN invoice_amount REAL DEFAULT 0")
    con.commit()
    con.close()
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


@app.route("/")
def index():
    return send_file(PROJECT_ROOT / "static" / "index.html")


# ─── Purchases ───────────────────────────────────────────────────────────────

def _get_json():
    """Get JSON body or return None (caller should check and return 400)."""
    return request.get_json(force=True, silent=True) or {}



CATEGORY_KEYWORDS = {
    "Groceries": ["woolworths", "woolies", "coles", "aldi", "groceries", "supermarket", "mercado", "supermercado"],
    "Food": ["coffee", "cafe", "lunch", "dinner", "breakfast", "maccas", "mcdonalds", "kfc", "takeaway", "restaurant", "uber eats", "ubereats", "doordash", "almoco", "almoço", "janta", "jantar", "lanche", "comida"],
    "Food:Coffee": ["coffee", "cafe", "café"],
    "Transport": ["uber", "fuel", "petrol", "parking", "toll", "train", "opal", "bus", "gasolina", "estacionamento", "transporte"],
    "Entertainment": ["netflix", "spotify", "disney", "youtube", "cinema", "movie", "gaming", "filme", "jogo"],
    "Housing": ["rent", "mortgage", "aluguel"],
    "Bills": ["electricity", "gas", "water", "internet", "phone", "mobile", "luz", "agua", "água", "telefone"],
    "Insurance": ["insurance", "rego", "seguro"],
    "Health": ["doctor", "pharmacy", "dentist", "gym", "physio", "medico", "médico", "farmacia", "farmácia", "academia"],
    "Personal": ["haircut", "barber", "clothing", "clothes", "roupa", "cabelo", "barbeiro"],
    "Income": ["salary", "pay", "income", "freelance", "teaching", "salario", "salário", "pagamento"],
}


def _parse_quick(text, default_person="person1"):
    """Parse 'coffee 5.50' or 'woolworths 97 groceries shared' into purchase dict."""
    text = text.strip().lower()
    # Extract amount (look for number pattern)
    amount_match = re.search(r'\$?([\d]+\.?\d*)', text)
    if not amount_match:
        return None
    amount = float(amount_match.group(1))
    remaining = text[:amount_match.start()] + text[amount_match.end():]
    remaining = remaining.strip().strip('$').strip()

    # Extract person
    # Extract person (including Portuguese)
    person = default_person
    person_map = {"shared": "shared", "compartilhado": "shared", "dividido": "shared",
                  "person1": "person1", "person2": "person2",
                  "group": "group", "grupo": "group", "galera": "group", "turma": "group"}
    for keyword, p_val in person_map.items():
        if keyword in remaining:
            person = p_val
            remaining = remaining.replace(keyword, "").strip()
            break

    # Extract/infer category (check specific sub-categories first)
    category = "Uncategorized"
    sorted_cats = sorted(CATEGORY_KEYWORDS.items(), key=lambda x: (':' in x[0], len(x[0])), reverse=True)
    for cat, keywords in sorted_cats:
        for kw in keywords:
            if kw in remaining:
                category = cat
                break
        if category != "Uncategorized":
            break

    # Item name = whatever's left, or the category
    item = remaining.strip(" ,-·") or category.split(":")[0].title()

    # Determine if income
    words = text.split()
    is_income = category == "Income" or any(w in words for w in ["income", "paid", "earned", "salary", "salario", "pagamento", "recebi"])
    amount = amount if is_income else -amount

    return {"item": item.title(), "amount": amount, "category": category, "person": person}


@app.route("/api/purchases")
def api_purchases():
    start = request.args.get("start")
    end = request.args.get("end")
    category = request.args.get("category")
    person = request.args.get("person")

    query = "SELECT id, item, amount, category, created, person, receipt_file, qty, unit, payment_method, work_related, original_total FROM purchases WHERE 1=1"
    params = []
    if start: query += " AND created >= ?"; params.append(start)
    if end: query += " AND created < ?"; params.append(end)
    if category: query += " AND category = ?"; params.append(category)
    if person and person != "all": query += " AND (person = ? OR person = 'shared')"; params.append(person)
    wr = request.args.get("work_related")
    if wr: query += " AND work_related = 1"
    query += " ORDER BY created DESC"

    con = get_db()
    rows = con.execute(query, params).fetchall()
    con.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/summary")
def api_summary():
    start = request.args.get("start")
    end = request.args.get("end")
    person = request.args.get("person")

    query = "SELECT amount, category, person FROM purchases WHERE 1=1"
    params = []
    if start: query += " AND created >= ?"; params.append(start)
    if end: query += " AND created < ?"; params.append(end)
    if person and person != "all": query += " AND (person = ? OR person = 'shared')"; params.append(person)

    con = get_db()
    rows = con.execute(query, params).fetchall()
    con.close()

    income = sum(r["amount"] for r in rows if r["amount"] > 0)
    expenses = sum(r["amount"] for r in rows if r["amount"] < 0)
    categories = {}
    for r in rows:
        categories[r["category"]] = categories.get(r["category"], 0) + r["amount"]

    return jsonify({"income": income, "expenses": expenses, "balance": income + expenses, "categories": categories, "count": len(rows)})


@app.route("/api/daily")
def api_daily():
    start = request.args.get("start")
    end = request.args.get("end")
    person = request.args.get("person")

    query = "SELECT amount, category, date(created) as day FROM purchases WHERE 1=1"
    params = []
    if start: query += " AND created >= ?"; params.append(start)
    if end: query += " AND created < ?"; params.append(end)
    if person and person != "all": query += " AND (person = ? OR person = 'shared')"; params.append(person)

    con = get_db()
    rows = con.execute(query, params).fetchall()
    con.close()

    days = {}
    for r in rows:
        d = r["day"]
        if d not in days: days[d] = {"income": 0, "expenses": 0}
        if r["amount"] > 0: days[d]["income"] += r["amount"]
        else: days[d]["expenses"] += r["amount"]
    for d in days: days[d]["balance"] = days[d]["income"] + days[d]["expenses"]
    return jsonify(days)


@app.route("/api/categories")
def api_categories():
    con = get_db()
    rows = con.execute("SELECT DISTINCT category FROM purchases ORDER BY category").fetchall()
    con.close()
    return jsonify([r["category"] for r in rows])


# ─── Recurring ───────────────────────────────────────────────────────────────

@app.route("/api/recurring")
def api_recurring():
    con = get_db()
    rows = con.execute("SELECT * FROM recurring WHERE active=1 ORDER BY person, category").fetchall()
    con.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/recurring", methods=["POST"])
def add_recurring():
    d = _get_json()
    con = get_db()
    con.execute("INSERT INTO recurring (item, amount, category, person, frequency, start_date, remind) VALUES (?,?,?,?,?,?,?)",
               [d["item"], d["amount"], d["category"], d.get("person", "shared"), d.get("frequency", "monthly"), d.get("start_date"), d.get("remind", 0)])
    con.commit()
    con.close()
    return jsonify({"ok": True})


@app.route("/api/recurring/<int:rid>", methods=["DELETE"])
def del_recurring(rid):
    con = get_db()
    con.execute("UPDATE recurring SET active=0 WHERE id=?", [rid])
    con.commit()
    con.close()
    return jsonify({"ok": True})


@app.route("/api/recurring/<int:rid>", methods=["PUT"])
def update_recurring(rid):
    d = _get_json()
    con = get_db()
    # Get old values for syncing applied purchase
    old = dict(con.execute("SELECT * FROM recurring WHERE id=?", [rid]).fetchone())
    sets, params = [], []
    for field in ["item", "amount", "category", "person", "frequency", "start_date", "remind"]:
        if field in d: sets.append(f"{field}=?"); params.append(d[field])
    if sets:
        params.append(rid)
        con.execute(f"UPDATE recurring SET {','.join(sets)} WHERE id=?", params)

        # Sync the applied purchase for this month
        today = datetime.now()
        month_start = today.strftime("%Y-%m-01")
        applied = con.execute(
            "SELECT id, amount FROM purchases WHERE receipt_file=? AND created>=?",
            [f"recurring:{rid}", month_start]
        ).fetchone()

        new_start = d.get("start_date", old.get("start_date"))
        # If start_date is now in the future, delete the applied purchase
        if new_start and new_start[:7] > today.strftime("%Y-%m"):
            if applied:

                con.execute("DELETE FROM purchases WHERE id=?", [applied["id"]])
        elif applied:
            # Update the applied purchase to match new values
            new_item = d.get("item", old["item"])
            new_amount = d.get("amount", old["amount"])
            new_cat = d.get("category", old["category"])
            new_person = d.get("person", old["person"])
            new_date = new_start if (new_start and new_start[:7] == today.strftime("%Y-%m")) else applied["id"] and today.strftime("%Y-%m-%d")
            # Adjust balance for amount change
            con.execute("UPDATE purchases SET item=?, amount=?, category=?, person=?, created=? WHERE id=?",
                       [new_item, new_amount, new_cat, new_person, new_date, applied["id"]])

        con.commit()
    con.close()
    return jsonify({"ok": True})


@app.route("/api/recurring/apply", methods=["POST"])
def apply_recurring():
    """Apply recurring items based on frequency. Idempotent per period."""
    today = datetime.now()
    today_str = today.strftime("%Y-%m-%d")
    con = get_db()
    recurring = con.execute("SELECT * FROM recurring WHERE active=1").fetchall()
    applied = 0
    for r in recurring:
        # Skip if start_date is after today
        if r["start_date"] and r["start_date"] > today_str:
            continue
        freq = r["frequency"] or "monthly"
        # Determine the check window based on frequency
        if freq == "weekly":
            # Check if applied in last 6 days (covers any day of the week)
            check_since = (today - timedelta(days=6)).strftime("%Y-%m-%d")
        elif freq == "fortnightly":
            # Check if applied in last 13 days
            check_since = (today - timedelta(days=13)).strftime("%Y-%m-%d")
        elif freq == "quarterly":
            # Check if applied in last 89 days (~3 months)
            check_since = (today - timedelta(days=89)).strftime("%Y-%m-%d")
        elif freq == "yearly":
            # Check if applied in last 364 days
            check_since = (today - timedelta(days=364)).strftime("%Y-%m-%d")
        else:
            # monthly: check this month
            check_since = today.strftime("%Y-%m-01")
        exists = con.execute(
            "SELECT 1 FROM purchases WHERE receipt_file=? AND created>=?",
            [f"recurring:{r['id']}", check_since]
        ).fetchone()
        if not exists:
            # Use start_date only for the very first application, otherwise today
            any_prev = con.execute("SELECT 1 FROM purchases WHERE receipt_file=?", [f"recurring:{r['id']}"]).fetchone()
            apply_date = today_str
            if not any_prev and r["start_date"] and r["start_date"][:7] == today.strftime("%Y-%m") and r["start_date"] <= today_str:
                apply_date = r["start_date"]
            con.execute(
                "INSERT INTO purchases (item, amount, category, person, created, receipt_file) VALUES (?,?,?,?,?,?)",
                [r["item"], r["amount"], r["category"], r["person"], apply_date, f"recurring:{r['id']}"]
            )

            applied += 1
    con.commit()
    con.close()
    return jsonify({"applied": applied, "total": len(recurring)})


# ─── Savings ─────────────────────────────────────────────────────────────────

@app.route("/api/savings")
def api_savings():
    con = get_db()
    rows = con.execute("SELECT * FROM savings ORDER BY account_name").fetchall()
    con.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/savings", methods=["POST"])
def add_savings():
    d = _get_json()
    con = get_db()
    con.execute("INSERT INTO savings (account_name, balance, currency, include_in_total, account_type, updated) VALUES (?,?,?,?,?,?)",
               [d["account_name"], d["balance"], d.get("currency", "AUD"), d.get("include_in_total", 1), d.get("account_type", "savings"), datetime.now().isoformat()])
    con.commit()
    con.close()
    return jsonify({"ok": True})


@app.route("/api/savings/<int:sid>", methods=["PUT"])
def update_savings(sid):
    d = _get_json()
    con = get_db()
    sets, params = [], []
    if "balance" in d: sets.append("balance=?"); params.append(d["balance"])
    if "currency" in d: sets.append("currency=?"); params.append(d["currency"])
    if "include_in_total" in d: sets.append("include_in_total=?"); params.append(d["include_in_total"])
    if "account_type" in d: sets.append("account_type=?"); params.append(d["account_type"])
    if "account_name" in d: sets.append("account_name=?"); params.append(d["account_name"])
    sets.append("updated=?"); params.append(datetime.now().isoformat())
    params.append(sid)
    con.execute(f"UPDATE savings SET {','.join(sets)} WHERE id=?", params)
    con.commit()
    con.close()
    return jsonify({"ok": True})


@app.route("/api/savings/<int:sid>", methods=["DELETE"])
def delete_savings(sid):
    con = get_db()
    con.execute("DELETE FROM savings WHERE id=?", [sid])
    con.commit()
    con.close()
    return jsonify({"ok": True})


@app.route("/api/transfer", methods=["POST"])
def transfer():
    """Transfer between accounts. {from_id, to_id, amount}"""
    d = _get_json()
    if not d.get("from_id") or not d.get("to_id") or not d.get("amount"):
        return jsonify({"error": "Missing from_id, to_id, or amount"}), 400
    con = get_db()
    from_acct = con.execute("SELECT id FROM savings WHERE id=?", [d["from_id"]]).fetchone()
    to_acct = con.execute("SELECT id FROM savings WHERE id=?", [d["to_id"]]).fetchone()
    if not from_acct or not to_acct:
        con.close()
        return jsonify({"error": "Account not found"}), 404
    con.execute("UPDATE savings SET balance=balance-?, updated=? WHERE id=?",
               [d["amount"], datetime.now().isoformat(), d["from_id"]])
    con.execute("UPDATE savings SET balance=balance+?, updated=? WHERE id=?",
               [d["amount"], datetime.now().isoformat(), d["to_id"]])
    con.commit()
    con.close()
    return jsonify({"ok": True})


@app.route("/api/rates")
def api_rates():
    """Get exchange rates to AUD. Cached for 1 hour."""
    import urllib.request, json as j
    cache_file = PROJECT_ROOT / "data" / ".rates_cache.json"
    # Check cache
    if cache_file.exists():
        try:
            cached = j.loads(cache_file.read_text())
            if datetime.fromisoformat(cached["fetched"]) > datetime.now() - timedelta(hours=1):
                return jsonify(cached["rates"])
        except (j.JSONDecodeError, KeyError, ValueError):
            pass
    # Fetch from free API (no key needed)
    try:
        url = "https://open.er-api.com/v6/latest/AUD"
        with urllib.request.urlopen(url, timeout=5) as resp:
            data = j.loads(resp.read())
        rates = data.get("rates", {})
        # We want: how many AUD is 1 unit of foreign currency
        # API gives: how many foreign per 1 AUD. Invert.
        to_aud = {"AUD": 1.0}
        for cur in ["EUR", "BRL", "USD", "GBP"]:
            if cur in rates and rates[cur] > 0:
                to_aud[cur] = round(1.0 / rates[cur], 4)
        cache_file.write_text(j.dumps({"fetched": datetime.now().isoformat(), "rates": to_aud}))
        return jsonify(to_aud)
    except Exception:
        # Fallback rates if API fails
        return jsonify({"AUD": 1.0, "EUR": 1.72, "BRL": 0.30, "USD": 0.65, "GBP": 2.0})


# ─── Work Log ─────────────────────────────────────────────────────────

@app.route("/api/worklog")
def api_worklog():
    person = request.args.get("person", os.getenv("WORKER_NAME", "worker"))
    start = request.args.get("start")
    end = request.args.get("end")

    query = "SELECT * FROM work_log WHERE person=?"
    params = [person]
    if start: query += " AND date >= ?"; params.append(start)
    if end: query += " AND date < ?"; params.append(end)
    query += " ORDER BY date DESC"

    con = get_db()
    rows = con.execute(query, params).fetchall()
    con.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/worklog", methods=["POST"])
def add_worklog():
    d = _get_json()
    cash = d.get("cash_amount", 0)
    invoice = d.get("invoice_amount", 0)
    # If neither specified but rate given, default all to invoice
    if not cash and not invoice and d.get("rate") and d.get("hours"):
        invoice = d["hours"] * d["rate"]
    con = get_db()
    # Check for duplicate (same person+date) — update instead of insert
    existing = con.execute("SELECT id, cash_amount FROM work_log WHERE person=? AND date=?",
                           [d.get("person", os.getenv("WORKER_NAME", "worker")), d["date"]]).fetchone()
    if existing:
        old_cash = existing["cash_amount"] or 0
        con.execute("UPDATE work_log SET hours=?, rate=?, note=?, cash_amount=?, invoice_amount=? WHERE id=?",
                    [d["hours"], d.get("rate"), d.get("note"), cash, invoice, existing["id"]])
        # Remove old cash transaction and reverse balance
        if old_cash > 0:
            worker = d.get("person", os.getenv("WORKER_NAME", "worker"))
            con.execute("DELETE FROM purchases WHERE item=? AND amount=? AND created LIKE ? AND LOWER(category)='income:cash'",
                        [f"Work cash ({worker})", old_cash, d["date"] + "%"])
            cash_acct = con.execute("SELECT id FROM savings WHERE account_name LIKE '%cash%' AND account_type='everyday' LIMIT 1").fetchone()
    else:
        worker = d.get("person", os.getenv("WORKER_NAME", "worker"))
        con.execute("INSERT INTO work_log (person, date, hours, rate, note, cash_amount, invoice_amount) VALUES (?,?,?,?,?,?,?)",
                    [worker, d["date"], d["hours"], d.get("rate"), d.get("note"), cash, invoice])
    # If cash received, create income transaction (but don't adjust balance — manual)
    if cash > 0:
        # Record as income transaction for visibility in Finance
        worker = d.get("person", os.getenv("WORKER_NAME", "worker"))
        con.execute("INSERT INTO purchases (item, amount, category, person, created, payment_method) VALUES (?,?,?,?,?,?)",
                    [f"Work cash ({worker})", cash, "Income:Cash", worker, d["date"], "cash"])
    con.commit()
    con.close()
    return jsonify({"ok": True})


# ─── Invoices ────────────────────────────────────────────────────────────────

@app.route("/api/invoices")
def list_invoices():
    con = get_db()
    con.execute("""CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number INTEGER UNIQUE NOT NULL,
        week_start TEXT NOT NULL, week_end TEXT NOT NULL,
        total REAL NOT NULL, pdf_path TEXT, created TEXT NOT NULL)""")
    con.commit()
    rows = con.execute("SELECT * FROM invoices ORDER BY invoice_number DESC").fetchall()
    con.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/invoices/generate", methods=["POST"])
def generate_invoice():
    d = _get_json() or {}
    week_of = d.get("week_of")  # optional YYYY-MM-DD
    import subprocess
    cmd = ["python3", str(Path(__file__).parent.parent / "scripts" / "generate_invoice.py")]
    if week_of:
        cmd.append(week_of)
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        return jsonify({"error": result.stderr}), 500
    return jsonify({"ok": True, "output": result.stdout.strip()})


@app.route("/api/invoices/<int:inv_id>/pdf")
def get_invoice_pdf(inv_id):
    con = get_db()
    row = con.execute("SELECT pdf_path FROM invoices WHERE id=?", [inv_id]).fetchone()
    con.close()
    if not row or not row["pdf_path"]:
        return "Not found", 404
    from flask import send_file
    return send_file(row["pdf_path"], mimetype="application/pdf")


# ─── Weather ──────────────────────────────────────────────────────────────────

_weather_cache = {"data": None, "ts": 0}

@app.route("/api/weather")
def api_weather():
    """Weather from Open-Meteo (cached 30 min). Configure LAT/LON via env."""
    import urllib.request, json as j, time as t
    if _weather_cache["data"] and t.time() - _weather_cache["ts"] < 1800:
        return jsonify(_weather_cache["data"])
    lat = os.getenv("WEATHER_LAT", "-33.87")
    lon = os.getenv("WEATHER_LON", "151.21")
    tz = os.getenv("TZ", "Australia/Sydney").replace("/", "%2F")
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone={tz}&forecast_days=5"
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            data = j.loads(r.read())
            _weather_cache["data"] = data
            _weather_cache["ts"] = t.time()
            return jsonify(data)
    except Exception as e:
        if _weather_cache["data"]:
            return jsonify(_weather_cache["data"])
        return jsonify({"error": str(e)}), 502


@app.route("/api/weather/hourly")
def api_weather_hourly():
    """Tomorrow's hourly forecast. Configure LAT/LON via env."""
    import urllib.request, json as j
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    lat = os.getenv("WEATHER_LAT", "-33.87")
    lon = os.getenv("WEATHER_LON", "151.21")
    tz = os.getenv("TZ", "Australia/Sydney").replace("/", "%2F")
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m&timezone={tz}&start_date={tomorrow}&end_date={tomorrow}"
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            return j.loads(r.read()), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 502


# ─── System Stats ─────────────────────────────────────────────────────────────

@app.route("/api/system")
def api_system():
    """Read system stats from host-written JSON file."""
    p = PROJECT_ROOT / "data" / "system_stats.json"
    if p.exists():
        return p.read_text(), 200, {"Content-Type": "application/json"}
    return jsonify({"error": "No stats available. Host script not running."}), 404


# ─── Roadmap ──────────────────────────────────────────────────────────────────

@app.route("/api/roadmap")
def api_roadmap():
    mp = PROJECT_ROOT / "docs" / "MASTERPLAN.md"
    if mp.exists():
        return mp.read_text(), 200, {"Content-Type": "text/plain; charset=utf-8"}
    return "No roadmap found", 404


# ─── Tax Export ───────────────────────────────────────────────────────────────

@app.route("/api/tax-export")
def tax_export():
    """Export work-related purchases as CSV for tax/accountant."""
    start = request.args.get("start", "2000-01-01")
    end = request.args.get("end", "2099-12-31")
    con = get_db()
    rows = con.execute(
        "SELECT item, amount, category, person, created, payment_method FROM purchases WHERE work_related=1 AND created>=? AND created<? ORDER BY created",
        [start, end]
    ).fetchall()
    con.close()
    import io, csv
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Item", "Amount", "Category", "Person", "Payment Method"])
    for r in rows:
        writer.writerow([r["created"], r["item"], abs(r["amount"]), r["category"], r["person"], r["payment_method"]])
    from flask import Response
    return Response(output.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": f"attachment; filename=work_expenses_{start}_{end}.csv"})


# ─── Receipt Processing ──────────────────────────────────────────────────────

@app.route("/api/receipt/process", methods=["POST"])
def process_receipt():
    """Process a receipt PDF from to_process/ folder. Auto-parses and adds items.
    
    File naming convention for traceability:
      processed/YYYY-MM/YYYY-MM-DD_STORE_TOTAL_ITEMCOUNT_ORIGHASH.pdf
    
    Example: processed/2026-05/2026-05-02_woolworths-store_97.75_22items_a3f8.pdf
    
    Returns flagged items that couldn't be classified for manual review.
    """
    import hashlib
    data = _get_json()
    filename = data.get("filename")
    if not filename:
        return jsonify({"error": "filename required"}), 400

    src = UPLOAD_DIR / filename
    if not src.exists():
        return jsonify({"error": f"Not found: {filename}"}), 404

    # Parse the receipt
    try:
        from parsers.receipt_parser import parse_receipt_pdf
        result = parse_receipt_pdf(str(src))
    except Exception as e:
        return jsonify({"error": f"Parse failed: {str(e)}"}), 500

    # Insert items into purchases with receipt traceability
    con = get_db()
    added = 0

    # Generate receipt ID early to check for duplicates
    receipt_hash = hashlib.md5(f"{filename}{result['date']}".encode()).hexdigest()[:8]
    store_slug = re.sub(r"[^a-z0-9]+", "-", result["store"].lower().split("ph:")[0].strip())[:20].strip("-")
    if not store_slug or store_slug[0].isdigit():
        store_slug = "woolworths" if "woolworth" in filename.lower() or "1377" in result["store"] else store_slug or "unknown"
    item_count = len([i for i in result["items"] if i["subcategory"] != "discount"])
    receipt_id = f"{result['date']}_{store_slug}_{result['total']:.2f}_{item_count}_{receipt_hash}"

    # Check if already processed
    existing = con.execute("SELECT COUNT(*) as c FROM purchases WHERE receipt_file=?", [receipt_id]).fetchone()
    if existing["c"] > 0:
        con.close()
        return jsonify({"ok": True, "message": "Already processed", "receipt_id": receipt_id, "items_added": 0})
    for item in result["items"]:
        created = f"{result['date']} 12:00:00" if result["date"] else datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        qty = item.get("weight_kg") or item.get("qty", 1)
        unit = "kg" if item.get("weight_kg") else "ea"
        subcat = item["subcategory"]
        # Skip discounts (amount=0, they're free)
        if subcat == "discount":
            continue
        # Gift cards are their own category
        if subcat == "giftcard":
            cat = "Gift Cards"
        else:
            cat = f"Groceries:{subcat.title()}"
        con.execute(
            "INSERT INTO purchases (item, amount, category, created, person, receipt_file, qty, unit) VALUES (?,?,?,?,?,?,?,?)",
            [item["name"], -item["amount"], cat, created, "shared", receipt_id, qty, unit]
        )
        added += 1
    con.commit()
    con.close()

    # Robust file naming: YYYY-MM-DD_store_total_itemcount_hash.ext
    date_str = result["date"][:7] if result["date"] else datetime.now().strftime("%Y-%m")
    target_dir = PROCESSED_DIR / date_str
    target_dir.mkdir(parents=True, exist_ok=True)
    
    store_slug = re.sub(r"[^a-z0-9]+", "-", result["store"].lower().split("ph:")[0].strip())[:30].strip("-")
    new_name = f"{result['date']}_{store_slug}_{result['total']:.2f}_{added}items_{receipt_hash}{src.suffix}"
    
    shutil.move(str(src), str(target_dir / new_name))

    response = {
        "ok": True,
        "receipt_id": receipt_id,
        "items_added": added,
        "total": result["total"],
        "savings": result["savings"],
        "store": result["store"],
        "date": result["date"],
        "moved_to": str(target_dir / new_name),
    }
    
    # Flag unclassified items for review
    if result.get("needs_review"):
        response["needs_review"] = True
        response["unclassified_items"] = [
            {"name": item["name"], "amount": item["amount"]}
            for item in result["unclassified"]
        ]
        response["message"] = f"⚠️ {len(result['unclassified'])} item(s) couldn't be classified. Please review and add keywords to receipt_parser.py"
    
    return jsonify(response)


@app.route("/api/receipt/pending")
def pending_receipts():
    """List files waiting in to_process/."""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    files = [f.name for f in UPLOAD_DIR.iterdir() if f.is_file() and not f.name.startswith(".")]
    return jsonify(files)


@app.route("/api/receipt/upload", methods=["POST"])
def receipt_upload():
    """Upload a file to the inbox."""
    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400
    f = request.files["file"]
    if not f.filename:
        return jsonify({"error": "No filename"}), 400
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    dest = UPLOAD_DIR / f.filename
    f.save(str(dest))
    return jsonify({"ok": True, "filename": f.filename})


@app.route("/api/receipt/history")
def receipt_history():
    """List processed receipts with traceability info."""
    receipts = []
    if PROCESSED_DIR.exists():
        for month_dir in sorted(PROCESSED_DIR.iterdir(), reverse=True):
            if month_dir.is_dir():
                for f in sorted(month_dir.iterdir(), reverse=True):
                    if f.is_file():
                        receipts.append({"path": str(f.relative_to(PROCESSED_DIR)), "name": f.name, "month": month_dir.name})
    return jsonify(receipts)


@app.route("/api/purchases", methods=["POST"])
@app.route("/api/purchases/quick", methods=["POST"])
def add_purchase():
    d = _get_json()
    # Quick-add: parse natural language
    if "text" in d:
        parsed = _parse_quick(d["text"], d.get("person", "person1"))
        if not parsed:
            return jsonify({"error": "Couldn't parse. Try: 'coffee 5.50' or 'woolworths 97 groceries'"}), 400
        d = parsed
    # Validate required fields
    if not d.get("item") or d.get("amount") is None or not d.get("category"):
        return jsonify({"error": "Missing required fields: item, amount, category"}), 400
    con = get_db()
    pm = d.get("payment_method", "card")
    wr = 1 if d.get("work_related") else 0
    ot = d.get("original_total")
    rf = d.get("receipt_file")
    con.execute("INSERT INTO purchases (item, amount, category, created, person, payment_method, work_related, original_total, receipt_file) VALUES (?,?,?,?,?,?,?,?,?)",
               [d["item"], d["amount"], d["category"], d.get("created", datetime.now().strftime("%Y-%m-%d %H:%M:%S")), d.get("person", "shared"), pm, wr, ot, rf])
    con.commit()
    con.close()
    return jsonify({"ok": True})


@app.route("/api/purchases/<int:pid>", methods=["DELETE"])
def delete_purchase(pid):
    con = get_db()
    row = con.execute("SELECT id FROM purchases WHERE id=?", [pid]).fetchone()
    if row:
        con.execute("DELETE FROM purchases WHERE id=?", [pid])
        con.commit()
    con.close()
    return jsonify({"ok": True})


@app.route("/api/purchases/<int:pid>", methods=["PUT"])
def edit_purchase(pid):
    d = _get_json()
    con = get_db()
    old = con.execute("SELECT amount, payment_method FROM purchases WHERE id=?", [pid]).fetchone()
    if not old:
        con.close()
        return jsonify({"error": "Not found"}), 404
    sets, params = [], []
    for field in ["item", "amount", "category", "person", "created", "work_related", "original_total", "payment_method"]:
        if field in d: sets.append(f"{field}=?"); params.append(d[field])
    if sets:
        params.append(pid)
        con.execute(f"UPDATE purchases SET {','.join(sets)} WHERE id=?", params)
        # Adjust balance for amount change
        if "amount" in d:
            old_pm = old["payment_method"] or "card"
            # Balances are manual — no auto-adjustment on edit
        con.commit()
    con.close()
    return jsonify({"ok": True})


@app.route("/api/fortnightly")
def api_fortnightly():
    """Get savings per fortnightly pay period. Assumes pay day is every other Thursday."""
    con = get_db()
    rows = con.execute("SELECT amount, category, date(created) as day FROM purchases ORDER BY created").fetchall()
    con.close()

    if not rows:
        return jsonify([])

    # Group into 14-day periods starting from first entry
    from datetime import date as dt_date
    first = datetime.strptime(rows[0]["day"], "%Y-%m-%d").date()
    # Align to nearest Thursday
    days_to_thu = (3 - first.weekday()) % 7
    period_start = first + timedelta(days=days_to_thu)
    if period_start > first:
        period_start -= timedelta(days=14)

    periods = []
    current_end = period_start + timedelta(days=14)
    period_data = {"start": str(period_start), "end": str(current_end), "income": 0, "expenses": 0}

    for r in rows:
        row_date = datetime.strptime(r["day"], "%Y-%m-%d").date()
        while row_date >= current_end:
            period_data["saved"] = period_data["income"] + period_data["expenses"]
            periods.append(period_data)
            period_start = current_end
            current_end = period_start + timedelta(days=14)
            period_data = {"start": str(period_start), "end": str(current_end), "income": 0, "expenses": 0}

        if r["amount"] > 0:
            period_data["income"] += r["amount"]
        else:
            period_data["expenses"] += r["amount"]

    period_data["saved"] = period_data["income"] + period_data["expenses"]
    periods.append(period_data)
    return jsonify(periods)


# Legacy
@app.route("/purchases")
def purchases_legacy():
    return api_purchases()


@app.route("/api/purchases/grouped")
def api_purchases_grouped():
    """Get purchases grouped by receipt (for receipt-based entries) + individual items.
    Items with a receipt_file are grouped into one entry per receipt.
    Items without receipt_file show individually.
    """
    start = request.args.get("start")
    end = request.args.get("end")
    person = request.args.get("person")

    query = "SELECT id, item, amount, category, created, person, receipt_file, qty, unit, payment_method, work_related, original_total FROM purchases WHERE 1=1"
    params = []
    if start: query += " AND created >= ?"; params.append(start)
    if end: query += " AND created < ?"; params.append(end)
    if person and person != "all": query += " AND (person = ? OR person = 'shared')"; params.append(person)
    query += " ORDER BY created DESC"

    con = get_db()
    rows = con.execute(query, params).fetchall()
    con.close()

    # Group by receipt_file
    receipts = {}
    individual = []
    for r in rows:
        r = dict(r)
        if r.get("receipt_file") and r["receipt_file"] and not r["receipt_file"].startswith("recurring"):
            rid = r["receipt_file"]
            if rid not in receipts:
                receipts[rid] = {"receipt_id": rid, "items": [], "total": 0, "date": r["created"], "category": "groceries"}
            receipts[rid]["items"].append(r)
            receipts[rid]["total"] += r["amount"]
        else:
            individual.append(r)

    # Build grouped list
    grouped = []
    for rid, data in receipts.items():
        # Extract store from receipt filename: YYYY-MM-DD_store_total_count_hash.pdf
        store = "Unknown"
        parts = rid.replace(".pdf", "").split("_")
        if len(parts) >= 2:
            store = parts[1].replace("-", " ").title()
        date = data["date"].split(" ")[0] if data["date"] else ""
        time_str = data["date"].split(" ")[1][:5] if " " in (data["date"] or "") else ""
        grouped.append({
            "type": "receipt",
            "receipt_id": rid,
            "store": store,
            "date": date,
            "time": time_str,
            "total": data["total"],
            "item_count": len(data["items"]),
            "items": data["items"],
            "category": "groceries",
        })

    for r in individual:
        grouped.append({
            "type": "single",
            "id": r["id"],
            "item": r["item"],
            "amount": r["amount"],
            "category": r["category"],
            "date": r["created"].split(" ")[0] if r["created"] else "",
            "time": r["created"].split(" ")[1][:5] if " " in (r["created"] or "") else "",
            "person": r.get("person", "shared"),
            "recurring": (r.get("receipt_file") or "").startswith("recurring"),
            "work_related": r.get("work_related", 0),
            "payment_method": r.get("payment_method", "card"),
            "original_total": r.get("original_total"),
        })

    # Sort by date desc
    grouped.sort(key=lambda x: x.get("date", ""), reverse=True)
    return jsonify(grouped)


# ─── Budgets ──────────────────────────────────────────────────────────────────

@app.route("/api/budgets")
def api_budgets():
    con = get_db()
    budgets = [dict(r) for r in con.execute("SELECT * FROM budgets ORDER BY category").fetchall()]
    # Get current month spending per category
    now = datetime.now()
    # Calculate spending window based on each budget's frequency
    for b in budgets:
        freq = b.get("frequency") or "monthly"
        if freq == "weekly":
            start = (now - timedelta(days=now.weekday())).strftime("%Y-%m-%d")
        elif freq == "fortnightly":
            start = (now - timedelta(days=13)).strftime("%Y-%m-%d")
        elif freq == "yearly":
            start = now.strftime("%Y-01-01")
        else:
            start = now.strftime("%Y-%m-01")
        spent = 0
        for r in con.execute("SELECT category, SUM(amount) as total FROM purchases WHERE created>=? AND amount<0 GROUP BY category", [start]).fetchall():
            base = r["category"].split(":")[0]
            if base == b["category"] or r["category"] == b["category"]:
                spent += abs(r["total"])
        b["spent"] = spent
        b["pct"] = min(100, spent / b["monthly_limit"] * 100) if b["monthly_limit"] else 0
    con.close()
    return jsonify(budgets)


@app.route("/api/budgets", methods=["POST"])
def add_budget():
    d = _get_json()
    con = get_db()
    con.execute("INSERT OR REPLACE INTO budgets (category, monthly_limit, frequency, alert_thresholds) VALUES (?,?,?,?)",
               [d["category"], d["monthly_limit"], d.get("frequency", "monthly"), d.get("alert_thresholds", "90,100")])
    con.commit()
    con.close()
    return jsonify({"ok": True})


@app.route("/api/budgets/<int:bid>", methods=["DELETE"])
def delete_budget(bid):
    con = get_db()
    con.execute("DELETE FROM budgets WHERE id=?", [bid])
    con.commit()
    con.close()
    return jsonify({"ok": True})


# ─── Savings Goals ────────────────────────────────────────────────────────────

@app.route("/api/goals")
def api_goals():
    con = get_db()
    rows = con.execute("SELECT * FROM savings_goals ORDER BY deadline").fetchall()
    con.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/goals", methods=["POST"])
def add_goal():
    d = _get_json()
    if not d.get("name") or not d.get("target"):
        return jsonify({"error": "Missing name or target"}), 400
    con = get_db()
    con.execute("INSERT INTO savings_goals (name, target, current, deadline, created) VALUES (?,?,?,?,?)",
               [d["name"], d["target"], d.get("current", 0), d.get("deadline"), datetime.now().isoformat()])
    con.commit()
    con.close()
    return jsonify({"ok": True})


@app.route("/api/goals/<int:gid>", methods=["PUT"])
def update_goal(gid):
    d = _get_json()
    con = get_db()
    sets, params = [], []
    for field in ["name", "target", "current", "deadline"]:
        if field in d: sets.append(f"{field}=?"); params.append(d[field])
    if sets:
        params.append(gid)
        con.execute(f"UPDATE savings_goals SET {','.join(sets)} WHERE id=?", params)
        con.commit()
    con.close()
    return jsonify({"ok": True})


@app.route("/api/goals/<int:gid>", methods=["DELETE"])
def delete_goal(gid):
    con = get_db()
    con.execute("DELETE FROM savings_goals WHERE id=?", [gid])
    con.commit()
    con.close()
    return jsonify({"ok": True})


# ─── Shopping List ────────────────────────────────────────────────────────────

@app.route("/api/shopping")
def api_shopping():
    con = get_db()
    rows = con.execute("SELECT * FROM shopping_list ORDER BY checked, created DESC").fetchall()
    con.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/shopping", methods=["POST"])
def add_shopping():
    d = _get_json()
    con = get_db()
    con.execute("INSERT INTO shopping_list (item, added_by, created) VALUES (?,?,?)",
               [d["item"], d.get("added_by", "user"), datetime.now().isoformat()])
    con.commit()
    con.close()
    return jsonify({"ok": True})


@app.route("/api/shopping/<int:sid>", methods=["PUT"])
def toggle_shopping(sid):
    con = get_db()
    con.execute("UPDATE shopping_list SET checked = NOT checked WHERE id=?", [sid])
    con.commit()
    con.close()
    return jsonify({"ok": True})


@app.route("/api/shopping/<int:sid>", methods=["DELETE"])
def delete_shopping(sid):
    con = get_db()
    con.execute("DELETE FROM shopping_list WHERE id=?", [sid])
    con.commit()
    con.close()
    return jsonify({"ok": True})


@app.route("/api/shopping/clear", methods=["POST"])
def clear_checked_shopping():
    """Remove all checked items."""
    con = get_db()
    con.execute("DELETE FROM shopping_list WHERE checked=1")
    con.commit()
    con.close()
    return jsonify({"ok": True})


# ─── Demo Mode ────────────────────────────────────────────────────────────────

@app.route("/api/demo/status")
def demo_status():
    return jsonify({"demo": "demo.db" in str(DB_PATH)})


@app.route("/api/demo/toggle", methods=["POST"])
def demo_toggle():
    """Switch between lar.db and demo.db. Requires container restart."""
    global DB_PATH
    if "demo.db" in str(DB_PATH):
        DB_PATH = PROJECT_ROOT / "data" / "lar.db"
        mode = "real"
    else:
        DB_PATH = PROJECT_ROOT / "data" / "demo.db"
        init_db()  # ensure demo.db has schema
        _seed_demo()
        mode = "demo"
    return jsonify({"mode": mode})


def _seed_demo():
    """Populate demo.db with fake data if empty."""
    from random import uniform, randint
    con = get_db()
    if con.execute("SELECT COUNT(*) FROM purchases").fetchone()[0] > 0:
        con.close()
        return
    now = datetime.now()
    items = [
        ("Woolworths", -85.50, "groceries", "shared"),
        ("Coles", -62.30, "groceries", "shared"),
        ("Uber Eats", -34.90, "food", "person1"),
        ("Petrol", -78.00, "transport", "shared"),
        ("Netflix", -22.99, "entertainment", "shared"),
        ("Electricity", -145.00, "bills", "shared"),
        ("Coffee", -5.50, "food", "person1"),
        ("Pharmacy", -18.75, "health", "person2"),
        ("Gym", -29.99, "health", "person1"),
        ("Lunch", -16.50, "food", "person2"),
        ("Aldi", -45.20, "groceries", "shared"),
        ("Parking", -12.00, "transport", "person1"),
        ("Haircut", -35.00, "personal", "person2"),
        ("Internet", -89.00, "bills", "shared"),
        ("Spotify", -12.99, "entertainment", "shared"),
        ("Opal Card", -40.00, "transport", "person1"),
        ("Dentist", -95.00, "health", "shared"),
        ("Wine", -22.00, "groceries:alcohol", "shared"),
        ("Uber", -18.50, "transport", "person2"),
        ("Takeaway", -28.00, "food", "shared"),
    ]
    for item, base_amt, cat, person in items:
        day = max(1, now.day - randint(0, 27))
        date = f"{now.year}-{now.month:02d}-{day:02d}"
        amt = round(base_amt * uniform(0.8, 1.2), 2)
        con.execute("INSERT INTO purchases (item, amount, category, person, created) VALUES (?,?,?,?,?)",
                    [item, amt, cat, person, date])
    for name, bal in [("Everyday Account", 3000.00), ("Savings AUD", 2500.00), ("Savings BRL", 500.00)]:
        con.execute("INSERT INTO savings (account_name, balance, currency, include_in_total, updated) VALUES (?,?,?,?,?)",
                    [name, bal, "AUD", 1, now.strftime("%Y-%m-%d")])
    for item, amt, cat, freq in [("Rent", -2200, "housing", "monthly"), ("Car Insurance", -180, "insurance", "monthly"), ("Spotify", -12.99, "entertainment", "monthly"), ("Salary", 7500, "income", "monthly")]:
        con.execute("INSERT INTO recurring (item, amount, category, person, frequency) VALUES (?,?,?,?,?)",
                    [item, amt, cat, "shared", freq])
    con.commit()
    con.close()


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=7777, debug=False)
