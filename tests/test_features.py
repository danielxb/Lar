"""Comprehensive tests for Lar API."""
import json
import pytest


# ─── Quick-Add Parser ─────────────────────────────────────────────────────────

def test_quick_add_coffee(client):
    """'coffee 5.50' → Food:Coffee, -5.50"""
    r = client.post("/api/purchases/quick", json={"text": "coffee 5.50"})
    assert r.status_code == 200
    data = json.loads(client.get("/api/purchases?start=2000-01-01&end=2099-01-01").data)
    assert len(data) == 1
    assert data[0]["amount"] == -5.50
    assert "Coffee" in data[0]["category"] or "Food" in data[0]["category"]


def test_quick_add_income(client):
    """'salary 3000' → Income, +3000"""
    r = client.post("/api/purchases/quick", json={"text": "salary 3000"})
    assert r.status_code == 200
    data = json.loads(client.get("/api/purchases?start=2000-01-01&end=2099-01-01").data)
    assert data[0]["amount"] == 3000


def test_quick_add_no_amount(client):
    """No amount → 400 error"""
    r = client.post("/api/purchases/quick", json={"text": "just words"})
    assert r.status_code == 400


def test_quick_add_prepaid_not_income(client):
    """'prepaid phone 30' should NOT be income (word 'paid' inside 'prepaid')"""
    r = client.post("/api/purchases/quick", json={"text": "prepaid phone 30"})
    assert r.status_code == 200
    data = json.loads(client.get("/api/purchases?start=2000-01-01&end=2099-01-01").data)
    assert data[0]["amount"] < 0  # Should be expense


# ─── Delete + Balance Reversal ────────────────────────────────────────────────

def test_delete_reverses_everyday_balance(client):
    """Deleting a purchase does NOT change account balance (manual balances)."""
    # Setup everyday account
    client.post("/api/savings", json={"account_name": "Everyday", "balance": 1000, "currency": "AUD", "account_type": "everyday"})
    # Add expense
    client.post("/api/purchases", json={"item": "Lunch", "amount": -20, "category": "Food", "person": "person1"})
    # Balance unchanged
    accts = json.loads(client.get("/api/savings").data)
    assert accts[0]["balance"] == 1000
    # Delete it
    purchases = json.loads(client.get("/api/purchases?start=2000-01-01&end=2099-01-01").data)
    client.delete(f"/api/purchases/{purchases[0]['id']}")
    # Still unchanged
    accts = json.loads(client.get("/api/savings").data)
    assert accts[0]["balance"] == 1000


def test_delete_purchase(client):
    """Deleting a purchase removes it from the database."""
    client.post("/api/purchases", json={"item": "Market", "amount": -15, "category": "Food", "person": "person2", "payment_method": "cash"})
    purchases = json.loads(client.get("/api/purchases?start=2000-01-01&end=2099-01-01").data)
    assert len(purchases) == 1
    client.delete(f"/api/purchases/{purchases[0]['id']}")
    purchases = json.loads(client.get("/api/purchases?start=2000-01-01&end=2099-01-01").data)
    assert len(purchases) == 0


# ─── Edit Purchase ────────────────────────────────────────────────────────────

def test_edit_purchase_adjusts_balance(client):
    """Editing amount does NOT adjust everyday balance (manual balances)."""
    client.post("/api/savings", json={"account_name": "Everyday", "balance": 1000, "currency": "AUD", "account_type": "everyday"})
    client.post("/api/purchases", json={"item": "Uber", "amount": -10, "category": "Transport", "person": "person1"})
    purchases = json.loads(client.get("/api/purchases?start=2000-01-01&end=2099-01-01").data)
    pid = purchases[0]["id"]
    # Edit: change from -10 to -25
    client.put(f"/api/purchases/{pid}", json={"amount": -25})
    accts = json.loads(client.get("/api/savings").data)
    assert accts[0]["balance"] == 1000  # Balance unchanged (manual only)


def test_edit_purchase_work_related(client):
    """Can toggle work_related via PUT."""
    client.post("/api/purchases", json={"item": "Clothes", "amount": -50, "category": "Personal", "person": "person2"})
    purchases = json.loads(client.get("/api/purchases?start=2000-01-01&end=2099-01-01").data)
    pid = purchases[0]["id"]
    assert purchases[0]["work_related"] == 0
    client.put(f"/api/purchases/{pid}", json={"work_related": 1})
    purchases = json.loads(client.get("/api/purchases?start=2000-01-01&end=2099-01-01").data)
    assert purchases[0]["work_related"] == 1


