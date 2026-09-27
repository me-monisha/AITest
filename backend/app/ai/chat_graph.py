"""The AI Assistant chat box ("Ask me anything about deviations...") supports
three distinct behaviours, matching the assignment's required AI tools:

1. Log interaction tool  - the user pastes free-form deviation notes/an email
   directly into chat instead of uploading a file. We detect this intent and
   run the exact same extraction pipeline as the document upload (graph.py).
2. Edit interaction tool - the user asks to change one or more fields that
   are already on the form ("change severity to Critical", "batch number is
   actually B-002"). We ask the LLM for a small JSON patch instead of
   re-running the whole extraction, and apply only the fields mentioned.
3. Plain chat - anything else (questions about the workflow, the severity
   scale, etc.) gets a normal conversational answer with no field changes.

This module is intentionally the "router" a LangGraph supervisor node would
implement: classify -> dispatch -> respond.
"""
from app.ai.groq_client import call_json, call_text
from app.ai.graph import run_extraction, IMPACT_LEVELS, SEVERITY_LEVELS, SOURCE_OPTIONS, FIELD_NAMES
from app.schemas import ChatRequest, ChatResponse

EDITABLE_FIELDS = FIELD_NAMES + ["initial_impact", "initial_severity"]

CLASSIFY_PROMPT = f"""You are the intent router for a pharmaceutical deviation-logging AI
assistant chat box. Classify the user's message into exactly one of:

- "log": the message is (or contains) a deviation report, incident description, lab
  result, shift note, or email being reported for the FIRST time - i.e. the user wants
  it extracted into the form. Usually multiple sentences describing what happened.
- "edit": the user is asking to change/correct/set one or more specific fields that are
  already on the form (title, site, date, source, product, batch, description, impact,
  severity), e.g. "set severity to Major", "the batch number is B-002", "change the site
  to Unit 2".
- "chat": anything else - a question, small talk, or a request for clarification that
  doesn't itself contain new deviation content or a field correction.

Return ONLY JSON: {{"intent": "log" | "edit" | "chat"}}"""

EDIT_SYSTEM_PROMPT = f"""You update fields on an already-partially-filled pharmaceutical
deviation form based on a user's chat instruction. Only change fields the user explicitly
referenced - never touch anything else.

Valid field names: {EDITABLE_FIELDS}
Valid "source" values: {SOURCE_OPTIONS}
Valid "initial_impact" values: {IMPACT_LEVELS}
Valid "initial_severity" values: {SEVERITY_LEVELS}
"date_of_occurrence" must be YYYY-MM-DD if changed.

Return ONLY JSON with this shape:
{{"changed_fields": {{"<field_name>": "<new_value>", ...}}, "reply": "<one short sentence confirming the change, in a helpful assistant tone>"}}

If the user's message doesn't clearly map to a valid field/value, return an empty
"changed_fields" object and explain what you couldn't apply in "reply"."""

CHAT_SYSTEM_PROMPT = """You are the AI Deviation Assistant inside AIVOA, a pharmaceutical
QMS. You help a quality/manufacturing user log deviations. Answer briefly and
professionally (2-4 sentences max). You are not filling or changing the form right now -
just answering their question. If relevant, you can mention that they can paste deviation
notes or upload a document and you'll auto-fill the form, or ask you to edit a field
directly."""


def _classify_intent(message: str) -> str:
    data = call_json(CLASSIFY_PROMPT, message, temperature=0)
    intent = data.get("intent")
    return intent if intent in ("log", "edit", "chat") else "chat"


def run_chat_turn(req: ChatRequest) -> ChatResponse:
    intent = _classify_intent(req.message)

    if intent == "log":
        result = run_extraction(req.message)
        fields = req.current_fields.model_copy(update={
            k: v for k, v in result["fields"].items() if v not in (None, "")
        })
        changed = [k for k, v in result["fields"].items() if v not in (None, "")]
        reply = (
            "I read that through and filled in "
            f"{', '.join(f.replace('_', ' ') for f in changed) or 'the form'} from what you shared. "
            "Take a look and adjust anything before saving."
        )
        return ChatResponse(reply=reply, intent="log", updated_fields=fields, changed_field_names=changed)

    if intent == "edit":
        context = (
            f"Current form state: {req.current_fields.model_dump()}\n"
            f"User instruction: \"{req.message}\""
        )
        data = call_json(EDIT_SYSTEM_PROMPT, context, temperature=0)
        changed_fields = data.get("changed_fields", {}) or {}
        reply = data.get("reply", "Done.")

        updated = req.current_fields.model_copy(update=changed_fields) if changed_fields else req.current_fields
        return ChatResponse(
            reply=reply,
            intent="edit",
            updated_fields=updated,
            changed_field_names=list(changed_fields.keys()),
        )

    # plain chat
    history_text = "\n".join(f"{m.get('role')}: {m.get('content')}" for m in req.history[-6:])
    prompt = f"{history_text}\nuser: {req.message}" if history_text else req.message
    reply = call_text(CHAT_SYSTEM_PROMPT, prompt)
    return ChatResponse(reply=reply, intent="chat", updated_fields=None, changed_field_names=[])
