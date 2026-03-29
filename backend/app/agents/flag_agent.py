"""
Agent 2 — Flag Agent
Uses Claude tool-use to risk-score each clause. Returns structured JSON.
"""
import os
import asyncio
from openai import AsyncOpenAI
from typing import List, Dict
from app.tools.flag_clause_schema import FLAG_CLAUSE_TOOL

MODEL = os.getenv("MODEL", "nvidia/nemotron-3-super-120b-a12b:free")
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "1024"))

SYSTEM_PROMPT = """You are a senior commercial lawyer with 15 years of experience reviewing SaaS and vendor contracts.

You will be given a single contract clause and its type label. Your job is to assess it for risk.

Market standards:
- Liability cap: 12-month fees paid, or $50,000 minimum
- IP ownership: Vendor retains pre-existing IP; only custom work-for-hire transfers
- Auto-renewal notice: 30 days is standard; 60+ days is unfavourable to Client
- Data processing: GDPR Art. 28 requires a DPA for any EU personal data processing
- Payment terms: Net-30 is standard; anything shorter is aggressive
- Confidentiality: 2-3 year mutual NDA is standard

Assess the clause and call the flag_clause tool with your assessment.
If confidence < 0.7, set escalate_to_human to true.
Be concise in the reason field (max 200 chars)."""


async def flag_single_clause(client: AsyncOpenAI, clause: Dict) -> Dict:
    """Flag a single clause using Claude tool-use."""
    user_message = f"""Clause ID: {clause['id']}
Clause Type: {clause['type']}
Clause Heading: {clause['heading']}

Clause Text:
{clause['text']}

Assess this clause for risk and call the flag_clause tool."""

    try:
        response = await client.chat.completions.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            tools=[{"type": "function", "function": {
                "name": FLAG_CLAUSE_TOOL["name"],
                "description": FLAG_CLAUSE_TOOL["description"],
                "parameters": FLAG_CLAUSE_TOOL["input_schema"],
            }}],
            tool_choice={"type": "function", "function": {"name": "flag_clause"}},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": user_message},
            ],
        )
        msg = response.choices[0].message
        if msg.tool_calls:
            import json
            result = json.loads(msg.tool_calls[0].function.arguments)
            return {**clause, "flag": result}

        # Fallback if no tool use
        return {**clause, "flag": {
            "clause_id": clause["id"],
            "risk_level": "Low",
            "category": clause["type"],
            "reason": "Could not assess — defaulting to Low risk.",
            "confidence": 0.5,
            "escalate_to_human": True,
        }}
    except Exception as e:
        return {**clause, "flag": {
            "clause_id": clause["id"],
            "risk_level": "Low",
            "category": clause["type"],
            "reason": f"Error during assessment: {str(e)[:100]}",
            "confidence": 0.0,
            "escalate_to_human": True,
        }}


async def flag_clauses(clauses: List[Dict]) -> List[Dict]:
    """Flag all clauses concurrently (max 5 at a time to respect rate limits)."""
    client = AsyncOpenAI(
    api_key=os.getenv("OPENROUTER_API_KEY"),
    base_url="https://openrouter.ai/api/v1",)
    semaphore = asyncio.Semaphore(5)

    async def bounded_flag(clause):
        async with semaphore:
            await asyncio.sleep(2)
            return await flag_single_clause(client, clause)

    tasks = [bounded_flag(clause) for clause in clauses]
    results = await asyncio.gather(*tasks)
    return list(results)
