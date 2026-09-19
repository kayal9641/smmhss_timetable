"""
Routes for Conflict Audit.
Evaluates the current state of the database and returns all detected conflicts.
"""

from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import TimetableEntry
from app.schemas import ConflictItem
from app.services.timetable_generator import TimetableGeneratorService
from app.services.conflict_checker import ConflictChecker

router = APIRouter(prefix="/api/conflicts", tags=["Conflicts"])


@router.get("", response_model=List[ConflictItem])
def get_conflicts(db: Session = Depends(get_db)):
    service = TimetableGeneratorService(db)
    (
        classes,
        subjects,
        staff_list,
        assignments,
        class_subjects,
        availabilities,
        active_days,
        total_periods,
        lunch_period,
        break_periods,
    ) = service.load_data()

    entries = [
        {
            "id": e.id,
            "day": e.day,
            "period": e.period,
            "class_id": e.class_id,
            "subject_id": e.subject_id,
            "staff_id": e.staff_id,
        }
        for e in db.query(TimetableEntry).all()
    ]

    conflicts = ConflictChecker.audit_timetable(
        entries=entries,
        classes=classes,
        staff_list=staff_list,
        subjects=subjects,
        assignments=assignments,
        availabilities=availabilities,
        class_subjects=class_subjects,
        active_days=active_days,
        total_periods=total_periods,
        lunch_period=lunch_period,
        break_periods=break_periods,
    )
    return conflicts
