import asyncio
import json

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse

from app.ai.document_parser import extract_text_from_file, UnsupportedFileError
from app.ai.jobs import get_job, start_extraction
from app.ai.chat_graph import run_chat_turn
from app.schemas import ExtractTextRequest, ChatRequest, ChatResponse

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/extract/document")
async def extract_document(file: UploadFile = File(...)):
    """The 'PDF extraction tool': accepts PDF/DOCX/TXT/XLSX/image, parses it to
    text, then kicks off the same AI extraction pipeline as pasted text."""
    content = await file.read()
    try:
        raw_text = extract_text_from_file(file.filename, content)
    except UnsupportedFileError as e:
        raise HTTPException(status_code=422, detail=str(e))

    job_id = start_extraction(raw_text)
    return {"job_id": job_id}


@router.post("/extract/text")
async def extract_text(payload: ExtractTextRequest):
    """The 'log interaction' entry point for pasted notes/emails - same pipeline,
    no file parsing step needed."""
    job_id = start_extraction(payload.text)
    return {"job_id": job_id}


@router.get("/extract/{job_id}/stream")
async def extract_stream(job_id: str):
    """Server-Sent Events stream the frontend consumes to drive the
    'EXTRACTION PROGRESS' bar in the AI Assistant panel."""

    async def event_generator():
        while True:
            job = get_job(job_id)
            if job is None:
                yield f"data: {json.dumps({'status': 'error', 'error': 'job not found'})}\n\n"
                return
            yield f"data: {json.dumps(job)}\n\n"
            if job["status"] in ("done", "error"):
                return
            await asyncio.sleep(0.35)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        # Stop reverse proxies (Render, nginx, etc.) from buffering the stream,
        # otherwise the progress bar only updates once the job finishes.
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest):
    """Powers the 'Ask me anything about deviations...' box, which doubles as
    the log-via-chat tool and the edit-interaction tool (see chat_graph.py)."""
    return await asyncio.to_thread(run_chat_turn, payload)
