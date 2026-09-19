"""
FastAPI Main Application Entry Point.
Initializes database tables, loads demo seed data, configures CORS,
and mounts modular API routes.
"""

import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from app.database import engine, Base, SessionLocal
from app.models import (
    School,
    SchoolDay,
    TimeSlot,
    ClassRoom,
    Subject,
    ClassSubject,
    Staff,
    StaffSubject,
    StaffClass,
    StaffAssignment,
    StaffAvailability,
    TimetableEntry,
)
from app.routes import classes, subjects, staff, assignments, timings, timetable, conflicts, ai

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="School Timetable Creator & Staff Timetable Management System",
    description="Deterministic, constraint-based automated timetable generator and conflict checker with optional Groq AI assistant.",
    version="1.0.0",
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(classes.router)
app.include_router(subjects.router)
app.include_router(staff.router)
app.include_router(assignments.router)
app.include_router(timings.router)
app.include_router(timetable.router)
app.include_router(conflicts.router)
app.include_router(ai.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "School Timetable API", "python_version": "3.11+"}


def seed_sample_data():
    """
    Seeds comprehensive initial sample dataset (Requirement 34):
    - 5 classes (8-A, 8-B, 8-C, 9-A, 10-A)
    - 8 subjects (Mathematics, English, Science, Tamil, Social Science, Computer Science, Physical Education, Art)
    - 8 staff members
    - Diverse subject allocations & shared teacher cross-assignments (e.g. Mr. Kumar teaches Maths for 8-A, 8-B, 9-A)
    - School timings and active weekdays
    """
    db = SessionLocal()
    try:
        if db.query(ClassRoom).count() > 0:
            return  # Already seeded

        # 1. School & Timings
        school = School(
            name="Greenwood High School",
            academic_year="2026-2027",
            start_time="09:10",
            end_time="16:00",
            period_duration_minutes=40,
            total_periods=8,
            lunch_start="12:20",
            lunch_end="13:00",
            break1_start="10:50",
            break1_end="11:00",
            break2_start="14:50",
            break2_end="15:00",
        )
        db.add(school)

        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        for idx, d in enumerate(days, start=1):
            db.add(SchoolDay(day_name=d, day_order=idx, is_active=(d != "Saturday")))

        # 2. Subjects
        subjects_data = [
            {"name": "Mathematics", "code": "MATH", "color": "#3b82f6", "icon": "calculator", "category": "STEM", "consec": False, "default": 6},
            {"name": "English", "code": "ENG", "color": "#10b981", "icon": "book-open", "category": "Languages", "consec": False, "default": 5},
            {"name": "Science", "code": "SCI", "color": "#8b5cf6", "icon": "flask-conical", "category": "STEM", "consec": False, "default": 5},
            {"name": "Tamil", "code": "TAM", "color": "#f59e0b", "icon": "feather", "category": "Languages", "consec": False, "default": 4},
            {"name": "Social Science", "code": "SOC", "color": "#ec4899", "icon": "globe", "category": "Humanities", "consec": False, "default": 4},
            {"name": "Computer Science", "code": "CS", "color": "#06b6d4", "icon": "laptop", "category": "STEM", "consec": False, "default": 2},
            {"name": "Physical Education", "code": "PE", "color": "#84cc16", "icon": "trophy", "category": "Activities", "consec": False, "default": 2},
            {"name": "Art & Music", "code": "ART", "color": "#f97316", "icon": "palette", "category": "Creative", "consec": False, "default": 2},
        ]

        sub_objs = {}
        for s in subjects_data:
            obj = Subject(
                name=s["name"],
                code=s["code"],
                color=s["color"],
                icon=s["icon"],
                category=s["category"],
                requires_consecutive=s["consec"],
                default_periods_per_week=s["default"],
            )
            db.add(obj)
            db.flush()
            sub_objs[s["name"]] = obj

        # 3. Classes
        classes_data = [
            {"name": "8-A", "grade": "8", "section": "A", "room": "Room 101"},
            {"name": "8-B", "grade": "8", "section": "B", "room": "Room 102"},
            {"name": "8-C", "grade": "8", "section": "C", "room": "Room 103"},
            {"name": "9-A", "grade": "9", "section": "A", "room": "Room 201"},
            {"name": "10-A", "grade": "10", "section": "A", "room": "Room 301"},
        ]

        class_objs = {}
        for c in classes_data:
            c_obj = ClassRoom(name=c["name"], grade=c["grade"], section=c["section"], room_number=c["room"])
            db.add(c_obj)
            db.flush()
            class_objs[c["name"]] = c_obj

        # Class subject allocations (showing classes can have completely different requirements!)
        class_subject_allocations = {
            "8-A": [("Mathematics", 6), ("English", 5), ("Science", 5), ("Tamil", 4), ("Social Science", 4), ("Computer Science", 2), ("Physical Education", 2), ("Art & Music", 2)],
            "8-B": [("Mathematics", 6), ("English", 5), ("Science", 5), ("Tamil", 4), ("Social Science", 4), ("Computer Science", 2), ("Physical Education", 2), ("Art & Music", 2)],
            "8-C": [("Mathematics", 5), ("English", 5), ("Science", 5), ("Tamil", 5), ("Social Science", 4), ("Computer Science", 3), ("Physical Education", 3)],
            "9-A": [("Mathematics", 7), ("English", 5), ("Science", 6), ("Tamil", 4), ("Social Science", 4), ("Computer Science", 2), ("Physical Education", 2)],
            "10-A": [("Mathematics", 7), ("English", 5), ("Science", 7), ("Tamil", 4), ("Social Science", 4), ("Computer Science", 2), ("Physical Education", 1)],
        }

        for c_name, reqs in class_subject_allocations.items():
            cls = class_objs[c_name]
            for sub_name, periods in reqs:
                sub = sub_objs[sub_name]
                db.add(ClassSubject(class_id=cls.id, subject_id=sub.id, periods_per_week=periods))

        # 4. Staff members
        staff_data = [
            {"name": "Mr. Kumar", "emp_id": "EMP001", "email": "kumar@school.edu", "quals": ["Mathematics"], "classes": ["8-A", "8-B", "9-A"], "max_day": 6, "max_week": 26},
            {"name": "Ms. Priya", "emp_id": "EMP002", "email": "priya@school.edu", "quals": ["English", "Tamil"], "classes": ["8-A", "8-B", "9-A"], "max_day": 6, "max_week": 28},
            {"name": "Mr. Arun", "emp_id": "EMP003", "email": "arun@school.edu", "quals": ["Science"], "classes": ["8-A", "8-B", "9-A"], "max_day": 6, "max_week": 25},
            {"name": "Mrs. Lakshmi", "emp_id": "EMP004", "email": "lakshmi@school.edu", "quals": ["Social Science", "Tamil"], "classes": ["8-A", "8-B", "8-C", "10-A"], "max_day": 6, "max_week": 25},
            {"name": "Mr. David", "emp_id": "EMP005", "email": "david@school.edu", "quals": ["Computer Science", "Mathematics"], "classes": ["8-C", "10-A"], "max_day": 6, "max_week": 24},
            {"name": "Coach Rajesh", "emp_id": "EMP006", "email": "rajesh@school.edu", "quals": ["Physical Education"], "classes": ["8-A", "8-B", "8-C", "9-A", "10-A"], "max_day": 6, "max_week": 20},
            {"name": "Dr. Raman", "emp_id": "EMP007", "email": "raman@school.edu", "quals": ["Science", "Mathematics"], "classes": ["8-C", "10-A"], "max_day": 6, "max_week": 26},
            {"name": "Ms. Sunita", "emp_id": "EMP008", "email": "sunita@school.edu", "quals": ["English", "Art & Music"], "classes": ["8-C", "10-A", "8-A", "8-B"], "max_day": 6, "max_week": 24},
        ]

        staff_objs = {}
        for s in staff_data:
            st = Staff(
                name=s["name"],
                employee_id=s["emp_id"],
                email=s["email"],
                max_periods_per_day=s["max_day"],
                max_periods_per_week=s["max_week"],
            )
            db.add(st)
            db.flush()
            staff_objs[s["name"]] = st

            for q in s["quals"]:
                db.add(StaffSubject(staff_id=st.id, subject_id=sub_objs[q].id))

            for cl in s["classes"]:
                db.add(StaffClass(staff_id=st.id, class_id=class_objs[cl].id))

        # Teacher Unavailability Sample (e.g. Mr. Kumar not available Monday Period 3)
        kumar = staff_objs["Mr. Kumar"]
        db.add(StaffAvailability(staff_id=kumar.id, day="Monday", period=3, is_available=False, reason="Department Meeting"))

        # Teacher Assignments: Teacher -> Subject -> Class
        assignments_map = [
            # 8-A
            ("Mr. Kumar", "Mathematics", "8-A"),
            ("Ms. Priya", "English", "8-A"),
            ("Mr. Arun", "Science", "8-A"),
            ("Ms. Priya", "Tamil", "8-A"),
            ("Mrs. Lakshmi", "Social Science", "8-A"),
            ("Mr. David", "Computer Science", "8-A"),
            ("Coach Rajesh", "Physical Education", "8-A"),
            ("Ms. Sunita", "Art & Music", "8-A"),

            # 8-B
            ("Mr. Kumar", "Mathematics", "8-B"),
            ("Ms. Priya", "English", "8-B"),
            ("Mr. Arun", "Science", "8-B"),
            ("Mrs. Lakshmi", "Tamil", "8-B"),
            ("Mrs. Lakshmi", "Social Science", "8-B"),
            ("Mr. David", "Computer Science", "8-B"),
            ("Coach Rajesh", "Physical Education", "8-B"),
            ("Ms. Sunita", "Art & Music", "8-B"),

            # 8-C
            ("Mr. David", "Mathematics", "8-C"),
            ("Ms. Sunita", "English", "8-C"),
            ("Dr. Raman", "Science", "8-C"),
            ("Mrs. Lakshmi", "Tamil", "8-C"),
            ("Mrs. Lakshmi", "Social Science", "8-C"),
            ("Mr. David", "Computer Science", "8-C"),
            ("Coach Rajesh", "Physical Education", "8-C"),

            # 9-A
            ("Mr. Kumar", "Mathematics", "9-A"),
            ("Ms. Priya", "English", "9-A"),
            ("Mr. Arun", "Science", "9-A"),
            ("Ms. Priya", "Tamil", "9-A"),
            ("Mrs. Lakshmi", "Social Science", "9-A"),
            ("Mr. David", "Computer Science", "9-A"),
            ("Coach Rajesh", "Physical Education", "9-A"),

            # 10-A
            ("Dr. Raman", "Mathematics", "10-A"),
            ("Ms. Sunita", "English", "10-A"),
            ("Dr. Raman", "Science", "10-A"),
            ("Mrs. Lakshmi", "Tamil", "10-A"),
            ("Mrs. Lakshmi", "Social Science", "10-A"),
            ("Mr. David", "Computer Science", "10-A"),
            ("Coach Rajesh", "Physical Education", "10-A"),
        ]

        for st_name, sub_name, c_name in assignments_map:
            st = staff_objs[st_name]
            sub = sub_objs[sub_name]
            cls = class_objs[c_name]
            db.add(StaffAssignment(staff_id=st.id, subject_id=sub.id, class_id=cls.id))

        db.commit()
    finally:
        db.close()


# Seed on startup
seed_sample_data()