# ─── Work Log ─────────────────────────────────────────────────────────────────

def test_worklog_upsert(client):
    """Logging same person+date twice updates instead of duplicating."""
    client.post("/api/worklog", json={"person": "person2", "date": "2026-05-08", "hours": 5, "rate": 30, "cash_amount": 0, "invoice_amount": 170})
    client.post("/api/worklog", json={"person": "person2", "date": "2026-05-08", "hours": 7, "rate": 30, "cash_amount": 100, "invoice_amount": 138})
    data = json.loads(client.get("/api/worklog?person=person2&start=2026-05-01&end=2026-05-31").data)
    assert len(data) == 1
    assert data[0]["hours"] == 7


def test_worklog_cash_creates_transaction(client):
    """Cash from work creates an income transaction (balance unchanged — manual)."""
    client.post("/api/savings", json={"account_name": "Cash", "balance": 100, "currency": "AUD", "account_type": "everyday"})
    client.post("/api/worklog", json={"person": "person2", "date": "2026-05-08", "hours": 5, "rate": 30, "cash_amount": 80, "invoice_amount": 90})
    # Check income transaction created
    purchases = json.loads(client.get("/api/purchases?start=2026-05-08&end=2026-05-09").data)
    cash_tx = [p for p in purchases if "Work cash" in p["item"]]
    assert len(cash_tx) == 1
    assert cash_tx[0]["amount"] == 80
    # Cash account unchanged (manual)
    accts = json.loads(client.get("/api/savings").data)
    cash = [a for a in accts if a["account_name"] == "Cash"][0]
    assert cash["balance"] == 100


# ─── Recurring Apply ──────────────────────────────────────────────────────────

def test_recurring_weekly_applies_once_per_week(client):
    """Weekly recurring applies once per Mon-Sun window."""
    client.post("/api/savings", json={"account_name": "Everyday", "balance": 1000, "currency": "AUD", "account_type": "everyday"})
    client.post("/api/recurring", json={"item": "Car Loan", "amount": -100, "category": "Bills", "frequency": "weekly", "person": "shared", "start_date": "2026-01-01"})
    # Apply twice — should only create one
    client.post("/api/recurring/apply")
    client.post("/api/recurring/apply")
    purchases = json.loads(client.get("/api/purchases?start=2000-01-01&end=2099-01-01").data)
    assert len(purchases) == 1
    assert purchases[0]["amount"] == -100


def test_recurring_skips_future_start_date(client):
    """Recurring with future start_date is not applied."""
    client.post("/api/recurring", json={"item": "Future Bill", "amount": -50, "category": "Bills", "frequency": "monthly", "person": "shared", "start_date": "2099-01-01"})
    client.post("/api/recurring/apply")
    purchases = json.loads(client.get("/api/purchases?start=2000-01-01&end=2099-01-01").data)
    assert len(purchases) == 0


def test_recurring_idempotent_by_id(client):
    """Two recurring items with same name+amount don't collide."""
    client.post("/api/savings", json={"account_name": "Everyday", "balance": 1000, "currency": "AUD", "account_type": "everyday"})
    client.post("/api/recurring", json={"item": "Transfer", "amount": -500, "category": "Bills", "frequency": "monthly", "person": "shared", "start_date": "2026-01-01"})
    client.post("/api/recurring", json={"item": "Transfer", "amount": -500, "category": "Bills", "frequency": "monthly", "person": "person1", "start_date": "2026-01-01"})
    client.post("/api/recurring/apply")
    purchases = json.loads(client.get("/api/purchases?start=2000-01-01&end=2099-01-01").data)
    assert len(purchases) == 2  # Both should apply


# ─── Tax Export ───────────────────────────────────────────────────────────────

def test_tax_export_only_work_related(client):
    """Tax export only includes work_related=1 items."""
    client.post("/api/purchases", json={"item": "Work shoes", "amount": -80, "category": "Personal", "person": "person2", "work_related": 1})
    client.post("/api/purchases", json={"item": "Coffee", "amount": -5, "category": "Food", "person": "person1"})
    r = client.get("/api/tax-export?start=2000-01-01&end=2099-01-01")
    assert r.status_code == 200
    csv_data = r.data.decode()
    assert "Work shoes" in csv_data
    assert "Coffee" not in csv_data


