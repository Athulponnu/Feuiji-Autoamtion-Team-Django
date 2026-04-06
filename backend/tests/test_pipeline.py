"""End-to-end pipeline test (mocked Claude calls)."""
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch


SAMPLE_CONTRACT = open("tests/sample_contracts/saas_risky.txt", "rb").read()

MOCK_FLAG = {
    "clause_id": "clause_1",
    "risk_level": "High",
    "category": "liability",
    "reason": "$500 liability cap is dangerously low.",
    "confidence": 0.95,
    "escalate_to_human": False,
}

MOCK_REDLINE_TEXT = (
    "Vendor's total aggregate liability to Client shall not exceed the greater of "
    "(a) the fees paid by Client in the 12 months preceding the claim, or "
    "(b) $50,000 (fifty thousand US dollars).\n"
    "REASON: Increased cap to market standard 12-month fees or $50,000 minimum."
)


def make_flag_response(tool_input):
    block = MagicMock()
    block.type = "tool_use"
    block.name = "flag_clause"
    block.input = tool_input
    resp = MagicMock()
    resp.content = [block]
    return resp


def make_redline_response(text):
    block = MagicMock()
    block.type = "text"
    block.text = text
    resp = MagicMock()
    resp.content = [block]
    return resp


@pytest.mark.asyncio
async def test_full_pipeline_returns_report():
    from app.orchestrator import run_pipeline

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(
        side_effect=lambda **kwargs: (
            make_flag_response(MOCK_FLAG)
            if kwargs.get("tools")
            else make_redline_response(MOCK_REDLINE_TEXT)
        )
    )

    with patch("app.agents.flag_agent.anthropic.AsyncAnthropic", return_value=mock_client), \
         patch("app.agents.redline_agent.anthropic.AsyncAnthropic", return_value=mock_client):
        report = await run_pipeline(SAMPLE_CONTRACT, "text/plain", "saas_risky.txt")

    assert "risk_score" in report
    assert "clause_table" in report
    assert "action_checklist" in report
    assert "executive_summary" in report
    assert "missing_clauses" in report
    assert isinstance(report["risk_score"], int)
    assert 0 <= report["risk_score"] <= 100


@pytest.mark.asyncio
async def test_pipeline_risk_score_range():
    from app.orchestrator import run_pipeline

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(
        side_effect=lambda **kwargs: (
            make_flag_response(MOCK_FLAG)
            if kwargs.get("tools")
            else make_redline_response(MOCK_REDLINE_TEXT)
        )
    )

    with patch("app.agents.flag_agent.anthropic.AsyncAnthropic", return_value=mock_client), \
         patch("app.agents.redline_agent.anthropic.AsyncAnthropic", return_value=mock_client):
        report = await run_pipeline(SAMPLE_CONTRACT, "text/plain", "saas_risky.txt")

    assert report["risk_score"] >= 0
    assert report["risk_score"] <= 100


@pytest.mark.asyncio
async def test_pipeline_clause_table_structure():
    from app.orchestrator import run_pipeline

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(
        side_effect=lambda **kwargs: (
            make_flag_response(MOCK_FLAG)
            if kwargs.get("tools")
            else make_redline_response(MOCK_REDLINE_TEXT)
        )
    )

    with patch("app.agents.flag_agent.anthropic.AsyncAnthropic", return_value=mock_client), \
         patch("app.agents.redline_agent.anthropic.AsyncAnthropic", return_value=mock_client):
        report = await run_pipeline(SAMPLE_CONTRACT, "text/plain", "saas_risky.txt")

    for clause in report["clause_table"]:
        assert "id" in clause
        assert "risk_level" in clause
        assert clause["risk_level"] in ("High", "Medium", "Low", "OK")
        assert "reason" in clause
