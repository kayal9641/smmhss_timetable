"""
SQLAlchemy database models representing the School Timetable system.
Includes classes, subjects, staff, assignments, availability, timings, and timetable entries
with database-level constraints preventing double-booking of teachers and classes.
"""

from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    ForeignKey,
    DateTime,
    UniqueConstraint,
    Text,
)
from sqlalchemy.orm import relationship
from app.database import Base


class School(Base):
    __tablename__ = "schools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False, default="Greenwood Academy")
    academic_year = Column(String(50), nullable=False, default="2026-2027")
    start_time = Column(String(10), default="09:10")
    end_time = Column(String(10), default="16:00")
    period_duration_minutes = Column(Integer, default=40)
    total_periods = Column(Integer, default=8)
    lunch_start = Column(String(10), default="12:20")
    lunch_end = Column(String(10), default="13:00")
    break1_start = Column(String(10), default="10:50")
    break1_end = Column(String(10), default="11:00")
    break2_start = Column(String(10), default="14:50")
    break2_end = Column(String(10), default="15:00")


class SchoolDay(Base):
    __tablename__ = "school_days"

    id = Column(Integer, primary_key=True, index=True)
    day_name = Column(String(20), unique=True, nullable=False)  # Monday, Tuesday...
    day_order = Column(Integer, nullable=False)  # 1, 2, 3...
    is_active = Column(Boolean, default=True)


class TimeSlot(Base):
    __tablename__ = "time_slots"

    id = Column(Integer, primary_key=True, index=True)
    period_number = Column(Integer, nullable=False)
    start_time = Column(String(10), nullable=False)
    end_time = Column(String(10), nullable=False)
    is_break = Column(Boolean, default=False)
    slot_type = Column(String(20), default="class")  # class, break, lunch
    label = Column(String(50), default="Period")


class ClassRoom(Base):
    __tablename__ = "classes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)  # e.g. 8-A, 9-B
    grade = Column(String(20), nullable=False)  # e.g. 8, 9, 10
    section = Column(String(10), nullable=False)  # e.g. A, B, C
    room_number = Column(String(20), nullable=True)

    # Relationships
    class_subjects = relationship("ClassSubject", back_populates="class_room", cascade="all, delete-orphan")
    assignments = relationship("StaffAssignment", back_populates="class_room", cascade="all, delete-orphan")
    timetable_entries = relationship("TimetableEntry", back_populates="class_room", cascade="all, delete-orphan")


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    color = Column(String(20), default="#3b82f6")  # UI color
    icon = Column(String(50), default="book")
    category = Column(String(50), default="General")  # Languages, Sciences, Arts, Sports
    requires_consecutive = Column(Boolean, default=False)
    default_periods_per_week = Column(Integer, default=5)

    # Relationships
    class_subjects = relationship("ClassSubject", back_populates="subject", cascade="all, delete-orphan")
    staff_qualifications = relationship("StaffSubject", back_populates="subject", cascade="all, delete-orphan")
    assignments = relationship("StaffAssignment", back_populates="subject", cascade="all, delete-orphan")
    timetable_entries = relationship("TimetableEntry", back_populates="subject", cascade="all, delete-orphan")


class ClassSubject(Base):
    """Specific period requirement per class (different classes can have different requirements)."""
    __tablename__ = "class_subjects"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    periods_per_week = Column(Integer, nullable=False, default=5)

    class_room = relationship("ClassRoom", back_populates="class_subjects")
    subject = relationship("Subject", back_populates="class_subjects")

    __table_args__ = (
        UniqueConstraint("class_id", "subject_id", name="uq_class_subject"),
    )


class Staff(Base):
    __tablename__ = "staff"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    employee_id = Column(String(50), unique=True, nullable=True)
    email = Column(String(120), nullable=True)
    phone = Column(String(30), nullable=True)
    max_periods_per_day = Column(Integer, default=6)
    max_periods_per_week = Column(Integer, default=30)
    preferred_free_periods = Column(Text, nullable=True)  # JSON or comma-separated

    # Relationships
    qualified_subjects = relationship("StaffSubject", back_populates="staff", cascade="all, delete-orphan")
    assigned_classes = relationship("StaffClass", back_populates="staff", cascade="all, delete-orphan")
    assignments = relationship("StaffAssignment", back_populates="staff", cascade="all, delete-orphan")
    availabilities = relationship("StaffAvailability", back_populates="staff", cascade="all, delete-orphan")
    timetable_entries = relationship("TimetableEntry", back_populates="staff", cascade="all, delete-orphan")


