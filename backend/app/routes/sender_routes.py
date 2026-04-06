"""
Contract Sender routes.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.agents.contract_sender_agent import send_contract

router = APIRouter(prefix="/contract", tags=["contract"])


class SendContractRequest(BaseModel):
    contract_text:  str
    contract_label: str
    filename:       str
    to_email:       Optional[str] = ""
    to_whatsapp:    Optional[str] = ""
    subject:        Optional[str] = ""
    sender_note:    Optional[str] = ""


@router.post("/send")
async def send_contract_endpoint(req: SendContractRequest):
    """Send a generated contract via email and/or WhatsApp."""
    if not req.to_email and not req.to_whatsapp:
        raise HTTPException(400, "Provide at least one recipient (email or WhatsApp number).")
    if not req.contract_text.strip():
        raise HTTPException(400, "Contract text is empty.")

    results = send_contract(
        contract_text  = req.contract_text,
        contract_label = req.contract_label,
        filename       = req.filename,
        to_email       = req.to_email or "",
        to_whatsapp    = req.to_whatsapp or "",
        subject        = req.subject or "",
        sender_note    = req.sender_note or "",
    )

    # Check if all channels failed
    all_failed = all(not v.get("success") for v in results.values())
    if all_failed:
        raise HTTPException(500, f"All channels failed: {results}")

    return {"status": "sent", "results": results}
