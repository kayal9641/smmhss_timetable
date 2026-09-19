# School Timetable Creator & Staff Timetable Management System

A production-ready, constraint-based automated school timetable generator and staff schedule management application built with **Python 3.11+**, **FastAPI**, **SQLAlchemy**, and **SQLite**.

The system features a deterministic constraint solver (Backtracking with MRV heuristic, forward checking, and constraint propagation) that guarantees conflict-free schedules across all standards and teachers, with optional Groq LLM integration for natural language data entry and intelligent conflict explanations.

---

## 🚀 Key Features

1. **Deterministic Constraint-Solving Engine**:
   - Zero hallucinations — scheduling decisions are calculated with a deterministic constraint engine.
   - Enforces 100% hard constraints:
     - No teacher double-booking (`teacher_id + day + period` unique).
     - No class double-booking (`class_id + day + period` unique).
     - Subject qualification checks (teachers teach only authorized subjects).
     - School breaks and lunch periods strictly reserved.
     - Teacher availability matrix respected.
     - Maximum periods/day and periods/week limits honored.
     - Exact weekly subject requirements per class.
   - Soft constraints: spreads subjects evenly across days, avoids teacher burnout, balances workload.

2. **Single Source of Truth**:
   - Timetable entries are generated once and saved to a unified master table.
   - Class timetables and Staff timetables are derived synchronously from the same records.

3. **Application Dashboard & Views**:
   - **Class Timetable**: Weekly grid with period times, subject color pills, teacher names, room numbers, drag-and-drop / manual edit, export, and single-class regeneration.
   - **Staff Timetable**: Weekly workload grid with clear **FREE** period tags, class assignments, and workload metrics.
   - **School & Class Management**: Custom subjects and period counts per class (different classes can have completely different subjects).
   - **Subject Management**: Codes, colors, categories, consecutive period flags.
   - **Staff Management**: Qualifications, assigned standards, daily/weekly limits, availability matrix.
   - **Staff Assignments**: Direct Teacher → Subject → Class mappings with qualification validation.
   - **School Timings**: Start/end hours, customizable 40-minute periods, morning/afternoon breaks, lunch, and active weekday toggles.
   - **Conflict Checker**: Detailed audit reporting conflicts with severity, affected entities, plain-English explanations, and one-click fixes.
   - **Optional Groq AI Assistant**: Parses conversational instructions (e.g. *"Mr Kumar teaches maths for 8A and 8B. He is unavailable Monday period 3"*) into validated Pydantic models.

---

## 🛠️ Technology Stack

- **Backend**: Python 3.11+, FastAPI, Uvicorn
- **Database**: SQLite with SQLAlchemy ORM (auto-migrated)
- **Validation**: Pydantic v2
- **AI/LLM**: Groq API (`llama-3.3-70b-versatile`) with offline fallback parser
- **Frontend**: Modern responsive web UI with Tailwind CSS and Lucide icons

---

## 📦 Project Structure

```
school_timetable/
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI app & initial demo seed data
│   ├── database.py              # SQLite & SQLAlchemy engine
│   ├── models.py                # Database models with unique constraints
│   ├── schemas.py               # Pydantic schemas for validation
│   ├── routes/
│   │   ├── classes.py           # Class management routes
│   │   ├── subjects.py          # Subject management routes
│   │   ├── staff.py             # Staff & availability routes
│   │   ├── assignments.py       # Teacher -> Subject -> Class routes
│   │   ├── timings.py           # School timing & hours routes
│   │   ├── timetable.py         # Generation, class/staff views, move entry
│   │   ├── conflicts.py         # Conflict auditing route
│   │   └── ai.py                # Groq natural language parser & explainer
│   └── services/
│       ├── scheduler.py         # Deterministic constraint solver (MRV + Backtracking)
│       ├── conflict_checker.py  # Hard & soft constraint auditor
│       ├── timetable_generator.py # INPUT -> VALIDATE -> GENERATE -> VALIDATE -> SAVE
│       └── groq_service.py      # Groq LLM integration & prompt validation
├── tests/
│   ├── test_scheduler.py        # Algorithm & impossible case unit tests
│   ├── test_conflict_checker.py # Double-booking & overload unit tests
│   └── test_ai.py               # Prompt parser unit tests
├── .env.example
├── requirements.txt
└── README.md
```