# ─── Transfer ─────────────────────────────────────────────────────────────────

def test_transfer_between_accounts(client):
    """Transfer moves money from one account to another."""
    client.post("/api/savings", json={"account_name": "Everyday", "balance": 1000, "currency": "AUD", "account_type": "everyday"})
    client.post("/api/savings", json={"account_name": "Savings", "balance": 500, "currency": "AUD", "account_type": "savings"})
    accts = json.loads(client.get("/api/savings").data)
    from_id = [a for a in accts if a["account_name"] == "Everyday"][0]["id"]
    to_id = [a for a in accts if a["account_name"] == "Savings"][0]["id"]
    client.post("/api/transfer", json={"from_id": from_id, "to_id": to_id, "amount": 200})
    accts = json.loads(client.get("/api/savings").data)
    acct = [a for a in accts if a["account_name"] == "Everyday"][0]
    sav = [a for a in accts if a["account_name"] == "Savings"][0]
    assert acct["balance"] == 800
    assert sav["balance"] == 700


# ─── Input Validation ─────────────────────────────────────────────────────────

def test_purchase_missing_fields(client):
    """POST purchase with missing fields returns 400."""
    r = client.post("/api/purchases", json={"item": "Test"})
    assert r.status_code == 400


# ─── Group Split ──────────────────────────────────────────────────────────────

def test_group_purchase_stores_original_total(client):
    """Group purchase stores amount (your share) and original_total (full bill)."""
    client.post("/api/purchases", json={
        "item": "Dinner", "amount": -40, "category": "Food",
        "person": "group", "original_total": -120
    })
    data = json.loads(client.get("/api/purchases?start=2000-01-01&end=2099-01-01").data)
    assert data[0]["amount"] == -40
    assert data[0]["original_total"] == -120
    assert data[0]["person"] == "group"


def test_group_purchase_only_your_share_in_summary(client):
    """Summary only counts your share (amount), not original_total."""
    client.post("/api/purchases", json={
        "item": "Dinner", "amount": -40, "category": "Food",
        "person": "group", "original_total": -120
    })
    data = json.loads(client.get("/api/summary?start=2000-01-01&end=2099-01-01").data)
    assert data["expenses"] == -40  # Not -120


def test_quick_add_group_portuguese(client):
    """'comida 60 grupo' → Food, person=group"""
    r = client.post("/api/purchases/quick", json={"text": "comida 60 grupo"})
    assert r.status_code == 200
    data = json.loads(client.get("/api/purchases?start=2000-01-01&end=2099-01-01").data)
    assert data[0]["person"] == "group"
    assert data[0]["amount"] == -60


def test_quick_add_portuguese_category(client):
    """'gasolina 50' → Transport"""
    r = client.post("/api/purchases/quick", json={"text": "gasolina 50"})
    assert r.status_code == 200
    data = json.loads(client.get("/api/purchases?start=2000-01-01&end=2099-01-01").data)
    assert data[0]["category"] == "Transport"


def test_quick_add_person2(client):
    """'coffee 5 person2' → person=person2"""
    r = client.post("/api/purchases/quick", json={"text": "coffee 5 person2"})
    assert r.status_code == 200
    data = json.loads(client.get("/api/purchases?start=2000-01-01&end=2099-01-01").data)
    assert data[0]["person"] == "person2"


# ─── Sprint 05 Tests ──────────────────────────────────────────────────────────

def test_quick_add_coffee_gets_subcategory(client):
    """'coffee 5' should match Food:Coffee (specific) not Food (general)."""
    r = client.post("/api/purchases/quick", json={"text": "coffee 5"})
    assert r.status_code == 200
    data = json.loads(client.get("/api/purchases?start=2000-01-01&end=2099-01-01").data)
    assert data[0]["category"] == "Food:Coffee"


