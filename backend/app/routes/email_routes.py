"""
Email routes — start/stop/status + processed email history.
"""
import asyncio
from fastapi import APIRouter, BackgroundTasks, HTTPException
from app.email_worker import run_worker, stop_worker, get_state, poll_once

router = APIRouter(prefix="/email", tags=["email"])


@router.post("/start")
async def start_worker(background_tasks: BackgroundTasks):
    state = get_state()
    if state["running"]:
        raise HTTPException(400, "Worker is already running")
    background_tasks.add_task(run_worker)
    return {"status": "started"}


@router.post("/stop")
async def stop_email_worker():
    state = get_state()
    if not state["running"]:
        raise HTTPException(400, "Worker is not running")
    stop_worker()
    return {"status": "stopped"}


@router.post("/poll")
async def poll_now():
    await poll_once()
    return {"status": "polled", "state": get_state()}


@router.get("/status")
async def worker_status():
    return get_state()
