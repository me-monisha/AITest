"""Tiny in-memory job store that lets the frontend show a live extraction
progress bar (matching the reference UI's "Analyzing document content... 20%").

This is intentionally simple - a dict + asyncio task - which is appropriate
for a single-process demo/assignment. In a real deployment you'd back this
with Redis/Celery so progress survives restarts and scales across workers.
"""
import asyncio
import uuid
from typing import Optional

from app.ai.graph import node_extract_fields, node_assess_impact_severity

_jobs: dict[str, dict] = {}
# Strong references to running tasks - asyncio only keeps weak ones, so a
# fire-and-forget task can otherwise be garbage-collected mid-run.
_tasks: set = set()


def start_extraction(raw_text: str) -> str:
    job_id = create_job()
    task = asyncio.create_task(run_extraction_job(job_id, raw_text))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return job_id


def create_job() -> str:
    job_id = uuid.uuid4().hex
    _jobs[job_id] = {
        "status": "pending",
        "progress": 0,
        "message": "Queued...",
        "result": None,
        "error": None,
    }
    return job_id


def get_job(job_id: str) -> Optional[dict]:
    return _jobs.get(job_id)


def _update(job_id: str, **kwargs):
    if job_id in _jobs:
        _jobs[job_id].update(kwargs)


async def run_extraction_job(job_id: str, raw_text: str):
    try:
        _update(job_id, status="processing", progress=10, message="Reading document content...")
        state = {"raw_text": raw_text}

        _update(job_id, progress=35, message="Extracting deviation details with AI...")
        state = await asyncio.to_thread(node_extract_fields, state)

        _update(job_id, progress=70, message="Assessing initial impact & severity...")
        state = await asyncio.to_thread(node_assess_impact_severity, state)

        _update(job_id, progress=92, message="Finalizing extracted fields...")
        fields = dict(state.get("fields", {}))
        fields["initial_impact"] = state.get("initial_impact")
        fields["initial_severity"] = state.get("initial_severity")
        fields["severity_reason"] = state.get("severity_reason")

        result = {
            "fields": fields,
            "ai_generated_fields": state.get("ai_generated_fields", []),
            "severity_reason": state.get("severity_reason"),
        }
        _update(job_id, status="done", progress=100, message="Extraction complete.", result=result)
    except Exception as exc:  # noqa: BLE001 - surface any parsing/LLM error to the UI
        _update(job_id, status="error", progress=100, message="Extraction failed.", error=str(exc))
