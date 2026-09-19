"""
Routes for Class Management: CRUD operations and class-subject requirements.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import ClassRoom, ClassSubject, Subject
from app.schemas import ClassCreate, ClassUpdate, ClassRead, ClassSubjectRead

router = APIRouter(prefix="/api/classes", tags=["Classes"])


@router.get("", response_model=List[ClassRead])
def list_classes(db: Session = Depends(get_db)):
    classes = db.query(ClassRoom).order_by(ClassRoom.grade, ClassRoom.section).all()
    results = []
    for c in classes:
        cs_reads = []
        for cs in c.class_subjects:
            cs_reads.append(ClassSubjectRead(
                id=cs.id,
                subject_id=cs.subject_id,
                periods_per_week=cs.periods_per_week,
                subject_name=cs.subject.name if cs.subject else None,
                subject_code=cs.subject.code if cs.subject else None,
                color=cs.subject.color if cs.subject else None,
            ))
        results.append(ClassRead(
            id=c.id,
            name=c.name,
            grade=c.grade,
            section=c.section,
            room_number=c.room_number,
            class_subjects=cs_reads,
        ))
    return results


@router.post("", response_model=ClassRead, status_code=status.HTTP_201_CREATED)
def create_class(payload: ClassCreate, db: Session = Depends(get_db)):
    existing = db.query(ClassRoom).filter(ClassRoom.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Class '{payload.name}' already exists.")

    new_class = ClassRoom(
        name=payload.name,
        grade=payload.grade,
        section=payload.section,
        room_number=payload.room_number,
    )
    db.add(new_class)
    db.flush()

    if payload.subjects:
        for s_req in payload.subjects:
            cs = ClassSubject(
                class_id=new_class.id,
                subject_id=s_req.subject_id,
                periods_per_week=s_req.periods_per_week,
            )
            db.add(cs)

    db.commit()
    db.refresh(new_class)
    return new_class


@router.put("/{class_id}", response_model=ClassRead)
def update_class(class_id: int, payload: ClassUpdate, db: Session = Depends(get_db)):
    cls = db.query(ClassRoom).filter(ClassRoom.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found.")

    if payload.name is not None:
        cls.name = payload.name
    if payload.grade is not None:
        cls.grade = payload.grade
    if payload.section is not None:
        cls.section = payload.section
    if payload.room_number is not None:
        cls.room_number = payload.room_number

    if payload.subjects is not None:
        db.query(ClassSubject).filter(ClassSubject.class_id == class_id).delete()
        for s_req in payload.subjects:
            cs = ClassSubject(
                class_id=class_id,
                subject_id=s_req.subject_id,
                periods_per_week=s_req.periods_per_week,
            )
            db.add(cs)

    db.commit()
    db.refresh(cls)
    return cls


@router.delete("/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_class(class_id: int, db: Session = Depends(get_db)):
    cls = db.query(ClassRoom).filter(ClassRoom.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found.")
    db.delete(cls)
    db.commit()
    return None
