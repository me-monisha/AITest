"""LangGraph workflow powering the AI Deviation Assistant.

Graph shape:

    START -> extract_fields -> assess_impact_severity -> END

`extract_fields` is the structured-extraction node (used by both the
"PDF/document extraction tool" and the "log interaction tool" - a pasted
email/notes just skips straight to text instead of going through the file
parser first).

`assess_impact_severity` is a second, focused LLM call: it reasons only
about the detailed description / product / batch context to recommend an
initial impact & severity with a short justification, the same way a real
QA reviewer would triage a new deviation.

The "edit interaction tool" lives in chat_graph.py - it's a separate, much
cheaper single-node graph because edits don't need re-extraction or
re-assessment, only a targeted field update.
"""
from typing import TypedDict, List, Optional

from langgraph.graph import StateGraph, END

from app.ai.groq_client import call_json

IMPACT_LEVELS = ["Low", "Medium", "High", "Critical"]
SEVERITY_LEVELS = ["Minor", "Major", "Critical"]
SOURCE_OPTIONS = [
    "Production / Manufacturing",
    "QC Laboratory",
    "QA Review",
    "Warehouse / Storage",
    "Packaging",
    "Audit Finding",
    "Customer Complaint",
    "Stability Study",
    "Other",
]

FIELD_NAMES = [
    "site_plant",
    "date_of_occurrence",
    "title",
    "source",
    "related_product",
    "batch_lot_number",
    "detailed_description",
]


class ExtractionState(TypedDict, total=False):
    raw_text: str
    fields: dict
    ai_generated_fields: List[str]
    initial_impact: Optional[str]
    initial_severity: Optional[str]
    severity_reason: Optional[str]


EXTRACTION_SYSTEM_PROMPT = f"""You are the AI extraction engine inside AIVOA, a pharmaceutical
Quality Management System. You read raw deviation reports (emails, shift notes, lab
out-of-specification reports, free text) from an API (Active Pharmaceutical Ingredient)
manufacturing site, and extract structured fields for the "Log Deviation" form.

Return ONLY a JSON object with exactly these keys (use null for anything not stated
or not confidently inferable - never invent facts that aren't in the text):

- "site_plant": string or null. The manufacturing site/plant/unit (e.g. "API Manufacturing Unit").
- "date_of_occurrence": string in YYYY-MM-DD format or null.
- "title": string or null. A short (<=10 word) professional title for the deviation,
  e.g. "OOS result for Assay in Batch ABC-001".
- "source": string or null. Must be EXACTLY one of: {SOURCE_OPTIONS}.
- "related_product": string or null. Product or material name.
- "batch_lot_number": string or null.
- "detailed_description": string or null. A clear, objective 2-5 sentence account of
  what happened, where, when, and how it was detected, written in professional QA
  documentation style, based only on the source text.

Do not include any keys other than the ones listed above. Do not wrap the JSON in
markdown fences."""

ASSESSMENT_SYSTEM_PROMPT = f"""You are a senior Quality Assurance reviewer at a pharmaceutical
API manufacturing site, performing an INITIAL triage of a newly logged deviation. This is a
preliminary AI suggestion only - a human will review and can override it before saving.

Given the deviation's title, description, related product and batch, return ONLY a JSON
object with these keys:

- "initial_impact": one of {IMPACT_LEVELS} - the likely impact on product quality/patient safety.
- "initial_severity": one of {SEVERITY_LEVELS} - the deviation classification
  (Minor = no significant quality/compliance risk, Major = significant risk requiring
  thorough investigation, Critical = direct risk to patient safety, product efficacy,
  or regulatory compliance).
- "severity_reason": a short (1-2 sentence) plain-language justification a QA reviewer
  would find credible, referencing specifics from the description.

Do not wrap the JSON in markdown fences."""


def node_extract_fields(state: ExtractionState) -> ExtractionState:
    raw_text = state["raw_text"]
    data = call_json(EXTRACTION_SYSTEM_PROMPT, f"SOURCE TEXT:\n\"\"\"\n{raw_text}\n\"\"\"")

    fields = {k: data.get(k) for k in FIELD_NAMES}
    # Guard against the model inventing a source outside the allowed dropdown values
    if fields.get("source") not in SOURCE_OPTIONS:
        fields["source"] = fields.get("source") or None

    ai_generated_fields = [k for k, v in fields.items() if v not in (None, "")]

    return {**state, "fields": fields, "ai_generated_fields": ai_generated_fields}


def node_assess_impact_severity(state: ExtractionState) -> ExtractionState:
    fields = state.get("fields", {})
    context = (
        f"Title: {fields.get('title')}\n"
        f"Description: {fields.get('detailed_description')}\n"
        f"Related product: {fields.get('related_product')}\n"
        f"Batch/Lot: {fields.get('batch_lot_number')}\n"
        f"Source: {fields.get('source')}"
    )
    data = call_json(ASSESSMENT_SYSTEM_PROMPT, context)

    impact = data.get("initial_impact")
    severity = data.get("initial_severity")
    reason = data.get("severity_reason")

    ai_generated_fields = list(state.get("ai_generated_fields", []))
    if impact in IMPACT_LEVELS:
        ai_generated_fields.append("initial_impact")
    if severity in SEVERITY_LEVELS:
        ai_generated_fields.append("initial_severity")

    return {
        **state,
        "initial_impact": impact if impact in IMPACT_LEVELS else None,
        "initial_severity": severity if severity in SEVERITY_LEVELS else None,
        "severity_reason": reason,
        "ai_generated_fields": ai_generated_fields,
    }


def build_extraction_graph():
    graph = StateGraph(ExtractionState)
    graph.add_node("extract_fields", node_extract_fields)
    graph.add_node("assess_impact_severity", node_assess_impact_severity)
    graph.set_entry_point("extract_fields")
    graph.add_edge("extract_fields", "assess_impact_severity")
    graph.add_edge("assess_impact_severity", END)
    return graph.compile()


_extraction_graph = build_extraction_graph()


def run_extraction(raw_text: str) -> ExtractionState:
    """Runs the full document/text -> fields -> impact & severity pipeline."""
    result = _extraction_graph.invoke({"raw_text": raw_text})
    fields = dict(result.get("fields", {}))
    fields["initial_impact"] = result.get("initial_impact")
    fields["initial_severity"] = result.get("initial_severity")
    fields["severity_reason"] = result.get("severity_reason")
    return {
        "fields": fields,
        "ai_generated_fields": result.get("ai_generated_fields", []),
        "severity_reason": result.get("severity_reason"),
    }
