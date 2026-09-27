import uuid
from datetime import datetime

from sqlalchemy import Column, String, Text, Date, DateTime
import enum

from app.database import Base


def gen_id() -> str:
    return uuid.uuid4().hex


class DeviationStatus(str, enum.Enum):
    draft = "draft"
    logged = "logged"


class ImpactLevel(str, enum.Enum):
    low = "Low"
    medium = "Medium"
    high = "High"
    critical = "Critical"


class SeverityLevel(str, enum.Enum):
    minor = "Minor"
    major = "Major"
    critical = "Critical"


class Deviation(Base):
    __tablename__ = "deviations"

    id = Column(String(32), primary_key=True, default=gen_id)

    # 1. Deviation information
    site_plant = Column(String(255), nullable=True)
    date_of_occurrence = Column(Date, nullable=True)
    title = Column(String(500), nullable=True)
    source = Column(String(100), nullable=True)
    related_product = Column(String(255), nullable=True)
    batch_lot_number = Column(String(100), nullable=True)

    # 2. Deviation details
    detailed_description = Column(Text, nullable=True)
    initial_impact = Column(String(50), nullable=True)
    initial_severity = Column(String(50), nullable=True)
    severity_reason = Column(Text, nullable=True)

    # Provenance - what came from AI vs human edits, useful for the demo/explanation
    ai_generated_fields = Column(Text, nullable=True)  # JSON list of field names AI populated

    status = Column(String(20), default=DeviationStatus.draft.value)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
