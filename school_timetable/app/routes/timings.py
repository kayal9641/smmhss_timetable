"""
Routes for School Timings and Day Configuration.
Validates whether periods and breaks fit within school hours without overlap.
"""

from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import School, SchoolDay, TimeSlot
from app.schemas import SchoolTimingConfig

router = APIRouter(prefix="/api/timings", tags=["School Timings"])


def _to_minutes(time_str: str) -> int:
    parts = time_str.split(":")
    return int(parts[0]) * 60 + int(parts[1])


def _to_time_str(minutes: int) -> str:
    h = minutes // 60
    m = minutes % 60
    return f"{h:02d}:{m:02d}"


@router.get("")
def get_timings(db: Session = Depends(get_db)):
    school = db.query(School).first()
    if not school:
        school = School()
        db.add(school)
        db.commit()
        db.refresh(school)

    active_days = [
        sd.day_name for sd in db.query(SchoolDay).filter(SchoolDay.is_active == True).order_by(SchoolDay.day_order).all()
    ]
    if not active_days:
        active_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

    # Calculate periods and validate fit
    start_m = _to_minutes(school.start_time)
    end_m = _to_minutes(school.end_time)
    duration = school.period_duration_minutes
    total_periods = school.total_periods

    l_start = _to_minutes(school.lunch_start)
    l_end = _to_minutes(school.lunch_end)
    b1_start = _to_minutes(school.break1_start)
    b1_end = _to_minutes(school.break1_end)
    b2_start = _to_minutes(school.break2_start)
    b2_end = _to_minutes(school.break2_end)

    # Compute period breakdown
    timeline = []
    curr = start_m
    warnings = []

    for p in range(1, total_periods + 1):
        # Check if break 1 occurs
        if p == 3 and b1_end > b1_start:
            timeline.append({
                "type": "break",
                "label": "Morning Break",
                "start": school.break1_start,
                "end": school.break1_end,
                "duration": b1_end - b1_start,
            })
            curr = max(curr, b1_end)

        # Check if lunch occurs
        if p == 5 and l_end > l_start:
            timeline.append({
                "type": "lunch",
                "label": "Lunch Break",
                "start": school.lunch_start,
                "end": school.lunch_end,
                "duration": l_end - l_start,
            })
            curr = max(curr, l_end)

        # Check if afternoon break occurs
        if p == 7 and b2_end > b2_start:
            timeline.append({
                "type": "break",
                "label": "Afternoon Break",
                "start": school.break2_start,
                "end": school.break2_end,
                "duration": b2_end - b2_start,
            })
            curr = max(curr, b2_end)

        p_start = curr
        p_end = p_start + duration
        timeline.append({
            "type": "period",
            "period": p,
            "label": f"Period {p}",
            "start": _to_time_str(p_start),
            "end": _to_time_str(p_end),
            "duration": duration,
        })
        curr = p_end

    total_span = curr - start_m
    school_span = end_m - start_m
    if curr > end_m:
        diff = curr - end_m
        warnings.append(
            f"Configured schedule ends at {_to_time_str(curr)}, which exceeds the official school end time of {school.end_time} by {diff} minutes."
        )

    return {
        "config": {
            "school_name": school.name,
            "academic_year": school.academic_year,
            "start_time": school.start_time,
            "end_time": school.end_time,
            "period_duration_minutes": school.period_duration_minutes,
            "total_periods": school.total_periods,
            "lunch_start": school.lunch_start,
            "lunch_end": school.lunch_end,
            "break1_start": school.break1_start,
            "break1_end": school.break1_end,
            "break2_start": school.break2_start,
            "break2_end": school.break2_end,
            "active_days": active_days,
        },
        "timeline": timeline,
        "warnings": warnings,
        "is_valid": len(warnings) == 0,
    }


@router.post("")
def update_timings(payload: SchoolTimingConfig, db: Session = Depends(get_db)):
    school = db.query(School).first()
    if not school:
        school = School()
        db.add(school)

    school.name = payload.school_name
    school.academic_year = payload.academic_year
    school.start_time = payload.start_time
    school.end_time = payload.end_time
    school.period_duration_minutes = payload.period_duration_minutes
    school.total_periods = payload.total_periods
    school.lunch_start = payload.lunch_start
    school.lunch_end = payload.lunch_end
    school.break1_start = payload.break1_start
    school.break1_end = payload.break1_end
    school.break2_start = payload.break2_start
    school.break2_end = payload.break2_end

    # Update active days
    all_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    db.query(SchoolDay).delete()
    for idx, d_name in enumerate(all_days, start=1):
        sd = SchoolDay(
            day_name=d_name,
            day_order=idx,
            is_active=(d_name in payload.active_days),
        )
        db.add(sd)

    db.commit()
    return {"message": "School timings and days updated successfully"}
