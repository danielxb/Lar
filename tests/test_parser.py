"""Receipt parser tests."""
from parsers.receipt_parser import classify_item


def test_classify_milk():
    cat = classify_item("WOOLWORTHS FULL CREAM MILK 2L")
    assert "dairy" in cat


def test_classify_banana():
    cat = classify_item("CAVENDISH BANANAS")
    assert "fruit" in cat


def test_unclassified_returns_default():
    cat = classify_item("XYZZY UNKNOWN PRODUCT 999")
    assert cat is not None  # Should return a default, not crash