def test_worklog_upsert_no_duplicate_cash(client):
    """Updating worklog for same date doesn't create duplicate cash transactions."""
    client.post("/api/savings", json={"account_name": "Cash", "balance": 100, "currency": "AUD", "account_type": "everyday"})
    client.post("/api/worklog", json={"person": "person2", "date": "2026-05-08", "hours": 5, "rate": 30, "cash_amount": 80, "invoice_amount": 90})
    client.post("/api/worklog", json={"person": "person2", "date": "2026-05-08", "hours": 7, "rate": 30, "cash_amount": 100, "invoice_amount": 138})
    # Should only have ONE cash transaction (the latest)
    purchases = json.loads(client.get("/api/purchases?start=2026-05-08&end=2026-05-09").data)
    cash_txs = [p for p in purchases if "Work cash" in p["item"]]
    assert len(cash_txs) == 1
    assert cash_txs[0]["amount"] == 100
    # Cash account unchanged (manual)
    accts = json.loads(client.get("/api/savings").data)
    cash = [a for a in accts if a["account_name"] == "Cash"][0]
    assert cash["balance"] == 100


def test_edit_purchase_payment_method_change(client):
    """Changing payment_method from card to cash does NOT adjust balances (manual)."""
    client.post("/api/savings", json={"account_name": "Everyday", "balance": 1000, "currency": "AUD", "account_type": "everyday"})
    client.post("/api/savings", json={"account_name": "Cash", "balance": 500, "currency": "AUD", "account_type": "everyday"})
    # Add card purchase
    client.post("/api/purchases", json={"item": "Lunch", "amount": -20, "category": "Food", "person": "person1", "payment_method": "card"})
    # Everyday unchanged (no auto-adjust)
    accts = json.loads(client.get("/api/savings").data)
    acct = [a for a in accts if a["account_name"] == "Everyday"][0]
    assert acct["balance"] == 1000
    # Change to cash
    purchases = json.loads(client.get("/api/purchases?start=2000-01-01&end=2099-01-01").data)
    pid = purchases[0]["id"]
    client.put(f"/api/purchases/{pid}", json={"amount": -20, "payment_method": "cash"})
    # Both unchanged
    accts = json.loads(client.get("/api/savings").data)
    acct = [a for a in accts if a["account_name"] == "Everyday"][0]
    cash = [a for a in accts if a["account_name"] == "Cash"][0]
    assert acct["balance"] == 1000
    assert cash["balance"] == 500


def test_malformed_request_body(client):
    """Endpoints don't crash on empty/malformed body."""
    r = client.post("/api/purchases", data="not json", content_type="text/plain")
    assert r.status_code == 400


# ─── Shopping List ────────────────────────────────────────────────────────────

def test_shopping_crud(client):
    """Shopping list: add, check, delete, clear."""
    # Add
    client.post("/api/shopping", json={"item": "Milk"})
    client.post("/api/shopping", json={"item": "Bread"})
    data = json.loads(client.get("/api/shopping").data)
    assert len(data) == 2
    # Check off
    sid = data[0]["id"]
    client.put(f"/api/shopping/{sid}", json={"checked": 1})
    data = json.loads(client.get("/api/shopping").data)
    checked = [i for i in data if i["checked"]]
    assert len(checked) == 1
    # Delete
    client.delete(f"/api/shopping/{sid}")
    data = json.loads(client.get("/api/shopping").data)
    assert len(data) == 1


# ─── Budgets ──────────────────────────────────────────────────────────────────

def test_budgets_crud(client):
    """Budget: add, list, delete."""
    client.post("/api/budgets", json={"category": "Food", "monthly_limit": 500})
    data = json.loads(client.get("/api/budgets").data)
    assert len(data) == 1
    assert data[0]["category"] == "Food"
    assert data[0]["monthly_limit"] == 500
    # Delete
    client.delete(f"/api/budgets/{data[0]['id']}")
    data = json.loads(client.get("/api/budgets").data)
    assert len(data) == 0


# ─── Grouped Purchases ───────────────────────────────────────────────────────

def test_grouped_purchases_returns_fields(client):
    """Grouped endpoint returns work_related and payment_method."""
    client.post("/api/purchases", json={"item": "Test", "amount": -10, "category": "Food", "person": "person1", "work_related": 1, "payment_method": "cash"})
    data = json.loads(client.get("/api/purchases/grouped?start=2000-01-01&end=2099-01-01").data)
    assert len(data) == 1
    assert data[0]["work_related"] == 1
    assert data[0]["payment_method"] == "cash"


# ─── Savings Goals ────────────────────────────────────────────────────────────

