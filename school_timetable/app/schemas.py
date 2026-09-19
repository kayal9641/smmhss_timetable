"""
Pydantic schemas for data validation, API input/output, and LLM structured responses.
Includes lightweight fallback for environments where Pydantic is being installed.
"""

from typing import List, Optional, Dict, Any

try:
    from pydantic import BaseModel, Field
except ImportError:
    class BaseModel:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)
        def model_dump(self, *args, **kwargs):
            return {k: v for k, v in self.__dict__.items() if not k.startswith('_')}
        def dict(self, *args, **kwargs):
            return self.model_dump(*args, **kwargs)

    def Field(default=None, **kwargs):
        return default


# --- Class Models ---
class ClassSubjectBase(BaseModel):
    subject_id: int
    periods_per_week: int = Field(ge=1, le=15)


class ClassSubjectRead(ClassSubjectBase):
    id: int
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    color: Optional[str] = None

    class Config:
        from_attributes = True


class ClassCreate(BaseModel):
    name: str = Field(..., example="8-A")
    grade: str = Field(..., example="8")
    section: str = Field(..., example="A")
    room_number: Optional[str] = None
    subjects: Optional[List[ClassSubjectBase]] = []


class ClassUpdate(BaseModel):
    name: Optional[str] = None
    grade: Optional[str] = None
    section: Optional[str] = None
    room_number: Optional[str] = None
    subjects: Optional[List[ClassSubjectBase]] = None


class ClassRead(BaseModel):
    id: int
    name: str
    grade: str
    section: str
    room_number: Optional[str] = None
    class_subjects: List[ClassSubjectRead] = []

    class Config:
        from_attributes = True


# --- Subject Models ---
class SubjectCreate(BaseModel):
    name: str = Field(..., example="Mathematics")
    code: str = Field(..., example="MATH")
    color: str = Field(default="#3b82f6")
    icon: str = Field(default="book")
    category: str = Field(default="General")
    requires_consecutive: bool = False
    default_periods_per_week: int = Field(default=5, ge=1, le=15)


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    category: Optional[str] = None
    requires_consecutive: Optional[bool] = None
    default_periods_per_week: Optional[int] = None


class SubjectRead(SubjectCreate):
    id: int

    class Config:
        from_attributes = True


# --- Staff Models ---
class StaffAvailabilityItem(BaseModel):
    day: str
    period: int
    is_available: bool = False
    reason: Optional[str] = None


class StaffCreate(BaseModel):
    name: str = Field(..., example="Mr. Kumar")
    employee_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    max_periods_per_day: int = Field(default=6, ge=1, le=10)
    max_periods_per_week: int = Field(default=30, ge=1, le=50)
    qualified_subject_ids: List[int] = []
    assigned_class_ids: List[int] = []
    unavailabilities: List[StaffAvailabilityItem] = []


class StaffUpdate(BaseModel):
    name: Optional[str] = None
    employee_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    max_periods_per_day: Optional[int] = None
    max_periods_per_week: Optional[int] = None
    qualified_subject_ids: Optional[List[int]] = None
    assigned_class_ids: Optional[List[int]] = None
    unavailabilities: Optional[List[StaffAvailabilityItem]] = None


class StaffRead(BaseModel):
    id: int
    name: str
    employee_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    max_periods_per_day: int
    max_periods_per_week: int
    qualified_subjects: List[SubjectRead] = []
    assigned_classes: List[ClassRead] = []
    unavailabilities: List[StaffAvailabilityItem] = []

    class Config:
        from_attributes = True


# --- Assignment Models ---
class AssignmentCreate(BaseModel):
    staff_id: int
    subject_id: int
    class_id: int


class AssignmentRead(BaseModel):
    id: int
    staff_id: int
    staff_name: str
    subject_id: int
    subject_name: str
    class_id: int
    class_name: str

    class Config:
        from_attributes = True


# --- Timetable Entry Models ---
class TimetableEntryCreate(BaseModel):
    day: str
    period: int
    class_id: int
    subject_id: int
    staff_id: int
    room_number: Optional[str] = None


class TimetableEntryUpdate(BaseModel):
    day: Optional[str] = None
    period: Optional[int] = None
    class_id: Optional[int] = None
    subject_id: Optional[int] = None
    staff_id: Optional[int] = None
    room_number: Optional[str] = None


class TimetableEntryRead(BaseModel):
    id: int
    day: str
    period: int
    class_id: int
    class_name: str
    subject_id: int
    subject_name: str
    subject_color: str
    staff_id: int
    staff_name: str
    room_number: Optional[str] = None

    class Config:
        from_attributes = True


# --- School Timings & Days ---
class SchoolTimingConfig(BaseModel):
    school_name: str = "Greenwood Academy"
    academic_year: str = "2026-2027"
    start_time: str = "09:10"
    end_time: str = "16:00"
    period_duration_minutes: int = 40
    total_periods: int = 8
    lunch_start: str = "12:20"
    lunch_end: str = "13:00"
    break1_start: str = "10:50"
    break1_end: str = "11:00"
    break2_start: str = "14:50"
    break2_end: str = "15:00"
    active_days: List[str] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]


# --- Generation & Conflicts ---
class GenerationRequest(BaseModel):
    random_seed: Optional[int] = 42
    allow_consecutive_teacher_periods: bool = True
    spread_subjects_across_days: bool = True


class RegenerationRequest(BaseModel):
    scope: str = Field(..., example="class", description="'all', 'class', 'staff', 'day'")
    target_id: Optional[int] = None  # class_id or staff_id
    day_name: Optional[str] = None


class ConflictItem(BaseModel):
    severity: str  # high, medium, low
    conflict_type: str
    day: Optional[str] = None
    period: Optional[int] = None
    class_name: Optional[str] = None
    staff_name: Optional[str] = None
    subject_name: Optional[str] = None
    explanation: str
    suggested_fix: Optional[str] = None


class GenerationResponse(BaseModel):
    success: bool
    status: str
    total_required: int
    total_scheduled: int
    missing_periods: int
    conflicts: List[ConflictItem]
    soft_score: int
    execution_time_ms: int
    message: str


# --- Groq AI Schemas ---
class GroqParsedUnavailable(BaseModel):
    day: str
    period: int


class GroqParsedData(BaseModel):
    staff_name: Optional[str] = None
    subject_name: Optional[str] = None
    class_names: List[str] = []
    periods_per_week: Optional[int] = None
    unavailable: List[GroqParsedUnavailable] = []
    notes: Optional[str] = None


class GroqPromptRequest(BaseModel):
    prompt: str


class GroqConflictExplainRequest(BaseModel):
    conflict_details: Dict[str, Any]
