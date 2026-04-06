"""Tests for Agent 1 — Parse Agent."""
import pytest
from app.agents.parse_agent import parse_contract, detect_clause_type, split_into_clauses


SAMPLE_CONTRACT = open("tests/sample_contracts/saas_risky.txt", "rb").read()


def test_parse_returns_list():
    clauses = parse_contract(SAMPLE_CONTRACT, "text/plain")
    assert isinstance(clauses, list)
    assert len(clauses) > 0


def test_parse_clause_structure():
    clauses = parse_contract(SAMPLE_CONTRACT, "text/plain")
    for clause in clauses:
        assert "id" in clause
        assert "text" in clause
        assert "type" in clause
        assert "heading" in clause
        assert len(clause["text"]) > 0


def test_parse_detects_clause_types():
    clauses = parse_contract(SAMPLE_CONTRACT, "text/plain")
    types = {c["type"] for c in clauses}
    # Should detect at least some typed clauses
    assert len(types) > 1


def test_detect_clause_type_liability():
    text = "Vendor's total liability shall not exceed $500."
    assert detect_clause_type(text) == "liability"


def test_detect_clause_type_ip():
    text = "All intellectual property rights vest in the Client."
    assert detect_clause_type(text) == "ip"


def test_detect_clause_type_data():
    text = "Vendor shall process personal data in accordance with GDPR Article 28."
    assert detect_clause_type(text) == "data"


def test_detect_clause_type_other():
    text = "The parties agree to cooperate in good faith."
    assert detect_clause_type(text) == "other"


def test_parse_txt_content_type():
    text = b"1. LIABILITY\nLiability is capped at $500.\n\n2. PAYMENT\nPayment is due in 7 days."
    clauses = parse_contract(text, "text/plain")
    assert len(clauses) >= 1


def test_split_into_clauses_numbered():
    text = "1. Liability\nLiability is capped.\n\n2. Payment\nPayment due in 30 days.\n\n3. Term\nOne year term."
    clauses = split_into_clauses(text)
    assert len(clauses) >= 2
