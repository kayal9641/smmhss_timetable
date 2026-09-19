"""
Routes for Teacher Assignments: Teacher -> Subject -> Class.
Validates that teacher is qualified for the subject prior to assigning.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import StaffAssignment, Staff, Subject, ClassRoom, StaffSubject
from app.schemas import AssignmentCreate, AssignmentRead

router = APIRouter(prefix="/api/assignments", tags=["Assignments"])


@router.get("", response_model=List[AssignmentRead])
def list_assignments(db: Session = Depends(get_db)):
    assignments = db.query(StaffAssignment).all()
    results = []
    for a in assignments:
        results.append(AssignmentRead(
            id=a.id,
            staff_id=a.staff_id,
            staff_name=a.staff.name if a.staff else "Unknown",
            subject_id=a.subject_id,
            subject_name=a.subject.name if a.subject else "Unknown",
            class_id=a.class_id,
            class_name=a.class_room.name if a.class_room else "Unknown",
        ))
    return results


@router.post("", response_model=AssignmentRead, status_code=status.HTTP_201_CREATED)
def create_or_update_assignment(payload: AssignmentCreate, db: Session = Depends(get_db)):
    # 1. Check teacher qualification
    is_qual = db.query(StaffSubject).filter(
        StaffSubject.staff_id == payload.staff_id,
        StaffSubject.subject_id == payload.subject_id
    ).first()

    staff = db.query(Staff).filter(Staff.id == payload.staff_id).first()
    subject = db.query(Subject).filter(Subject.id == payload.subject_id).first()
    class_room = db.query(ClassRoom).filter(ClassRoom.id == payload.class_id).first()

    if not staff or not subject or not class_room:
        raise HTTPException(status_code=404, detail="Staff, Subject, or Class not found.")

    if not is_qual:
        raise HTTPException(
            status_code=400,
            detail=f"{staff.name} is not qualified to teach {subject.name}. Update qualifications first."
        )

    # 2. Check existing assignment for this class + subject (upsert)
    existing = db.query(StaffAssignment).filter(
        StaffAssignment.class_id == payload.class_id,
        StaffAssignment.subject_id == payload.subject_id
    ).first()

    if existing:
        existing.staff_id = payload.staff_id
        db.commit()
        db.refresh(existing)
        return AssignmentRead(
            id=existing.id,
            staff_id=existing.staff_id,
            staff_name=staff.name,
            subject_id=existing.subject_id,
            subject_name=subject.name,
            class_id=existing.class_id,
            class_name=class_room.name,
        )

    new_asgn = StaffAssignment(
        staff_id=payload.staff_id,
        subject_id=payload.subject_id,
        class_id=payload.class_id,
    )
    db.add(new_asgn)
    db.commit()
    db.refresh(new_asgn)
    return AssignmentRead(
        id=new_asgn.id,
        staff_id=new_asgn.staff_id,
        staff_name=staff.name,
        subject_id=new_asgn.subject_id,
        subject_name=subject.name,
        class_id=new_asgn.class_id,
        class_name=class_room.name,
    )


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(assignment_id: int, db: Session = Depends(get_db)):
    asgn = db.query(StaffAssignment).filter(StaffAssignment.id == assignment_id).first()
    if not asgn:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    db.delete(asgn)
    db.commit()
    return None
