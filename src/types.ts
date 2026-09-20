/**
 * Shared TypeScript definitions matching the Python backend models and schemas.
 */

export interface SchoolClass {
  id: number;
  name: string; // e.g. "8-A"
  grade: string; // "8"
  section: string; // "A"
  room_number?: string;
  subjects: ClassSubjectRequirement[];
}

export interface ClassSubjectRequirement {
  subject_id: number;
  periods_per_week: number;
}

export interface Subject {
  id: number;
  name: string;
  code: string;
  color: string;
  icon: string;
  category: string;
  requires_consecutive: boolean;
  default_periods_per_week: number;
}

export interface Staff {
  id: number;
  name: string;
  employee_id?: string;
  email?: string;
  phone?: string;
  max_periods_per_day: number;
  max_periods_per_week: number;
  qualified_subject_ids: number[];
  assigned_class_ids: number[];
  unavailabilities: StaffAvailabilitySlot[];
}

export interface StaffAvailabilitySlot {
  day: string;
  period: number;
  reason?: string;
}

export interface StaffAssignment {
  id: number;
  staff_id: number;
  subject_id: number;
  class_id: number;
}

export interface TimetableEntry {
  id: number;
  day: string;
  period: number;
  class_id: number;
  subject_id: number;
  staff_id: number;
  room_number?: string;
  is_docked?: boolean;
  is_manual?: boolean;
}

export interface StaffScheduleSlot {
  id?: number;
  tempId?: string;
  classId: number;
  subjectId: number;
  day: string;
  period: number;
}

export interface SchoolTimings {
  school_name: string;
  academic_year: string;
  start_time: string; // "09:10"
  end_time: string; // "16:00"
  period_duration_minutes: number; // 40
  total_periods: number; // 8
  lunch_start: string; // "12:20"
  lunch_end: string; // "13:00"
  break1_start: string; // "10:50"
  break1_end: string; // "11:00"
  break2_start: string; // "14:50"
  break2_end: string; // "15:00"
  active_days: string[]; // ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
}

export type ConflictSeverity = "high" | "medium" | "low";

export interface ConflictItem {
  id?: string;
  severity: ConflictSeverity;
  conflict_type: string;
  day?: string;
  period?: number;
  class_name?: string;
  staff_name?: string;
  subject_name?: string;
  explanation: string;
  suggested_fix?: string;
}

export interface GenerationRunResult {
  success: boolean;
  status: string;
  total_required: number;
  total_scheduled: number;
  missing_periods: number;
  conflicts: ConflictItem[];
  soft_score: number;
  execution_time_ms: number;
  message: string;
  entries?: TimetableEntry[];
  diagnostics?: string[];
  impossible_reasons?: { reason: string; suggested_fix?: string }[];
}

export type NavigationTab =
  | "dashboard"
  | "class_timetable"
  | "staff_timetable"
  | "classes"
  | "subjects"
  | "staff"
  | "timings"
  | "conflicts";

export type UserRole = "admin" | "staff";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt?: string;
  lastLogin?: string;
}

export type SyncStatus = "connected" | "offline" | "syncing";

