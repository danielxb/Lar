"""API endpoint tests — income/expense classification and display."""
import json


def test_index_returns_html(client):
    resp = client.get("/")
    assert resp.status_code == 200


def test_get_purchases_empty(client):
    resp = client.get("/api/purchases")
    assert resp.status_code == 200
    assert resp.json == []


def test_post_expense(client):
    """Expenses are negative amounts."""
    data = {"item": "Coffee", "amount": -5.50, "category": "food", "person": "person1"}
    resp = client.post("/api/purchases", json=data)
    assert resp.status_code == 200
    purchases = client.get("/api/purchases").json
    assert purchases[0]["amount"] == -5.50


def test_post_income(client):
    """Income is positive amounts."""
    data = {"item": "Salary", "amount": 3000, "category": "salary", "person": "person1"}
    resp = client.post("/api/purchases", json=data)
    assert resp.status_code == 200
    purchases = client.get("/api/purchases").json
    salary = [p for p in purchases if p["item"] == "Salary"][0]
    assert salary["amount"] == 3000


def test_summary_income_expense_by_sign(client):
    """Summary uses amount sign, not category name, to classify income/expense."""
    client.post("/api/purchases", json={"item": "Salary", "amount": 5000, "category": "work", "person": "person1"})
    client.post("/api/purchases", json={"item": "Rent", "amount": -2000, "category": "housing", "person": "shared"})
    client.post("/api/purchases", json={"item": "Freelance", "amount": 500, "category": "freelance", "person": "person1"})

    resp = client.get("/api/summary?start=2020-01-01&end=2030-12-31")
    data = resp.json
    assert data["income"] == 5500  # 5000 + 500 (positive amounts)
    assert data["expenses"] == -2000  # negative amount
    assert data["balance"] == 3500


def test_daily_income_expense_by_sign(client):
    """Daily uses amount sign, not category name."""
    client.post("/api/purchases", json={"item": "Pay", "amount": 1000, "category": "salary", "person": "person1", "created": "2026-05-06"})
    client.post("/api/purchases", json={"item": "Lunch", "amount": -15, "category": "food", "person": "person1", "created": "2026-05-06"})

    resp = client.get("/api/daily?start=2026-05-01&end=2026-05-31")
    data = resp.json
    assert "2026-05-06" in data
    assert data["2026-05-06"]["income"] == 1000
    assert data["2026-05-06"]["expenses"] == -15
    assert data["2026-05-06"]["balance"] == 985


def test_recurring_add_with_start_date(client):
    """Recurring items accept start_date."""
    data = {"item": "Netflix", "amount": -15.99, "category": "entertainment", "person": "shared", "frequency": "monthly", "start_date": "2026-05-01"}
    resp = client.post("/api/recurring", json=data)
    assert resp.status_code == 200

    recurring = client.get("/api/recurring").json
    assert len(recurring) == 1
    assert recurring[0]["start_date"] == "2026-05-01"


def test_recurring_apply_idempotent(client):
    """Recurring apply doesn't duplicate."""
    client.post("/api/recurring", json={"item": "Rent", "amount": -2200, "category": "housing", "person": "shared", "frequency": "monthly"})

    resp1 = client.post("/api/recurring/apply")
    assert resp1.json["applied"] == 1

    resp2 = client.post("/api/recurring/apply")
    assert resp2.json["applied"] == 0  # idempotent


def test_recurring_apply_respects_start_date(client):
    """Recurring with future start_date is not applied."""
    client.post("/api/recurring", json={"item": "Future", "amount": -100, "category": "bills", "person": "shared", "frequency": "monthly", "start_date": "2099-01-01"})

    resp = client.post("/api/recurring/apply")
    assert resp.json["applied"] == 0


def test_recurring_income_stays_positive(client):
    """Income recurring items are applied with positive amount."""
    client.post("/api/recurring", json={"item": "Salary", "amount": 5000, "category": "salary", "person": "person1", "frequency": "monthly"})
    client.post("/api/recurring/apply")

    purchases = client.get("/api/purchases?start=2020-01-01&end=2030-12-31").json
    salary = [p for p in purchases if p["item"] == "Salary"][0]
    assert salary["amount"] == 5000  # stays positive


def test_savings_crud(client):
    """Savings: create, read, update, delete."""
    # Create
    resp = client.post("/api/savings", json={"account_name": "Everyday", "balance": 1000, "currency": "AUD", "account_type": "everyday"})
    assert resp.status_code == 200

    # Read
    savings = client.get("/api/savings").json
    assert len(savings) == 1
    assert savings[0]["account_name"] == "Everyday"
    assert savings[0]["account_type"] == "everyday"
    sid = savings[0]["id"]

    # Update
    client.put(f"/api/savings/{sid}", json={"balance": 2000})
    savings = client.get("/api/savings").json
    assert savings[0]["balance"] == 2000

    # Delete
    client.delete(f"/api/savings/{sid}")
    savings = client.get("/api/savings").json
    assert len(savings) == 0


def test_categories(client):
    """Categories endpoint returns unique categories."""
    client.post("/api/purchases", json={"item": "A", "amount": -10, "category": "food", "person": "person1"})
    client.post("/api/purchases", json={"item": "B", "amount": -20, "category": "transport", "person": "person1"})

    resp = client.get("/api/categories")
    cats = resp.json
    assert "food" in cats
    assert "transport" in cats
