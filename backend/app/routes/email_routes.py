"""
Email routes — start/stop/status endpoints for the email worker.
"""
import asyncio
from fastapi import APIRouter, BackgroundTasks, HTTPException
from app.email_worker import run_worker, stop_worker, get_state, poll_once

router = APIRouter(prefix="/email", tags=["email"])

_worker_task = None


@router.post("/start")
async def start_worker(background_tasks: BackgroundTasks):
    """Start the email polling worker in the background."""
    global _worker_task
    state = get_state()

    if state["running"]:
        raise HTTPException(400, "Worker is already running")

    background_tasks.add_task(run_worker)
    return {"status": "started", "message": "Email worker is now polling Gmail"}


@router.post("/stop")
async def stop_email_worker():
    """Stop the email polling worker."""
    state = get_state()
    if not state["running"]:
        raise HTTPException(400, "Worker is not running")
    stop_worker()
    return {"status": "stopped"}


@router.post("/poll")
async def poll_now():
    """Trigger a single poll immediately (useful for testing)."""
    await poll_once()
    return {"status": "polled", "state": get_state()}


@router.get("/status")
async def worker_status():
    """Get current worker state."""
    return get_state()
