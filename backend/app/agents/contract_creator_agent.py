"""
Contract Creator Agent — generates a full contract from a plain-English description.
Uses OpenRouter (same client as flag/redline agents).
"""
import os
import asyncio
from openai import AsyncOpenAI
from typing import AsyncGenerator

MODEL = os.getenv("MODEL", "stepfun/step-3.5-flash:free")

CONTRACT_PROMPTS = {
    "saas": """You are a senior commercial lawyer specialising in SaaS agreements.
Generate a complete, professional SaaS Agreement based on the description provided.
Include all standard clauses: Services, Fees & Payment, Term & Renewal, Limitation of Liability,
IP Ownership, Confidentiality, Data Processing, Governing Law, Termination, and General provisions.
Use market-standard balanced language fair to both parties.
Format with numbered sections and sub-sections.""",

    "nda": """You are a senior commercial lawyer specialising in confidentiality agreements.
Generate a complete, professional Non-Disclosure Agreement (NDA) based on the description provided.
Include: Definition of Confidential Information, Obligations, Exclusions, Term, Return of Information,
Remedies, and General provisions.
Use market-standard balanced mutual NDA language unless one-way is specified.""",

    "freelance": """You are a senior commercial lawyer specialising in freelance and service agreements.
Generate a complete, professional Freelance Service Agreement based on the description provided.
Include: Scope of Work, Deliverables, Payment Terms, IP Ownership, Confidentiality,
Independent Contractor Status, Termination, and General provisions.
Ensure IP ownership is clear and payment terms are specific.""",

    "vendor": """You are a senior commercial lawyer specialising in vendor and supplier agreements.
Generate a complete, professional Vendor Agreement based on the description provided.
Include: Services/Products, Pricing, Payment Terms, Warranties, Liability Cap,
Indemnification, Confidentiality, Term & Termination, and General provisions.
Use market-standard language with reasonable liability protections for both parties.""",

    "employment": """You are a senior employment lawyer.
Generate a complete, professional Employment Contract based on the description provided.
Include: Position & Duties, Compensation & Benefits, Working Hours, Confidentiality,
IP Assignment, Non-Compete (if applicable), Termination, and General provisions.
Ensure compliance with standard employment law principles.""",
}

CONTRACT_LABELS = {
    "saas": "SaaS Agreement",
    "nda": "Non-Disclosure Agreement",
    "freelance": "Freelance Service Agreement",
    "vendor": "Vendor Agreement",
    "employment": "Employment Contract",
}


async def create_contract(
    contract_type: str,
    description: str,
) -> AsyncGenerator[str, None]:
    """
    Stream a generated contract as SSE events.
    Yields: stage events during generation, then done event with full contract text.
    """
    import json

    def sse(event, data):
        return f"event: {event}\ndata: {json.dumps(data)}\n\n"

    system_prompt = CONTRACT_PROMPTS.get(contract_type, CONTRACT_PROMPTS["saas"])
    label = CONTRACT_LABELS.get(contract_type, "Contract")

    user_message = f"""Create a {label} based on this description:

{description}

Generate the complete contract text. Start directly with the contract title.
Do not include any preamble or explanation — just the contract itself."""

    yield sse("stage", {"stage": "generating", "label": f"Generating {label}…", "progress": 10})

    client = AsyncOpenAI(
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url="https://openrouter.ai/api/v1",
    )

    try:
        yield sse("stage", {"stage": "generating", "label": "AI is drafting clauses…", "progress": 30})

        response = await client.chat.completions.create(
            model=MODEL,
            max_tokens=4000,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_message},
            ],
        )

        contract_text = response.choices[0].message.content.strip()

        yield sse("stage", {"stage": "generating", "label": "Contract drafted", "progress": 90})
        yield sse("stage", {"stage": "done", "label": "Ready", "progress": 100})
        yield sse("done", {
            "contract": contract_text,
            "type": contract_type,
            "label": label,
        })

    except Exception as e:
        yield sse("error", {"message": str(e)})