class StaffSubject(Base):
    __tablename__ = "staff_subjects"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)

    staff = relationship("Staff", back_populates="qualified_subjects")
    subject = relationship("Subject", back_populates="staff_qualifications")

    __table_args__ = (
        UniqueConstraint("staff_id", "subject_id", name="uq_staff_subject"),
    )


class StaffClass(Base):
    __tablename__ = "staff_classes"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id", ondelete="CASCADE"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)

    staff = relationship("Staff", back_populates="assigned_classes")
    class_room = relationship("ClassRoom")

    __table_args__ = (
        UniqueConstraint("staff_id", "class_id", name="uq_staff_class"),
    )


class StaffAssignment(Base):
    """Dedicated teacher assignment: Teacher -> Subject -> Class."""
    __tablename__ = "staff_assignments"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)

    staff = relationship("Staff", back_populates="assignments")
    subject = relationship("Subject", back_populates="assignments")
    class_room = relationship("ClassRoom", back_populates="assignments")

    __table_args__ = (
        UniqueConstraint("class_id", "subject_id", name="uq_assignment_class_subject"),
    )


class StaffAvailability(Base):
    """Tracks unavailable slots for a teacher (day + period)."""
    __tablename__ = "staff_availabilities"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id", ondelete="CASCADE"), nullable=False)
    day = Column(String(20), nullable=False)  # e.g. Monday
    period = Column(Integer, nullable=False)  # 1 to 8
    is_available = Column(Boolean, default=False)  # False = unavailable
    reason = Column(String(100), nullable=True)

    staff = relationship("Staff", back_populates="availabilities")

    __table_args__ = (
        UniqueConstraint("staff_id", "day", "period", name="uq_staff_day_period_avail"),
    )


class TimetableEntry(Base):
    """Single master timetable record ensuring both class and staff schedules are in sync."""
    __tablename__ = "timetable_entries"

    id = Column(Integer, primary_key=True, index=True)
    day = Column(String(20), nullable=False)  # Monday, Tuesday, etc.
    period = Column(Integer, nullable=False)  # 1, 2, 3, etc.
    class_id = Column(Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    staff_id = Column(Integer, ForeignKey("staff.id", ondelete="CASCADE"), nullable=False)
    room_number = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    class_room = relationship("ClassRoom", back_populates="timetable_entries")
    subject = relationship("Subject", back_populates="timetable_entries")
    staff = relationship("Staff", back_populates="timetable_entries")

    __table_args__ = (
        # HARD CONSTRAINT: No class can have two subjects in the same period on the same day
        UniqueConstraint("class_id", "day", "period", name="uq_class_day_period"),
        # HARD CONSTRAINT: No teacher can teach two classes in the same period on the same day
        UniqueConstraint("staff_id", "day", "period", name="uq_staff_day_period"),
    )


class GenerationRun(Base):
    __tablename__ = "generation_runs"

    id = Column(Integer, primary_key=True, index=True)
    status = Column(String(20), default="pending")  # completed, failed, partial
    total_required = Column(Integer, default=0)
    total_scheduled = Column(Integer, default=0)
    conflict_count = Column(Integer, default=0)
    soft_score = Column(Integer, default=100)
    execution_time_ms = Column(Integer, default=0)
    diagnostics = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Conflict(Base):
    __tablename__ = "conflicts"

    id = Column(Integer, primary_key=True, index=True)
    severity = Column(String(20), default="high")  # high, medium, low
    conflict_type = Column(String(50), nullable=False)  # teacher_double_booking, class_double_booking, etc.
    day = Column(String(20), nullable=True)
    period = Column(Integer, nullable=True)
    class_name = Column(String(50), nullable=True)
    staff_name = Column(String(100), nullable=True)
    subject_name = Column(String(100), nullable=True)
    explanation = Column(Text, nullable=False)
    suggested_fix = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
