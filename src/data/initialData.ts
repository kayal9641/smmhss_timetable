import { SchoolClass, Subject, Staff, StaffAssignment, SchoolTimings, TimetableEntry } from "../types";

export const initialTimings: SchoolTimings = {
  school_name: "Sri Mahalakshmi Matric Hr.Sec.School",
  academic_year: "2026-2027",
  start_time: "09:10",
  end_time: "16:00",
  period_duration_minutes: 40,
  total_periods: 8,
  lunch_start: "12:20",
  lunch_end: "13:00",
  break1_start: "10:50",
  break1_end: "11:00",
  break2_start: "14:50",
  break2_end: "15:00",
  active_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
};

// Start with completely empty database as requested by the user
export const initialSubjects: Subject[] = [];

export const initialClasses: SchoolClass[] = [];

export const initialStaff: Staff[] = [];

export const initialAssignments: StaffAssignment[] = [];

export const initialTimetableEntries: TimetableEntry[] = [];


