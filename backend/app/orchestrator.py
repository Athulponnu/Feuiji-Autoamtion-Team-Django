"""
Orchestrator: runs all 5 agents in sequence.
Exposes stream_pipeline (SSE) and run_pipeline (non-streaming fallback).
"""
import asyncio
import json
from typing import AsyncGenerator

from app.agents.parse_agent import parse_contract
from app.agents.flag_agent import flag_clauses
from app.agents.compare_agent import compare_clauses
from app.agents.redline_agent import redline_clauses
from app.agents.report_agent import build_report


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def stream_pipeline(
    content: bytes, content_type: str, filename: str
) -> AsyncGenerator[str, None]:
    """
    Runs each agent and yields real SSE events so the frontend
    shows actual progress instead of a fake timer.
    """
    try:
        # Agent 1 — Parse
        yield _sse("stage", {"stage": "parse", "label": "Extracting clauses…", "progress": 5})
        clauses = await asyncio.to_thread(parse_contract, content, content_type)
        yield _sse("stage", {"stage": "parse", "label": f"Parsed {len(clauses)} clauses", "progress": 18})

        # Agent 2 — Flag
        yield _sse("stage", {"stage": "flag", "label": "Risk-scoring with Claude…", "progress": 20})
        flagged = await flag_clauses(clauses)
        high = sum(1 for c in flagged if c.get("flag", {}).get("risk_level") == "High")
        yield _sse("stage", {"stage": "flag", "label": f"{len(flagged)} clauses scored — {high} high risk", "progress": 50})

        # Agent 3 — Compare
        yield _sse("stage", {"stage": "compare", "label": "Checking playbook & GDPR rules…", "progress": 55})
        compared = await asyncio.to_thread(compare_clauses, flagged)
        missing = sum(1 for c in compared if c.get("is_missing"))
        yield _sse("stage", {"stage": "compare", "label": f"Rules checked — {missing} missing clause(s)", "progress": 65})

        # Agent 4 — Redline
        yield _sse("stage", {"stage": "redline", "label": "Generating redlines with Claude…", "progress": 67})
        redlined = await redline_clauses(compared)
        n_redlines = sum(1 for c in redlined if c.get("redline"))
        yield _sse("stage", {"stage": "redline", "label": f"{n_redlines} redline(s) generated", "progress": 88})

        # Agent 5 — Report
        yield _sse("stage", {"stage": "report", "label": "Assembling final report…", "progress": 92})
        report = await asyncio.to_thread(build_report, clauses, redlined, filename)
        yield _sse("stage", {"stage": "report", "label": "Report ready", "progress": 100})

        yield _sse("done", {"report": report})

    except Exception as exc:
        yield _sse("error", {"message": str(exc)})


async def run_pipeline(content: bytes, content_type: str, filename: str) -> dict:
    """Non-streaming fallback — drains SSE generator, returns final report dict."""
    report = None
    async for raw in stream_pipeline(content, content_type, filename):
        for line in raw.strip().split("\n"):
            pass  # just drain
        lines = raw.strip().split("\n")
        evt = lines[0].replace("event: ", "").strip()
        dat = json.loads(lines[1].replace("data: ", "").strip())
        if evt == "done":
            report = dat["report"]
        elif evt == "error":
            raise RuntimeError(dat["message"])
    return report