def test_goals_crud(client):
    """Goals: create, list, update, delete."""
    # Create
    r = client.post("/api/goals", json={"name": "Holiday", "target": 5000, "current": 1200, "deadline": "2026-12-01"})
    assert r.status_code == 200
    # List
    data = json.loads(client.get("/api/goals").data)
    assert len(data) == 1
    assert data[0]["name"] == "Holiday"
    assert data[0]["target"] == 5000
    assert data[0]["current"] == 1200
    # Update
    gid = data[0]["id"]
    client.put(f"/api/goals/{gid}", json={"current": 2000})
    data = json.loads(client.get("/api/goals").data)
    assert data[0]["current"] == 2000
    # Delete
    client.delete(f"/api/goals/{gid}")
    data = json.loads(client.get("/api/goals").data)
    assert len(data) == 0


def test_goals_validation(client):
    """Goals: missing name or target returns 400."""
    r = client.post("/api/goals", json={"name": "Test"})
    assert r.status_code == 400


# ─── Enhanced Budgets ─────────────────────────────────────────────────────────

def test_budget_with_frequency(client):
    """Budget with weekly frequency only counts this week's spending."""
    # Add a weekly budget
    client.post("/api/budgets", json={"category": "Food", "monthly_limit": 100, "frequency": "weekly", "alert_thresholds": "50,80,100"})
    # Add expense today (should count)
    client.post("/api/purchases", json={"item": "Lunch", "amount": -30, "category": "Food", "person": "person1"})
    # Check budget
    data = json.loads(client.get("/api/budgets").data)
    assert len(data) == 1
    assert data[0]["frequency"] == "weekly"
    assert data[0]["spent"] == 30
    assert data[0]["pct"] == 30.0
    assert data[0]["alert_thresholds"] == "50,80,100"


def test_budget_subcategory_rollup(client):
    """Budget for 'Food' counts 'Food:Coffee' and 'Food:Delivery' spending."""
    client.post("/api/budgets", json={"category": "Food", "monthly_limit": 200, "frequency": "monthly"})
    client.post("/api/purchases", json={"item": "Coffee", "amount": -5, "category": "Food:Coffee", "person": "person1"})
    client.post("/api/purchases", json={"item": "UberEats", "amount": -25, "category": "Food:Delivery", "person": "person1"})
    client.post("/api/purchases", json={"item": "Lunch", "amount": -15, "category": "Food", "person": "person1"})
    data = json.loads(client.get("/api/budgets").data)
    assert data[0]["spent"] == 45  # 5 + 25 + 15


def test_transfer_invalid_account(client):
    """Transfer with non-existent account returns 404."""
    r = client.post("/api/transfer", json={"from_id": 999, "to_id": 998, "amount": 100})
    assert r.status_code == 404


# ─── Summary Calculations ─────────────────────────────────────────────────────

def test_summary_with_mixed_transactions(client):
    """Summary correctly separates income and expenses by amount sign."""
    client.post("/api/purchases", json={"item": "Salary", "amount": 3000, "category": "Income", "person": "person1"})
    client.post("/api/purchases", json={"item": "Rent", "amount": -650, "category": "Bills", "person": "shared"})
    client.post("/api/purchases", json={"item": "Coffee", "amount": -5.5, "category": "Food:Coffee", "person": "person1"})
    client.post("/api/purchases", json={"item": "Refund", "amount": 20, "category": "Income", "person": "person1"})
    data = json.loads(client.get("/api/summary?start=2000-01-01&end=2099-01-01").data)
    assert data["income"] == 3020  # 3000 + 20
    assert data["expenses"] == -655.5  # -650 + -5.5
    assert data["balance"] == 2364.5
    assert data["count"] == 4


def test_recurring_apply_shows_in_summary(client):
    """Applied recurring items appear in summary."""
    client.post("/api/savings", json={"account_name": "Everyday", "balance": 5000, "currency": "AUD", "account_type": "everyday"})
    client.post("/api/recurring", json={"item": "Netflix", "amount": -15, "category": "Entertainment", "frequency": "monthly", "person": "shared", "start_date": "2026-01-01"})
    client.post("/api/recurring/apply")
    data = json.loads(client.get("/api/summary?start=2000-01-01&end=2099-01-01").data)
    assert data["expenses"] == -15
    assert data["count"] == 1
