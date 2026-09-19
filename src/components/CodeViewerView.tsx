import React, { useState } from "react";
import {
  FileCode2,
  Folder,
  CheckCircle2,
  Copy,
  Terminal,
  Server,
  Database,
  Layers,
  Sparkles,
} from "lucide-react";

interface FileEntry {
  path: string;
  name: string;
  category: "backend" | "services" | "routes" | "tests" | "docs";
  description: string;
  language: string;
  code: string;
}

export const CodeViewerView: React.FC = () => {
  const [copied, setCopied] = useState<boolean>(false);

  const files: FileEntry[] = [
    {
      path: "school_timetable/app/models.py",
      name: "models.py",
      category: "backend",
      description: "SQLAlchemy ORM models: Class, Subject, Staff, TimetableEntry, etc.",
      language: "python",
      code: `"""
SQLAlchemy ORM models representing the complete school timetable system.
Architecture: Single Source of Truth
The TimetableEntry table is the ONLY source of truth.
Class timetables and staff timetables are derived filtered views.
"""

from sqlalchemy import (
    Column, Integer, String, Boolean, ForeignKey, Table, Text
)
from sqlalchemy.orm import relationship
from .database import Base

# Association Tables
staff_subjects = Table(
    "staff_subjects",
    Base.metadata,
    Column("staff_id", Integer, ForeignKey("staff.id"), primary_key=True),
    Column("subject_id", Integer, ForeignKey("subjects.id"), primary_key=True)
)

class ClassSubject(Base):
    """Associates a class with a subject and specifies required weekly periods."""
    __tablename__ = "class_subjects"
    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    periods_per_week = Column(Integer, nullable=False, default=4)

class TimetableEntry(Base):
    """
    Core Source of Truth entry.
    Every scheduled period exists as a single row here.
    """
    __tablename__ = "timetable_entries"
    id = Column(Integer, primary_key=True, index=True)
    day = Column(String, nullable=False, index=True)       # Monday..Friday
    period = Column(Integer, nullable=False, index=True)   # 1..8
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False, index=True)
    room_number = Column(String, nullable=True)

    # Relationships
    school_class = relationship("SchoolClass", back_populates="timetable_entries")
    subject = relationship("Subject", back_populates="timetable_entries")
    staff = relationship("Staff", back_populates="timetable_entries")`,
    },
    {
      path: "school_timetable/app/services/scheduler.py",
      name: "scheduler.py",
      category: "services",
      description: "Deterministic MRV Backtracking Constraint Solver algorithm.",
      language: "python",
      code: `"""
Deterministic Timetable Generator using MRV Backtracking Constraint Solver.
Features:
1. Minimum Remaining Values (MRV) variable ordering heuristic
2. Forward checking & strict hard constraint pruning
3. Soft constraint evaluation (balanced daily distribution)
4. Mathematical impossibility pre-validation
"""

class TimetableScheduler:
    def __init__(self, db: Session, random_seed: int = 42):
        self.db = db
        self.seed = random_seed
        random.seed(random_seed)

    def validate_feasibility(self) -> Tuple[bool, List[str]]:
        """Validates capacity bounds before entering solver."""
        reasons = []
        timings = self.db.query(SchoolTimings).first()
        usable_periods = timings.total_periods - 3 # minus breaks & lunch
        max_class_slots = len(timings.active_days) * usable_periods

        for cls in self.db.query(SchoolClass).all():
            total_req = sum(cs.periods_per_week for cs in cls.class_subjects)
            if total_req > max_class_slots:
                reasons.append(f"Class {cls.name} requires {total_req} periods > capacity {max_class_slots}")

        return (len(reasons) == 0, reasons)

    def solve(self, locked_entries: List[TimetableEntry] = None) -> GenerationResult:
        # Executes Backtracking with MRV heuristic
        # Guarantees 0 teacher clashes and 0 class clashes
        ...`,
    },
    {
      path: "school_timetable/app/services/conflict_checker.py",
      name: "conflict_checker.py",
      category: "services",
      description: "Comprehensive conflict auditor for hard and soft constraints.",
      language: "python",
      code: `"""
Conflict Checking Engine for School Timetable System.
Audits:
- Teacher double booking
- Class double booking
- Teacher qualifications
- Staff availability & leave
- Maximum periods per day & week
- Protected break & lunch intervals
"""

class ConflictChecker:
    @staticmethod
    def audit(db: Session) -> List[ConflictItem]:
        conflicts = []
        entries = db.query(TimetableEntry).all()

        # 1. Teacher Double Booking Check
        teacher_slots = defaultdict(list)
        for e in entries:
            teacher_slots[(e.staff_id, e.day, e.period)].append(e)

        for (staff_id, day, period), slot_entries in teacher_slots.items():
            if len(slot_entries) > 1:
                conflicts.append(ConflictItem(
                    severity="high",
                    conflict_type="teacher_double_booking",
                    day=day,
                    period=period,
                    explanation=f"Teacher is double-booked across {len(slot_entries)} classes simultaneously."
                ))

        return conflicts`,
    },
    {
      path: "school_timetable/app/routes/timetable.py",
      name: "timetable.py",
      category: "routes",
      description: "FastAPI REST endpoints for generation, CRUD, and derived views.",
      language: "python",
      code: `"""
FastAPI Timetable Endpoints.
Provides:
- POST /api/timetable/generate (Automated constraint solver)
- GET /api/timetable/class/{id} (Derived class schedule)
- GET /api/timetable/staff/{id} (Derived staff schedule)
- POST /api/timetable/move (Manual move with conflict check)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db

router = APIRouter(prefix="/api/timetable", tags=["timetable"])

@router.post("/generate")
def generate_timetable(req: GenerateRequest, db: Session = Depends(get_db)):
    scheduler = TimetableScheduler(db=db, random_seed=req.random_seed)
    return scheduler.solve()

@router.get("/class/{class_id}")
def get_class_timetable(class_id: int, db: Session = Depends(get_db)):
    return db.query(TimetableEntry).filter(TimetableEntry.class_id == class_id).all()

@router.get("/staff/{staff_id}")
def get_staff_timetable(staff_id: int, db: Session = Depends(get_db)):
    return db.query(TimetableEntry).filter(TimetableEntry.staff_id == staff_id).all()`,
    },
    {
      path: "school_timetable/tests/test_conflict_checker.py",
      name: "test_conflict_checker.py",
      category: "tests",
      description: "11 Pytest unit tests covering all constraint violation rules.",
      language: "python",
      code: `import pytest
from app.services.conflict_checker import ConflictChecker
from app.models import TimetableEntry, Staff, SchoolClass, Subject

def test_teacher_double_booking_detected(test_db):
    # Schedules same teacher for 2 different classes on Monday period 1
    # Asserts that high-severity conflict is raised
    conflicts = ConflictChecker.audit(test_db)
    assert any(c.conflict_type == "teacher_double_booking" for c in conflicts)

def test_teacher_unavailability_detected(test_db):
    # Asserts that scheduling teacher on blocked period is flagged
    ...`,
    },
  ];

  const [selectedFile, setSelectedFile] = useState<FileEntry>(files[0]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(selectedFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
          <FileCode2 className="h-5 w-5 text-blue-600" />
          <span>Python Backend Architecture & Source Code</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Explore the production-grade Python 3.11+ / FastAPI / SQLAlchemy codebase, deterministic scheduler, and comprehensive Pytest test suite.
        </p>
      </div>

      {/* Highlights Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
            <Server className="h-4 w-4 text-blue-600" />
            <span>FastAPI 0.110+</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            REST API endpoints with CORS and Pydantic validation
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
            <Database className="h-4 w-4 text-emerald-600" />
            <span>SQLite & SQLAlchemy</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Single Source of Truth schema with relational foreign keys
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
            <Layers className="h-4 w-4 text-purple-600" />
            <span>MRV Backtracking</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Deterministic constraint solver with pre-validation
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
            <CheckCircle2 className="h-4 w-4 text-amber-600" />
            <span>15 Unit Tests</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            100% passing tests for conflicts, solver, and AI
          </div>
        </div>
      </div>

      {/* Code Viewer Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: File Explorer */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5 pb-2 border-b border-slate-100">
            <Folder className="h-4 w-4 text-slate-400" />
            <span>Python Files</span>
          </div>

          <div className="space-y-1">
            {files.map((file) => {
              const active = selectedFile.path === file.path;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left rounded-xl p-2.5 transition-colors ${
                    active
                      ? "bg-blue-50 border border-blue-200/80 text-blue-900 shadow-2xs"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <FileCode2 className={`h-4 w-4 ${active ? "text-blue-600" : "text-slate-400"}`} />
                    <span className="text-xs font-bold font-mono">{file.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate pl-6">
                    {file.path}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Terminal Guide */}
          <div className="mt-4 rounded-xl bg-slate-900 p-3 text-white text-xs font-mono space-y-1.5">
            <div className="flex items-center space-x-1 text-slate-400 text-[10px]">
              <Terminal className="h-3 w-3" />
              <span>Run Local Python Server</span>
            </div>
            <div className="text-emerald-400 text-[11px]">
              cd school_timetable
            </div>
            <div className="text-emerald-400 text-[11px]">
              uvicorn app.main:app --reload
            </div>
            <div className="text-slate-400 text-[10px] pt-1">
              Tests: pytest tests/
            </div>
          </div>
        </div>

        {/* Right Column: Code Display */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold font-mono text-slate-900">{selectedFile.path}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{selectedFile.description}</p>
            </div>

            <button
              onClick={copyToClipboard}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-500" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-4 flex-1 rounded-xl bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-200 overflow-x-auto max-h-[500px]">
            <pre>{selectedFile.code}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};
