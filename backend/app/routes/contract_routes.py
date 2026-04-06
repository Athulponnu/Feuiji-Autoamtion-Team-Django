"""
Contract Creator routes.
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.agents.contract_creator_agent import create_contract, CONTRACT_LABELS

router = APIRouter(prefix="/contract", tags=["contract"])


class ContractRequest(BaseModel):
    contract_type: str   # saas | nda | freelance | vendor | employment
    description: str


@router.post("/create/stream")
async def create_contract_stream(req: ContractRequest):
    """Generate a contract from plain-English description via SSE stream."""
    if req.contract_type not in CONTRACT_LABELS:
        raise HTTPException(400, f"Unknown contract type: {req.contract_type}")
    if not req.description.strip():
        raise HTTPException(400, "Description is required.")
    if len(req.description) < 20:
        raise HTTPException(400, "Please provide more detail in your description.")

    async def generator():
        async for chunk in create_contract(req.contract_type, req.description):
            yield chunk

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/types")
async def get_contract_types():
    """List available contract types."""
    return {"types": [
        {"key": k, "label": v} for k, v in CONTRACT_LABELS.items()
    ]}
