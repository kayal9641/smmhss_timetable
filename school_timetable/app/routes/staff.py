"""
Routes for Staff Management: Qualifications, Classes, Max Limits, and Availability.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Staff, StaffSubject, StaffClass, StaffAvailability, Subject, ClassRoom
from app.schemas import StaffCreate, StaffUpdate, StaffRead, StaffAvailabilityItem, SubjectRead, ClassRead

router = APIRouter(prefix="/api/staff", tags=["Staff"])


def _build_staff_read(st: Staff) -> StaffRead:
    quals = [
        SubjectRead(
            id=ss.subject.id,
            name=ss.subject.name,
            code=ss.subject.code,
            color=ss.subject.color,
            icon=ss.subject.icon,
            category=ss.subject.category,
            requires_consecutive=ss.subject.requires_consecutive,
            default_periods_per_week=ss.subject.default_periods_per_week,
        )
        for ss in st.qualified_subjects if ss.subject
    ]
    classes = [
        ClassRead(
            id=sc.class_room.id,
            name=sc.class_room.name,
            grade=sc.class_room.grade,
            section=sc.class_room.section,
            room_number=sc.class_room.room_number,
            class_subjects=[],
        )
        for sc in st.assigned_classes if sc.class_room
    ]
    unavails = [
        StaffAvailabilityItem(
            day=av.day,
            period=av.period,
            is_available=av.is_available,
            reason=av.reason,
        )
        for av in st.availabilities if not av.is_available
    ]
    return StaffRead(
        id=st.id,
        name=st.name,
        employee_id=st.employee_id,
        email=st.email,
        phone=st.phone,
        max_periods_per_day=st.max_periods_per_day,
        max_periods_per_week=st.max_periods_per_week,
        qualified_subjects=quals,
        assigned_classes=classes,
        unavailabilities=unavails,
    )


@router.get("", response_model=List[StaffRead])
def list_staff(db: Session = Depends(get_db)):
    staff_list = db.query(Staff).order_by(Staff.name).all()
    return [_build_staff_read(s) for s in staff_list]


@router.post("", response_model=StaffRead, status_code=status.HTTP_201_CREATED)
def create_staff(payload: StaffCreate, db: Session = Depends(get_db)):
    st = Staff(
        name=payload.name,
        employee_id=payload.employee_id,
        email=payload.email,
        phone=payload.phone,
        max_periods_per_day=payload.max_periods_per_day,
        max_periods_per_week=payload.max_periods_per_week,
    )
    db.add(st)
    db.flush()

    for sub_id in payload.qualified_subject_ids:
        db.add(StaffSubject(staff_id=st.id, subject_id=sub_id))

    for c_id in payload.assigned_class_ids:
        db.add(StaffClass(staff_id=st.id, class_id=c_id))

    for unavail in payload.unavailabilities:
        db.add(StaffAvailability(
            staff_id=st.id,
            day=unavail.day,
            period=unavail.period,
            is_available=False,
            reason=unavail.reason,
        ))

    db.commit()
    db.refresh(st)
    return _build_staff_read(st)


@router.put("/{staff_id}", response_model=StaffRead)
def update_staff(staff_id: int, payload: StaffUpdate, db: Session = Depends(get_db)):
    st = db.query(Staff).filter(Staff.id == staff_id).first()
    if not st:
        raise HTTPException(status_code=404, detail="Staff not found.")

    if payload.name is not None:
        st.name = payload.name
    if payload.employee_id is not None:
        st.employee_id = payload.employee_id
    if payload.email is not None:
        st.email = payload.email
    if payload.phone is not None:
        st.phone = payload.phone
    if payload.max_periods_per_day is not None:
        st.max_periods_per_day = payload.max_periods_per_day
    if payload.max_periods_per_week is not None:
        st.max_periods_per_week = payload.max_periods_per_week

    if payload.qualified_subject_ids is not None:
        db.query(StaffSubject).filter(StaffSubject.staff_id == staff_id).delete()
        for sub_id in payload.qualified_subject_ids:
            db.add(StaffSubject(staff_id=staff_id, subject_id=sub_id))

    if payload.assigned_class_ids is not None:
        db.query(StaffClass).filter(StaffClass.staff_id == staff_id).delete()
        for c_id in payload.assigned_class_ids:
            db.add(StaffClass(staff_id=staff_id, class_id=c_id))

    if payload.unavailabilities is not None:
        db.query(StaffAvailability).filter(StaffAvailability.staff_id == staff_id).delete()
        for unavail in payload.unavailabilities:
            db.add(StaffAvailability(
                staff_id=staff_id,
                day=unavail.day,
                period=unavail.period,
                is_available=False,
                reason=unavail.reason,
            ))

    db.commit()
    db.refresh(st)
    return _build_staff_read(st)


@router.delete("/{staff_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_staff(staff_id: int, db: Session = Depends(get_db)):
    st = db.query(Staff).filter(Staff.id == staff_id).first()
    if not st:
        raise HTTPException(status_code=404, detail="Staff not found.")
    db.delete(st)
    db.commit()
    return None
