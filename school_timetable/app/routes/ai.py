"""
Routes for Optional Groq AI Assistant.
Validates all inputs and outputs using Pydantic, never trusting raw LLM strings.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import GroqPromptRequest, GroqConflictExplainRequest, GroqParsedData
from app.services.groq_service import GroqService
from app.models import Staff, Subject, ClassRoom, StaffSubject, StaffClass, StaffAssignment, StaffAvailability

router = APIRouter(prefix="/api/ai", tags=["AI Assistant"])
groq_service = GroqService()


@router.post("/parse")
def parse_natural_language(payload: GroqPromptRequest):
    if not payload.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")
    result = groq_service.parse_instruction(payload.prompt)
    return result


@router.post("/explain-conflict")
def explain_conflict(payload: GroqConflictExplainRequest):
    explanation = groq_service.explain_conflict(payload.conflict_details)
    return {"explanation": explanation}


@router.post("/apply")
def apply_parsed_data(payload: GroqParsedData, db: Session = Depends(get_db)):
    """
    Safely applies validated structured data to the database:
    - Finds or creates teacher
    - Finds or creates subject/classes
    - Adds unavailability records
    - Creates staff assignments
    """
    logs = []

    # 1. Staff
    staff = None
    if payload.staff_name:
        staff = db.query(Staff).filter(Staff.name.ilike(payload.staff_name.strip())).first()
        if not staff:
            staff = Staff(name=payload.staff_name.strip())
            db.add(staff)
            db.flush()
            logs.append(f"Created staff member: {staff.name}")
        else:
            logs.append(f"Found existing staff member: {staff.name}")

    # 2. Subject
    subject = None
    if payload.subject_name:
        subject = db.query(Subject).filter(Subject.name.ilike(payload.subject_name.strip())).first()
        if not subject:
            code = payload.subject_name[:4].upper()
            subject = Subject(name=payload.subject_name.strip(), code=code)
            db.add(subject)
            db.flush()
            logs.append(f"Created subject: {subject.name} ({code})")
        else:
            logs.append(f"Found existing subject: {subject.name}")

    # 3. Associate Subject with Staff
    if staff and subject:
        has_qual = db.query(StaffSubject).filter(
            StaffSubject.staff_id == staff.id,
            StaffSubject.subject_id == subject.id
        ).first()
        if not has_qual:
            db.add(StaffSubject(staff_id=staff.id, subject_id=subject.id))
            logs.append(f"Qualified {staff.name} for {subject.name}")

    # 4. Classes and Assignments
    if payload.class_names:
        for c_name in payload.class_names:
            clean_name = c_name.strip().upper()
            cls = db.query(ClassRoom).filter(ClassRoom.name == clean_name).first()
            if not cls:
                parts = clean_name.split("-") if "-" in clean_name else [clean_name, "A"]
                cls = ClassRoom(name=clean_name, grade=parts[0], section=parts[1] if len(parts) > 1 else "A")
                db.add(cls)
                db.flush()
                logs.append(f"Created class: {cls.name}")

            if staff and subject:
                # Add assignment
                existing_asgn = db.query(StaffAssignment).filter(
                    StaffAssignment.class_id == cls.id,
                    StaffAssignment.subject_id == subject.id
                ).first()
                if not existing_asgn:
                    db.add(StaffAssignment(
                        staff_id=staff.id,
                        subject_id=subject.id,
                        class_id=cls.id
                    ))
                    logs.append(f"Assigned {staff.name} -> {subject.name} -> {cls.name}")

    # 5. Unavailability
    if staff and payload.unavailable:
        for un in payload.unavailable:
            exists = db.query(StaffAvailability).filter(
                StaffAvailability.staff_id == staff.id,
                StaffAvailability.day == un.day,
                StaffAvailability.period == un.period
            ).first()
            if not exists:
                db.add(StaffAvailability(
                    staff_id=staff.id,
                    day=un.day,
                    period=un.period,
                    is_available=False,
                    reason="Set via AI Assistant",
                ))
                logs.append(f"Marked {staff.name} unavailable on {un.day} Period {un.period}")

    db.commit()
    return {"success": True, "logs": logs}