---

## ⚙️ Installation & Setup

### 1. Prerequisites
- Python 3.11 or higher
- `git`

### 2. Clone & Setup Virtual Environment
```bash
# Navigate to the school_timetable directory
cd school_timetable

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On Linux/macOS:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```
Edit `.env` to supply your optional Groq API key:
```env
GROQ_API_KEY=gsk_your_groq_api_key_here
DATABASE_URL=sqlite:///./timetable.db
```
*(Note: If `GROQ_API_KEY` is omitted, the core timetable generator, conflict checker, and local rule-based AI parser continue functioning completely without disruption).*

---

## 🏃 Running the Application

Start the FastAPI development server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Open your browser to:
- **Interactive API Documentation (Swagger UI)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc Documentation**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check**: [http://localhost:8000/api/health](http://localhost:8000/api/health)

When the server first boots, it automatically runs `seed_sample_data()` to initialize:
- **5 Classes**: 8-A, 8-B, 8-C, 9-A, 10-A
- **8 Subjects**: Mathematics, English, Science, Tamil, Social Science, Computer Science, Physical Education, Art & Music
- **8 Teachers**: Cross-assigned across standards (e.g. Mr. Kumar teaches Maths to 8-A, 8-B, 9-A)
- **Teacher Unavailability**: Mr. Kumar unavailable on Monday Period 3
- **Full Timings**: 9:10 AM – 4:00 PM, 8 periods, breaks, and lunch

---

## 🧪 Running Automated Tests

The test suite thoroughly verifies all constraints without requiring external dependencies:
```bash
# From the project root:
PYTHONPATH=school_timetable python3 -m unittest discover -s school_timetable/tests -v
```

All 13 test suites verify:
- Teacher double booking prevention
- Class double booking prevention
- Teacher qualification verification
- Teacher availability respect
- Daily period limit enforcement (overload detection)
- Weekly period limit enforcement
- Subject weekly requirement match (missing & extra periods)
- Lunch and break period protection
- Impossible schedule detection with diagnostics
- Deterministic constraint solver accuracy
- Groq AI prompt parser and fallback extraction

---

## 📖 Step-by-Step Administrator Workflow

1. **Add or Edit Classes** (`GET/POST /api/classes`):
   - Define grade, section, and room number.
   - Configure required periods/week for each subject (e.g. 8-A: Maths 6, English 5, Science 5...).

2. **Define Subjects** (`GET/POST /api/subjects`):
   - Set subject name, code, category, and color.
   - Toggle whether the subject requires consecutive double-periods.

3. **Manage Staff** (`GET/POST /api/staff`):
   - Add teacher name, employee ID, max periods/day (e.g. 6), max periods/week (e.g. 26).
   - Select subjects the teacher is qualified to teach.
   - Select classes the teacher can handle.

4. **Set Teacher Availability** (`PUT /api/staff/{id}`):
   - Mark specific days and periods where a teacher has departmental meetings or leave.

5. **Assign Teachers to Classes** (`POST /api/assignments`):
   - Map `Teacher -> Subject -> Class` (e.g. Mr. Kumar -> Mathematics -> 8-A).
   - The system checks teacher qualifications before allowing the assignment.

6. **Configure School Timings** (`POST /api/timings`):
   - Set start time (09:10), period length (40 mins), lunch (12:20 - 13:00), breaks (10:50 - 11:00, 14:50 - 15:00).
   - View visual timeline and overlap warnings.

7. **Generate Timetable** (`POST /api/timetable/generate`):
   - Validates data feasibility.
   - Runs backtracking constraint solver.
   - Verifies 0 conflicts.
   - Persists master timetable to database.

8. **View & Edit Timetables**:
   - View weekly timetable by **Class** or by **Staff**.
   - Move or swap entries with instant real-time conflict checking (`PUT /api/timetable/{id}`).
   - View free periods for staff members.

9. **Export & Print**:
   - Print clean class or staff timetable cards.
   - Export CSV or Excel spreadsheets.
