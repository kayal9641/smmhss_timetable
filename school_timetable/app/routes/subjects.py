"""
Routes for Subject Management.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Subject
from app.schemas import SubjectCreate, SubjectUpdate, SubjectRead

router = APIRouter(prefix="/api/subjects", tags=["Subjects"])


@router.get("", response_model=List[SubjectRead])
def list_subjects(db: Session = Depends(get_db)):
    return db.query(Subject).order_by(Subject.name).all()


@router.post("", response_model=SubjectRead, status_code=status.HTTP_201_CREATED)
def create_subject(payload: SubjectCreate, db: Session = Depends(get_db)):
    existing = db.query(Subject).filter(Subject.code == payload.code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Subject with code '{payload.code}' already exists.")

    new_sub = Subject(
        name=payload.name,
        code=payload.code.upper(),
        color=payload.color,
        icon=payload.icon,
        category=payload.category,
        requires_consecutive=payload.requires_consecutive,
        default_periods_per_week=payload.default_periods_per_week,
    )
    db.add(new_sub)
    db.commit()
    db.refresh(new_sub)
    return new_sub


@router.put("/{subject_id}", response_model=SubjectRead)
def update_subject(subject_id: int, payload: SubjectUpdate, db: Session = Depends(get_db)):
    sub = db.query(Subject).filter(Subject.id == subject_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found.")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(sub, k, v)

    db.commit()
    db.refresh(sub)
    return sub


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(subject_id: int, db: Session = Depends(get_db)):
    sub = db.query(Subject).filter(Subject.id == subject_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found.")
    db.delete(sub)
    db.commit()
    return None
