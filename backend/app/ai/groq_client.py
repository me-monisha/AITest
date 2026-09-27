import json
import re

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

from app.config import settings

_llm = None


def get_llm(temperature: float = 0.1) -> ChatGroq:
    """Lazily construct the Groq chat model so importing this module doesn't
    require an API key to be set (useful for tests)."""
    global _llm
    if _llm is None or _llm.temperature != temperature:
        _llm = ChatGroq(
            model=settings.groq_model,
            api_key=settings.groq_api_key,
            temperature=temperature,
        )
    return _llm


def call_json(system_prompt: str, user_prompt: str, temperature: float = 0.1) -> dict:
    """Call Groq and force a JSON-object response. Groq/OpenAI-style JSON mode
    is requested via response_format; we also defensively strip markdown code
    fences in case the model wraps the JSON anyway.
    """
    llm = get_llm(temperature).bind(response_format={"type": "json_object"})
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ]
    response = llm.invoke(messages)
    return _parse_json(response.content)


def call_text(system_prompt: str, user_prompt: str, temperature: float = 0.3) -> str:
    llm = get_llm(temperature)
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ]
    response = llm.invoke(messages)
    return response.content.strip()


def _parse_json(raw: str) -> dict:
    raw = raw.strip()
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    if fence_match:
        raw = fence_match.group(1).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # last resort: grab the outermost { ... }
        start, end = raw.find("{"), raw.rfind("}")
        if start != -1 and end != -1:
            return json.loads(raw[start : end + 1])
        raise
