"""
Agent 4 — Redline Agent
For each High/Medium risk clause, generates market-standard replacement text.
Uses diff-match-patch to produce before/after diffs.
"""
import os
import asyncio
from openai import AsyncOpenAI
from typing import List, Dict

try:
    from diff_match_patch import diff_match_patch
    DMP = diff_match_patch()
except ImportError:
    DMP = None

MODEL = os.getenv("MODEL", "stepfun/step-3.5-flash:free")
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "2048"))

SYSTEM_PROMPT = """You are a senior commercial lawyer. You have been given a contract clause that has been flagged as risky, along with the reason it was flagged.

Your task: rewrite the clause using market-standard language that is fair to both parties.

Rules:
1. Change only what is necessary to address the flagged risk.
2. Keep the same general structure and intent as the original.
3. Use plain, professional language — no legalese.
4. Output ONLY the replacement clause text. No explanation, no preamble.
5. After the clause, on a new line starting with REASON:, write one sentence explaining the change."""


def compute_diff(original: str, redlined: str) -> List[Dict]:
    """Return a list of diff ops: {op: 'equal'|'insert'|'delete', text: str}"""
    if DMP is None:
        return [{"op": "equal", "text": original}]
    diffs = DMP.diff_main(original, redlined)
    DMP.diff_cleanupSemantic(diffs)
    result = []
    for op, text in diffs:
        if op == 0:
            result.append({"op": "equal", "text": text})
        elif op == 1:
            result.append({"op": "insert", "text": text})
        elif op == -1:
            result.append({"op": "delete", "text": text})
    return result


async def redline_single_clause(client: AsyncOpenAI, clause: Dict) -> Dict:
    """Generate a redlined version of a single risky clause."""
    flag = clause.get("flag", {})
    if flag.get("risk_level") not in ("High", "Medium"):
        return {**clause, "redline": None, "diff": None, "redline_reason": None}

    if clause.get("is_missing"):
        return {**clause, "redline": None, "diff": None, "redline_reason": flag.get("reason", "")}

    original_text = clause.get("text", "")
    reason = flag.get("reason", "")
    category = flag.get("category", "other")

    user_message = f"""Clause Type: {category}
Risk Reason: {reason}

Original Clause:
{original_text}

Rewrite this clause using market-standard language."""

    try:
        response = await client.chat.completions.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
        )

        full_response = response.choices[0].message.content.strip()

        # Split out REASON
        if "REASON:" in full_response:
            parts = full_response.split("REASON:", 1)
            redlined_text = parts[0].strip()
            redline_reason = parts[1].strip()
        else:
            redlined_text = full_response
            redline_reason = "Clause rewritten to market standard."

        diff = compute_diff(original_text, redlined_text)

        return {
            **clause,
            "redline": redlined_text,
            "diff": diff,
            "redline_reason": redline_reason,
        }
    except Exception as e:
        return {
            **clause,
            "redline": None,
            "diff": None,
            "redline_reason": f"Redline generation failed: {str(e)[:100]}",
        }


async def redline_clauses(compared_clauses: List[Dict]) -> List[Dict]:
    """Redline clauses sequentially to avoid rate limits on free tier."""
    if not compared_clauses:
        return []

    client = AsyncOpenAI(
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url="https://openrouter.ai/api/v1",
    )

    results = []
    for clause in compared_clauses:
        result = await redline_single_clause(client, clause)
        results.append(result)
        await asyncio.sleep(10)

    return results

