"""Tests for Agent 2 — Flag Agent (mocked Claude calls)."""
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch


SAMPLE_CLAUSES = [
    {
        "id": "clause_1",
        "heading": "4. LIMITATION OF LIABILITY",
        "text": "Vendor's total aggregate liability shall not exceed $500.",
        "type": "liability",
        "index": 1,
    },
    {
        "id": "clause_2",
        "heading": "5. CONFIDENTIALITY",
        "text": "Each party shall keep confidential all non-public information for 3 years.",
        "type": "confidentiality",
        "index": 2,
    },
]

MOCK_FLAG_RESPONSE = {
    "clause_id": "clause_1",
    "risk_level": "High",
    "category": "liability",
    "reason": "$500 liability cap is effectively zero protection for any real claim.",
    "confidence": 0.95,
    "escalate_to_human": False,
}


def make_mock_response(tool_input: dict):
    block = MagicMock()
    block.type = "tool_use"
    block.name = "flag_clause"
    block.input = tool_input
    response = MagicMock()
    response.content = [block]
    return response


@pytest.mark.asyncio
async def test_flag_clauses_returns_list():
    from app.agents.flag_agent import flag_clauses

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=make_mock_response(MOCK_FLAG_RESPONSE))

    with patch("app.agents.flag_agent.anthropic.AsyncAnthropic", return_value=mock_client):
        results = await flag_clauses(SAMPLE_CLAUSES)

    assert isinstance(results, list)
    assert len(results) == len(SAMPLE_CLAUSES)


@pytest.mark.asyncio
async def test_flag_clauses_have_flag_key():
    from app.agents.flag_agent import flag_clauses

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=make_mock_response(MOCK_FLAG_RESPONSE))

    with patch("app.agents.flag_agent.anthropic.AsyncAnthropic", return_value=mock_client):
        results = await flag_clauses(SAMPLE_CLAUSES)

    for r in results:
        assert "flag" in r
        assert "risk_level" in r["flag"]
        assert r["flag"]["risk_level"] in ("High", "Medium", "Low", "OK")


@pytest.mark.asyncio
async def test_flag_handles_api_error():
    from app.agents.flag_agent import flag_clauses

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(side_effect=Exception("API Error"))

    with patch("app.agents.flag_agent.anthropic.AsyncAnthropic", return_value=mock_client):
        results = await flag_clauses(SAMPLE_CLAUSES)

    # Should not raise; should return clauses with fallback flags
    assert len(results) == len(SAMPLE_CLAUSES)
    for r in results:
        assert "flag" in r
