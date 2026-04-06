from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from app.orchestrator import run_pipeline, stream_pipeline

router = APIRouter()

ALLOWED_MIMES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
}

# Extension fallback — browsers sometimes send application/octet-stream
EXT_MAP = {
    ".pdf":  "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt":  "text/plain",
}


def resolve_content_type(filename: str, declared: str) -> str:
    """Use declared MIME if valid, otherwise infer from file extension."""
    if declared in ALLOWED_MIMES:
        return declared
    fname = (filename or "").lower()
    for ext, mime in EXT_MAP.items():
        if fname.endswith(ext):
            return mime
    return declared


# ── SSE streaming endpoints (used by the React frontend) ────────────────────

@router.post("/review/stream")
async def review_stream(file: UploadFile = File(...)):
    """Upload a file → stream real-time SSE pipeline events → final report."""
    content_type = resolve_content_type(file.filename or "", file.content_type or "")
    if content_type not in ALLOWED_MIMES:
        raise HTTPException(400, f"Unsupported file type '{file.content_type}'. Upload PDF, DOCX, or TXT.")
    contents = await file.read()
    if not contents:
        raise HTTPException(400, "Uploaded file is empty.")

    async def generator():
        async for chunk in stream_pipeline(contents, content_type, file.filename or "contract"):
            yield chunk

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/review/text/stream")
async def review_text_stream(payload: dict):
    """Paste text → stream real-time SSE pipeline events → final report."""
    text = payload.get("text", "").strip()
    if not text:
        raise HTTPException(400, "No contract text provided.")

    async def generator():
        async for chunk in stream_pipeline(text.encode(), "text/plain", "pasted_contract.txt"):
            yield chunk

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Non-streaming fallbacks (curl / pytest) ──────────────────────────────────

@router.post("/review")
async def review_contract(file: UploadFile = File(...)):
    content_type = resolve_content_type(file.filename or "", file.content_type or "")
    if content_type not in ALLOWED_MIMES:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")
    contents = await file.read()
    if not contents:
        raise HTTPException(400, "Uploaded file is empty.")
    try:
        return JSONResponse(content=await run_pipeline(contents, content_type, file.filename or "contract"))
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/review/text")
async def review_text(payload: dict):
    text = payload.get("text", "").strip()
    if not text:
        raise HTTPException(400, "No contract text provided.")
    try:
        return JSONResponse(content=await run_pipeline(text.encode(), "text/plain", "pasted_contract.txt"))
    except Exception as e:
        raise HTTPException(500, str(e))
