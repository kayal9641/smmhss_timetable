import React from "react";
import {
  CalendarDays,
  UserCheck,
  GraduationCap,
  Users,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Play,
  Sparkles,
  ArrowRight,
  Clock,
  Coffee,
  Utensils,
  ShieldCheck,
} from "lucide-react";
import {
  SchoolClass,
  Staff,
  Subject,
  TimetableEntry,
  SchoolTimings,
  ConflictItem,
  NavigationTab,
  StaffAssignment,
} from "../types";

interface DashboardViewProps {
  classes: SchoolClass[];
  staffList: Staff[];
  subjects: Subject[];
  assignments?: StaffAssignment[];
  entries: TimetableEntry[];
  timings: SchoolTimings;
  conflicts: ConflictItem[];
  onNavigate: (tab: NavigationTab) => void;
  onOpenGenerate: () => void;
  onOpenAI: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  classes,
  staffList,
  subjects,
  assignments = [],
  entries,
  timings,
  conflicts,
  onNavigate,
  onOpenGenerate,
  onOpenAI,
}) => {
  const totalRequiredPeriods = classes.reduce(
    (acc, c) => acc + c.subjects.reduce((sum, s) => sum + s.periods_per_week, 0),
    0
  );
  const scheduledPeriods = entries.length;
  const isComplete = scheduledPeriods > 0 && scheduledPeriods >= totalRequiredPeriods && conflicts.length === 0;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 p-6 text-white shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-blue-100 backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Deterministic Constraint Solver Active</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              School Timetable Management Dashboard
            </h2>
            <p className="text-sm text-blue-100/80 max-w-2xl">
              Automatic conflict-free school timetable generation for all classes and synchronized staff schedules from a single source of truth.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="dash-btn-ai"
              onClick={onOpenAI}
              className="inline-flex items-center space-x-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-semibold text-white backdrop-blur hover:bg-white/20 transition-colors"
            >
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span>AI Setup Assistant</span>
            </button>

            <button
              id="dash-btn-generate"
              onClick={onOpenGenerate}
              className="inline-flex items-center space-x-2 rounded-xl bg-white px-5 py-2.5 text-xs font-semibold text-blue-900 shadow-md hover:bg-blue-50 transition-colors"
            >
              <Play className="h-4 w-4 fill-current text-blue-700" />
              <span>Generate Timetable</span>
            </button>
          </div>
        </div>
      </div>

      {/* REQUIREMENT 4: TWO PROMINENT MAIN OPTIONS: CLASS TIMETABLE & STAFF TIMETABLE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Option 1: CLASS TIMETABLE */}
        <div
          id="card-class-timetable"
          onClick={() => onNavigate("class_timetable")}
          className="group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-blue-200 bg-white p-6 shadow-sm hover:border-blue-500 hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-start justify-between">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xs group-hover:scale-105 transition-transform">
              <CalendarDays className="h-7 w-7" />
            </div>
            <span className="inline-flex items-center space-x-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <span>View Master Grid</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>

          <div className="mt-5">
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              1. CLASS TIMETABLE
            </h3>
            <p className="mt-1.5 text-sm text-slate-600 line-clamp-2">
              Browse weekly schedules by class standard and section with period timings, subject color coding, room numbers, drag-and-drop moves, and PDF/CSV export.
            </p>
          </div>

          <div className="mt-5 flex items-center space-x-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <div>
              <span className="font-semibold text-slate-900">{classes.length}</span> Classes Active
            </div>
            <div>•</div>
            <div>
              <span className="font-semibold text-slate-900">{timings.active_days.length}</span> Days / Week
            </div>
            <div>•</div>
            <div>
              <span className="font-semibold text-slate-900">{timings.total_periods}</span> Periods / Day
            </div>
          </div>
        </div>

        {/* Option 2: STAFF TIMETABLE */}
        <div
          id="card-staff-timetable"
          onClick={() => onNavigate("staff_timetable")}
          className="group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-emerald-200 bg-white p-6 shadow-sm hover:border-emerald-500 hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-start justify-between">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xs group-hover:scale-105 transition-transform">
              <UserCheck className="h-7 w-7" />
            </div>
            <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span>Staff Workload</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>

          <div className="mt-5">
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              2. STAFF TIMETABLE
            </h3>
            <p className="mt-1.5 text-sm text-slate-600 line-clamp-2">
              Inspect teacher teaching periods, workload distribution, prominent free periods, and print clean formatted PDF/CSV documents.
            </p>
          </div>

          <div className="mt-5 flex items-center space-x-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <div>
              <span className="font-semibold text-slate-900">{staffList.length}</span> Teachers Configured
            </div>
            <div>•</div>
            <div>
              <span className="font-semibold text-emerald-600">Free Periods Highlighted</span>
            </div>
          </div>
        </div>
      </div>

      {/* Setup Guide for School Admin */}
      {(classes.length === 0 || staffList.length === 0 || subjects.length === 0 || entries.length === 0) && (
        <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-white p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-blue-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                <span>School Setup & Configuration Steps</span>
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Complete these configuration steps to generate your automated timetable for {timings.school_name}.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Step 1: Classes */}
            <div
              onClick={() => onNavigate("classes")}
              className={`cursor-pointer rounded-xl p-3.5 border transition-all ${
                classes.length > 0
                  ? "bg-white border-emerald-300 shadow-xs"
                  : "bg-white border-blue-200 hover:border-blue-400 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">Step 1</span>
                {classes.length > 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                )}
              </div>
              <div className="mt-2 text-sm font-bold text-slate-900">Add Classes</div>
              <div className="text-xs text-slate-500 mt-1">
                {classes.length > 0 ? `${classes.length} classes defined` : "Define standards & sections"}
              </div>
            </div>

            {/* Step 2: Subjects */}
            <div
              onClick={() => onNavigate("subjects")}
              className={`cursor-pointer rounded-xl p-3.5 border transition-all ${
                subjects.length > 0
                  ? "bg-white border-emerald-300 shadow-xs"
                  : "bg-white border-blue-200 hover:border-blue-400 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">Step 2</span>
                {subjects.length > 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                )}
              </div>
              <div className="mt-2 text-sm font-bold text-slate-900">Add Subjects</div>
              <div className="text-xs text-slate-500 mt-1">
                {subjects.length > 0 ? `${subjects.length} subjects added` : "Curriculum & period quotas"}
              </div>
            </div>

            {/* Step 3: Staff & Allocations */}
            <div
              onClick={() => onNavigate("staff")}
              className={`cursor-pointer rounded-xl p-3.5 border transition-all ${
                staffList.length > 0
                  ? "bg-white border-emerald-300 shadow-xs"
                  : "bg-white border-blue-200 hover:border-blue-400 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">Step 3</span>
                {staffList.length > 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                )}
              </div>
              <div className="mt-2 text-sm font-bold text-slate-900">Staff & Allocations</div>
              <div className="text-xs text-slate-500 mt-1">
                {staffList.length > 0 ? `${staffList.length} faculty registered` : "Teachers, classes & periods"}
              </div>
            </div>

            {/* Step 4: Generate */}
            <div
              onClick={() => {
                if (classes.length > 0 && staffList.length > 0) {
                  onOpenGenerate();
                } else {
                  onNavigate("classes");
                }
              }}
              className={`cursor-pointer rounded-xl p-3.5 border transition-all ${
                classes.length > 0 && staffList.length > 0
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm hover:bg-blue-700"
                  : "bg-slate-100 border-slate-200 text-slate-400"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase ${classes.length > 0 && staffList.length > 0 ? "text-blue-200" : "text-slate-400"}`}>
                  Step 4
                </span>
                <Play className="h-3.5 w-3.5 fill-current" />
              </div>
              <div className="mt-2 text-sm font-bold">Generate Timetable</div>
              <div className={`text-xs mt-1 ${classes.length > 0 && staffList.length > 0 ? "text-blue-100" : "text-slate-400"}`}>
                Automated solver
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Classes Metric */}
        <div
          onClick={() => onNavigate("classes")}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-slate-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Classes</span>
            <GraduationCap className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{classes.length}</div>
          <div className="mt-1 text-xs text-slate-500">
            {classes.length === 0 ? "Click to add classes" : `${classes.length} standards configured`}
          </div>
        </div>

        {/* Staff Metric */}
        <div
          onClick={() => onNavigate("staff")}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-slate-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Staff Members</span>
            <Users className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{staffList.length}</div>
          <div className="mt-1 text-xs text-slate-500">
            {staffList.length === 0 ? "Click to add teachers" : `${staffList.length} faculty registered`}
          </div>
        </div>

        {/* Scheduled Periods */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Scheduled Periods</span>
            <BookOpen className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {scheduledPeriods} / {totalRequiredPeriods}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {totalRequiredPeriods > 0
              ? `${Math.round((scheduledPeriods / totalRequiredPeriods) * 100)}% scheduled`
              : "No periods configured"}
          </div>
        </div>

        {/* Conflicts Status */}
        <div
          onClick={() => onNavigate("conflicts")}
          className={`cursor-pointer rounded-xl border p-4 shadow-xs transition-colors ${
            conflicts.length === 0
              ? "border-emerald-200 bg-emerald-50/50"
              : "border-rose-200 bg-rose-50/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Conflict Audit</span>
            {conflicts.length === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600" />
            )}
          </div>
          <div
            className={`mt-2 text-2xl font-bold ${
              conflicts.length === 0 ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {conflicts.length === 0 ? "0 Conflicts" : `${conflicts.length} Detected`}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {conflicts.length === 0 ? "100% Conflict-free schedule" : "Click to view diagnostics"}
          </div>
        </div>
      </div>

      {/* School Schedule Breakdown snapshot */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">
              School Hours & Break Timings
            </h3>
          </div>
          <button
            onClick={() => onNavigate("timings")}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Configure Timings →
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center">
          <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
            <div className="text-[11px] font-medium text-slate-500">School Hours</div>
            <div className="text-sm font-bold text-slate-900 mt-1">
              {timings.start_time} - {timings.end_time}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Official Hours</div>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
            <div className="text-[11px] font-medium text-slate-500">Period Length</div>
            <div className="text-sm font-bold text-slate-900 mt-1">
              {timings.period_duration_minutes} Mins
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">8 Periods / Day</div>
          </div>

          <div className="rounded-xl bg-amber-50 p-3 border border-amber-100">
            <div className="flex items-center justify-center space-x-1 text-[11px] font-medium text-amber-700">
              <Coffee className="h-3 w-3" />
              <span>Break 1</span>
            </div>
            <div className="text-sm font-bold text-amber-900 mt-1">
              {timings.break1_start} - {timings.break1_end}
            </div>
            <div className="text-[10px] text-amber-600 mt-0.5">10 Mins (After P2)</div>
          </div>

          <div className="rounded-xl bg-orange-50 p-3 border border-orange-100">
            <div className="flex items-center justify-center space-x-1 text-[11px] font-medium text-orange-700">
              <Utensils className="h-3 w-3" />
              <span>Lunch Break</span>
            </div>
            <div className="text-sm font-bold text-orange-900 mt-1">
              {timings.lunch_start} - {timings.lunch_end}
            </div>
            <div className="text-[10px] text-orange-600 mt-0.5">40 Mins (After P4)</div>
          </div>

          <div className="rounded-xl bg-amber-50 p-3 border border-amber-100">
            <div className="flex items-center justify-center space-x-1 text-[11px] font-medium text-amber-700">
              <Coffee className="h-3 w-3" />
              <span>Break 2</span>
            </div>
            <div className="text-sm font-bold text-amber-900 mt-1">
              {timings.break2_start} - {timings.break2_end}
            </div>
            <div className="text-[10px] text-amber-600 mt-0.5">10 Mins (After P6)</div>
          </div>

          <div className="rounded-xl bg-blue-50 p-3 border border-blue-100">
            <div className="text-[11px] font-medium text-blue-700">Active Days</div>
            <div className="text-sm font-bold text-blue-900 mt-1">
              {timings.active_days.length} Days
            </div>
            <div className="text-[10px] text-blue-600 mt-0.5">Mon - Fri</div>
          </div>
        </div>
      </div>
    </div>
  );
};
