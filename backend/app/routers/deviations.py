import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/api/deviations", tags=["deviations"])


def _to_out(dev: models.Deviation) -> schemas.DeviationOut:
    payload = {f: getattr(dev, f) for f in schemas.DeviationFields.model_fields}
    payload["id"] = dev.id
    payload["status"] = dev.status
    payload["created_at"] = dev.created_at
    payload["updated_at"] = dev.updated_at
    payload["ai_generated_fields"] = json.loads(dev.ai_generated_fields) if dev.ai_generated_fields else None
    return schemas.DeviationOut(**payload)


@router.post("", response_model=schemas.DeviationOut)
def create_deviation(payload: schemas.DeviationCreate, db: Session = Depends(get_db)):
    dev = models.Deviation(
        **payload.model_dump(exclude={"status", "ai_generated_fields"}), status=payload.status
    )
    if payload.ai_generated_fields:
        dev.ai_generated_fields = json.dumps(payload.ai_generated_fields)
    db.add(dev)
    db.commit()
    db.refresh(dev)
    return _to_out(dev)


@router.get("", response_model=List[schemas.DeviationOut])
def list_deviations(db: Session = Depends(get_db)):
    devs = db.query(models.Deviation).order_by(models.Deviation.created_at.desc()).all()
    return [_to_out(d) for d in devs]


@router.get("/{deviation_id}", response_model=schemas.DeviationOut)
def get_deviation(deviation_id: str, db: Session = Depends(get_db)):
    dev = db.get(models.Deviation, deviation_id)
    if not dev:
        raise HTTPException(status_code=404, detail="Deviation not found")
    return _to_out(dev)


@router.put("/{deviation_id}", response_model=schemas.DeviationOut)
def update_deviation(deviation_id: str, payload: schemas.DeviationCreate, db: Session = Depends(get_db)):
    dev = db.get(models.Deviation, deviation_id)
    if not dev:
        raise HTTPException(status_code=404, detail="Deviation not found")
    for k, v in payload.model_dump(exclude={"ai_generated_fields"}).items():
        setattr(dev, k, v)
    if payload.ai_generated_fields is not None:
        dev.ai_generated_fields = json.dumps(payload.ai_generated_fields)
    db.commit()
    db.refresh(dev)
    return _to_out(dev)
