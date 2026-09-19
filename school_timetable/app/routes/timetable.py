"""
Routes for Timetable Operations:
- Single Source of Truth for Class and Staff Views
- Generation with Validation
- Scoped Regeneration
- Manual Edit / Move with Real-Time Conflict Validation
- Dashboard Statistics
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import (
    TimetableEntry,
    ClassRoom,
    Staff,
    Subject,
    SchoolDay,
    School,
    StaffAvailability,
    StaffSubject,
    ClassSubject,
)
from app.schemas import (
    TimetableEntryRead,
    TimetableEntryUpdate,
    GenerationRequest,
    RegenerationRequest,
    GenerationResponse,
)
from app.services.timetable_generator import TimetableGeneratorService
from app.services.conflict_checker import ConflictChecker

router = APIRouter(prefix="/api/timetable", tags=["Timetable"])


def _to_read_schema(e: TimetableEntry) -> TimetableEntryRead:
    return TimetableEntryRead(
        id=e.id,
        day=e.day,
        period=e.period,
        class_id=e.class_id,
        class_name=e.class_room.name if e.class_room else "Unknown",
        subject_id=e.subject_id,
        subject_name=e.subject.name if e.subject else "Unknown",
        subject_color=e.subject.color if e.subject else "#3b82f6",
        staff_id=e.staff_id,
        staff_name=e.staff.name if e.staff else "Unknown",
        room_number=e.room_number,
    )


@router.get("/all", response_model=List[TimetableEntryRead])
def get_all_entries(db: Session = Depends(get_db)):
    entries = db.query(TimetableEntry).all()
    return [_to_read_schema(e) for e in entries]


@router.get("/classes/{class_id}", response_model=List[TimetableEntryRead])
def get_class_timetable(class_id: int, db: Session = Depends(get_db)):
    """Class timetable derived directly from master timetable entries."""
    entries = db.query(TimetableEntry).filter(TimetableEntry.class_id == class_id).all()
    return [_to_read_schema(e) for e in entries]


@router.get("/staff/{staff_id}")
def get_staff_timetable(staff_id: int, db: Session = Depends(get_db)):
    """
    Staff timetable derived directly from master timetable entries,
    annotating free periods across the school schedule.
    """
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found.")

    entries = db.query(TimetableEntry).filter(TimetableEntry.staff_id == staff_id).all()
    read_entries = [_to_read_schema(e) for e in entries]

    # Map of occupied slots
    occupied = {(e.day, e.period): e for e in read_entries}

    active_days = [
        sd.day_name for sd in db.query(SchoolDay).filter(SchoolDay.is_active == True).order_by(SchoolDay.day_order).all()
    ]
    if not active_days:
        active_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

    school = db.query(School).first()
    total_periods = school.total_periods if school else 8

    # Build weekly grid with "free" period indicators
    grid = []
    total_assigned = len(read_entries)
    for p in range(1, total_periods + 1):
        row = {"period": p, "slots": {}}
        for day in active_days:
            if (day, p) in occupied:
                entry = occupied[(day, p)]
                row["slots"][day] = {
                    "is_free": False,
                    "id": entry.id,
                    "class_name": entry.class_name,
                    "subject_name": entry.subject_name,
                    "subject_color": entry.subject_color,
                    "room_number": entry.room_number,
                }
            else:
                row["slots"][day] = {
                    "is_free": True,
                    "label": "FREE",
                }
        grid.append(row)

    return {
        "staff": {
            "id": staff.id,
            "name": staff.name,
            "employee_id": staff.employee_id,
            "max_periods_per_day": staff.max_periods_per_day,
            "max_periods_per_week": staff.max_periods_per_week,
        },
        "total_assigned": total_assigned,
        "grid": grid,
        "entries": read_entries,
    }


@router.post("/generate", response_model=GenerationResponse)
def generate_timetable(payload: GenerationRequest, db: Session = Depends(get_db)):
    service = TimetableGeneratorService(db)
    result = service.generate(random_seed=payload.random_seed or 42)
    return result


@router.post("/regenerate", response_model=GenerationResponse)
def regenerate_timetable(payload: RegenerationRequest, db: Session = Depends(get_db)):
    service = TimetableGeneratorService(db)
    result = service.regenerate_subset(
        scope=payload.scope,
        target_id=payload.target_id,
        day_name=payload.day_name,
    )
    return result


@router.put("/{entry_id}", response_model=TimetableEntryRead)
def update_timetable_entry(entry_id: int, payload: TimetableEntryUpdate, db: Session = Depends(get_db)):
    """
    Manual editing / drag & drop handler.
    Strictly validates all constraints before applying move:
    - Target class free?
    - Teacher free?
    - Teacher available?
    - Teacher daily limit exceeded?
    """
    entry = db.query(TimetableEntry).filter(TimetableEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Timetable entry not found.")

    new_day = payload.day if payload.day is not None else entry.day
    new_period = payload.period if payload.period is not None else entry.period
    new_staff_id = payload.staff_id if payload.staff_id is not None else entry.staff_id
    new_class_id = payload.class_id if payload.class_id is not None else entry.class_id
    new_subject_id = payload.subject_id if payload.subject_id is not None else entry.subject_id

    # 1. Check if another class is scheduled in this slot
    class_clash = db.query(TimetableEntry).filter(
        TimetableEntry.class_id == new_class_id,
        TimetableEntry.day == new_day,
        TimetableEntry.period == new_period,
        TimetableEntry.id != entry_id
    ).first()
    if class_clash:
        raise HTTPException(
            status_code=400,
            detail=f"Class already has {class_clash.subject.name} scheduled on {new_day} Period {new_period}."
        )

    # 2. Check if teacher is double-booked
    teacher_clash = db.query(TimetableEntry).filter(
        TimetableEntry.staff_id == new_staff_id,
        TimetableEntry.day == new_day,
        TimetableEntry.period == new_period,
        TimetableEntry.id != entry_id
    ).first()
    if teacher_clash:
        raise HTTPException(
            status_code=400,
            detail=f"Teacher {teacher_clash.staff.name} is already teaching class {teacher_clash.class_room.name} on {new_day} Period {new_period}."
        )

    # 3. Check teacher availability
    unavail = db.query(StaffAvailability).filter(
        StaffAvailability.staff_id == new_staff_id,
        StaffAvailability.day == new_day,
        StaffAvailability.period == new_period,
        StaffAvailability.is_available == False
    ).first()
    if unavail:
        raise HTTPException(
            status_code=400,
            detail=f"Teacher is marked unavailable on {new_day} Period {new_period}."
        )

    # 4. Check teacher qualifications
    is_qual = db.query(StaffSubject).filter(
        StaffSubject.staff_id == new_staff_id,
        StaffSubject.subject_id == new_subject_id
    ).first()
    if not is_qual:
        raise HTTPException(
            status_code=400,
            detail="Selected teacher is not qualified for this subject."
        )

    # 5. Check teacher daily limit
    staff = db.query(Staff).filter(Staff.id == new_staff_id).first()
    day_count = db.query(TimetableEntry).filter(
        TimetableEntry.staff_id == new_staff_id,
        TimetableEntry.day == new_day,
        TimetableEntry.id != entry_id
    ).count()
    if staff and (day_count + 1) > staff.max_periods_per_day:
        raise HTTPException(
            status_code=400,
            detail=f"Moving this entry would give {staff.name} {day_count + 1} periods on {new_day}, exceeding daily limit of {staff.max_periods_per_day}."
        )

    # Apply changes
    entry.day = new_day
    entry.period = new_period
    entry.staff_id = new_staff_id
    entry.class_id = new_class_id
    entry.subject_id = new_subject_id
    if payload.room_number is not None:
        entry.room_number = payload.room_number

    db.commit()
    db.refresh(entry)
    return _to_read_schema(entry)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_timetable_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(TimetableEntry).filter(TimetableEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found.")
    db.delete(entry)
    db.commit()
    return None


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total_classes = db.query(ClassRoom).count()
    total_staff = db.query(Staff).count()
    total_subjects = db.query(Subject).count()
    total_entries = db.query(TimetableEntry).count()

    total_required = sum(cs.periods_per_week for cs in db.query(ClassSubject).all())
    missing_periods = max(0, total_required - total_entries)

    # Calculate conflicts
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

    existing_entries = [
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
        entries=existing_entries,
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

    return {
        "total_classes": total_classes,
        "total_staff": total_staff,
        "total_subjects": total_subjects,
        "total_required_periods": total_required,
        "scheduled_periods": total_entries,
        "unscheduled_periods": missing_periods,
        "conflict_count": len(conflicts),
        "high_conflict_count": len([c for c in conflicts if c.severity == "high"]),
    }
