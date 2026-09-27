from datetime import date, datetime
from typing import Optional, List

from pydantic import BaseModel, Field


# ---------- Deviation form fields (shared shape between AI output & DB record) ----------

class DeviationFields(BaseModel):
    site_plant: Optional[str] = None
    date_of_occurrence: Optional[date] = None
    title: Optional[str] = None
    source: Optional[str] = None
    related_product: Optional[str] = None
    batch_lot_number: Optional[str] = None
    detailed_description: Optional[str] = None
    initial_impact: Optional[str] = None
    initial_severity: Optional[str] = None
    severity_reason: Optional[str] = None


class DeviationCreate(DeviationFields):
    status: str = "logged"
    ai_generated_fields: Optional[List[str]] = None


class DeviationOut(DeviationFields):
    id: str
    status: str
    ai_generated_fields: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------- AI extraction ----------

class ExtractTextRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Pasted deviation notes / email / report text")


class ExtractionResult(BaseModel):
    fields: DeviationFields
    ai_generated_fields: List[str]
    severity_reason: Optional[str] = None
    raw_source_excerpt: Optional[str] = None


# ---------- Chat / edit interaction ----------

class ChatRequest(BaseModel):
    message: str
    current_fields: DeviationFields = Field(default_factory=DeviationFields)
    history: List[dict] = Field(default_factory=list)  # [{role, content}]


class ChatResponse(BaseModel):
    reply: str
    intent: str  # "log" | "edit" | "chat"
    updated_fields: Optional[DeviationFields] = None
    changed_field_names: List[str] = Field(default_factory=list)
