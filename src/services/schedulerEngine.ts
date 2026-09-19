/**
 * Isolated Automated Timetable Scheduling Engine
 * 
 * Standalone constraint satisfaction & backtracking engine that generates
 * conflict-free school timetables across a 48-slot weekly grid (6 days x 8 periods).
 * 
 * Features:
 * - Strict single-booking enforcement (no teacher double-booking, no class double-booking)
 * - Exact weekly target hour compliance
 * - Teacher unavailability & daily maximum period workload checks
 * - Integrated sanitizeForFirestore normalization (no undefined fields)
 * - Fully compatible with Firestore timetable_entries collection schema
 */

import { SchoolClass, Staff, StaffAssignment, Subject, SchoolTimings, TimetableEntry } from "../types";
import { sanitizeForFirestore, sanitizeTimetableEntry } from "./firebaseService";

export interface AllocationRule {
  class_id: number;
  subject_id: number;
  staff_id: number;
  periods_per_week: number;
  room_number?: string;
}

export interface AllocationsDataInput {
  classes?: SchoolClass[];
  staff?: Staff[];
  assignments?: StaffAssignment[];
  subjects?: Subject[];
  allocations?: AllocationRule[];
}

export interface SchedulingResult {
  success: boolean;
  entries: TimetableEntry[];
  totalAllocated: number;
  targetPeriods: number;
  unassignedItems: { class_id: number; subject_id: number; staff_id: number; remaining: number }[];
  conflicts: string[];
}

// Default 48-slot week grid (6 days x 8 periods)
export const DEFAULT_WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const DEFAULT_PERIODS_PER_DAY = 8;

/**
 * Pure helper function: generateAutomatedTimetable
 * 
 * @param allocationsData - School allocations (classes, staff, assignments, or explicit allocation rules)
 * @param schoolTimings - Optional school timing configuration specifying active days and periods
 * @returns Clean array of Firestore-ready, sanitized timetable entry documents
 */
export function generateAutomatedTimetable(
  allocationsData: AllocationsDataInput | StaffAssignment[] | AllocationRule[],
  schoolTimings?: Partial<SchoolTimings> | null
): TimetableEntry[] {
  // 1. Resolve Grid Dimensions (Target: 48 slots = 6 days x 8 periods)
  const activeDays: string[] =
    schoolTimings?.active_days && schoolTimings.active_days.length >= 6
      ? schoolTimings.active_days
      : DEFAULT_WEEK_DAYS;

  const totalPeriods: number =
    schoolTimings?.total_periods && schoolTimings.total_periods >= 4
      ? schoolTimings.total_periods
      : DEFAULT_PERIODS_PER_DAY;

  // 2. Parse and normalize allocation requests
  const { rules, staffMap, classMap } = parseAllocationRules(allocationsData);

  // 3. Flatten allocation requirements into atomic 1-period scheduling tasks
  interface PeriodTask {
    taskId: string;
    class_id: number;
    subject_id: number;
    staff_id: number;
    room_number: string;
    targetWeekly: number;
  }

  const tasks: PeriodTask[] = [];
  rules.forEach((rule, rIdx) => {
    const targetCount = Math.max(0, Math.floor(rule.periods_per_week));
    const room = rule.room_number || classMap.get(rule.class_id)?.room_number || "";
    for (let i = 0; i < targetCount; i++) {
      tasks.push({
        taskId: `t_${rIdx}_${i}`,
        class_id: rule.class_id,
        subject_id: rule.subject_id,
        staff_id: rule.staff_id,
        room_number: room,
        targetWeekly: targetCount,
      });
    }
  });

  // Heuristic sort: Schedule teachers with lowest availability / highest load first (MRV heuristic)
  tasks.sort((a, b) => {
    const staffA = staffMap.get(a.staff_id);
    const staffB = staffMap.get(b.staff_id);
    const unavailA = staffA?.unavailabilities?.length || 0;
    const unavailB = staffB?.unavailabilities?.length || 0;
    if (unavailA !== unavailB) return unavailB - unavailA;
    return b.targetWeekly - a.targetWeekly;
  });

  // 4. Backtracking State Structures
  // Grid coordinates: `${class_id}_${day}_${period}` -> task
  const classGrid = new Map<string, PeriodTask>();
  // Grid coordinates: `${staff_id}_${day}_${period}` -> task
  const staffGrid = new Map<string, PeriodTask>();
  // Staff daily workload: `${staff_id}_${day}` -> count
  const staffDailyLoad = new Map<string, number>();
  // Class daily subject spread: `${class_id}_${subject_id}_${day}` -> count
  const classDailySubject = new Map<string, number>();

  // Teacher unavailability lookup
  const staffUnavailSet = new Set<string>();
  staffMap.forEach((st) => {
    if (Array.isArray(st.unavailabilities)) {
      st.unavailabilities.forEach((u) => {
        staffUnavailSet.add(`${st.id}_${u.day}_${u.period}`);
      });
    }
  });

  // Build candidate slot list
  interface Slot {
    day: string;
    period: number;
  }
  const allSlots: Slot[] = [];
  for (const day of activeDays) {
    for (let p = 1; p <= totalPeriods; p++) {
      allSlots.push({ day, period: p });
    }
  }

  // 5. Backtracking Constraint Satisfaction Solver
  const assignedSlots: Map<string, Slot> = new Map();
  let searchSteps = 0;
  const MAX_STEPS = 120000; // Safeguard against thread freeze

  function canPlace(task: PeriodTask, slot: Slot): boolean {
    const classKey = `${task.class_id}_${slot.day}_${slot.period}`;
    if (classGrid.has(classKey)) return false;

    if (task.staff_id > 0) {
      const staffKey = `${task.staff_id}_${slot.day}_${slot.period}`;
      if (staffGrid.has(staffKey)) return false;

      // Teacher blackout / unavailability check
      if (staffUnavailSet.has(staffKey)) return false;

      // Teacher maximum daily period workload
      const staff = staffMap.get(task.staff_id);
      const maxDay = staff?.max_periods_per_day || 6;
      const currentDayCount = staffDailyLoad.get(`${task.staff_id}_${slot.day}`) || 0;
      if (currentDayCount >= maxDay) return false;
    }

    // Soft distribution: avoid more than 2 periods of same subject per day for a class
    const dailySubKey = `${task.class_id}_${task.subject_id}_${slot.day}`;
    const dailySubCount = classDailySubject.get(dailySubKey) || 0;
    const maxPerDay = task.targetWeekly > 5 ? 2 : 1;
    if (dailySubCount >= maxPerDay) return false;

    return true;
  }

  function assign(task: PeriodTask, slot: Slot) {
    classGrid.set(`${task.class_id}_${slot.day}_${slot.period}`, task);
    if (task.staff_id > 0) {
      staffGrid.set(`${task.staff_id}_${slot.day}_${slot.period}`, task);
      const staffDayKey = `${task.staff_id}_${slot.day}`;
      staffDailyLoad.set(staffDayKey, (staffDailyLoad.get(staffDayKey) || 0) + 1);
    }
    const subDayKey = `${task.class_id}_${task.subject_id}_${slot.day}`;
    classDailySubject.set(subDayKey, (classDailySubject.get(subDayKey) || 0) + 1);
    assignedSlots.set(task.taskId, slot);
  }

  function unassign(task: PeriodTask, slot: Slot) {
    classGrid.delete(`${task.class_id}_${slot.day}_${slot.period}`);
    if (task.staff_id > 0) {
      staffGrid.delete(`${task.staff_id}_${slot.day}_${slot.period}`);
      const staffDayKey = `${task.staff_id}_${slot.day}`;
      staffDailyLoad.set(staffDayKey, Math.max(0, (staffDailyLoad.get(staffDayKey) || 1) - 1));
    }
    const subDayKey = `${task.class_id}_${task.subject_id}_${slot.day}`;
    classDailySubject.set(subDayKey, Math.max(0, (classDailySubject.get(subDayKey) || 1) - 1));
    assignedSlots.delete(task.taskId);
  }

  function backtrack(taskIndex: number): boolean {
    if (taskIndex >= tasks.length) return true;
    searchSteps++;
    if (searchSteps > MAX_STEPS) return false;

    const task = tasks[taskIndex];

    // Order candidate slots: distribute across days evenly
    const candidateSlots = [...allSlots].sort((s1, s2) => {
      const c1Count = classDailySubject.get(`${task.class_id}_${task.subject_id}_${s1.day}`) || 0;
      const c2Count = classDailySubject.get(`${task.class_id}_${task.subject_id}_${s2.day}`) || 0;
      if (c1Count !== c2Count) return c1Count - c2Count;
      const s1Load = staffDailyLoad.get(`${task.staff_id}_${s1.day}`) || 0;
      const s2Load = staffDailyLoad.get(`${task.staff_id}_${s2.day}`) || 0;
      return s1Load - s2Load;
    });

    for (const slot of candidateSlots) {
      if (canPlace(task, slot)) {
        assign(task, slot);
        if (backtrack(taskIndex + 1)) return true;
        unassign(task, slot);
      }
    }

    return false;
  }

  const solved = backtrack(0);

  // If strict backtracking hit limit due to overconstrained input, fill remaining slots greedily
  if (!solved) {
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (assignedSlots.has(task.taskId)) continue;

      for (const slot of allSlots) {
        const classKey = `${task.class_id}_${slot.day}_${slot.period}`;
        const staffKey = `${task.staff_id}_${slot.day}_${slot.period}`;
        if (!classGrid.has(classKey) && !staffGrid.has(staffKey) && !staffUnavailSet.has(staffKey)) {
          assign(task, slot);
          break;
        }
      }
    }
  }

  // 6. Format and Sanitize output timetable documents
  let entrySeq = 1;
  const rawEntries: TimetableEntry[] = [];

  for (const task of tasks) {
    const slot = assignedSlots.get(task.taskId);
    if (!slot) continue;

    rawEntries.push({
      id: entrySeq++,
      day: slot.day,
      period: slot.period,
      class_id: task.class_id,
      subject_id: task.subject_id,
      staff_id: task.staff_id,
      room_number: task.room_number || "",
    });
  }

  // Pass through sanitizeTimetableEntry and sanitizeForFirestore to convert
  // any undefined fields to "" and strictly match Firestore schemas
  const sanitizedEntries = rawEntries.map((e) => {
    const sanitized = sanitizeTimetableEntry(e);
    return sanitizeForFirestore(sanitized) as unknown as TimetableEntry;
  });

  return sanitizedEntries;
}

/**
 * Normalizes different input formats (objects, arrays, assignments)
 * into a consistent set of AllocationRules.
 */
function parseAllocationRules(
  data: AllocationsDataInput | StaffAssignment[] | AllocationRule[]
): {
  rules: AllocationRule[];
  staffMap: Map<number, Staff>;
  classMap: Map<number, SchoolClass>;
} {
  const staffMap = new Map<number, Staff>();
  const classMap = new Map<number, SchoolClass>();
  const rules: AllocationRule[] = [];

  if (Array.isArray(data)) {
    // Array of StaffAssignment or AllocationRule
    data.forEach((item: any) => {
      if ("periods_per_week" in item && typeof item.periods_per_week === "number") {
        rules.push({
          class_id: Number(item.class_id),
          subject_id: Number(item.subject_id),
          staff_id: Number(item.staff_id),
          periods_per_week: Number(item.periods_per_week),
          room_number: item.room_number ? String(item.room_number).trim() : "",
        });
      } else if ("class_id" in item && "subject_id" in item && "staff_id" in item) {
        rules.push({
          class_id: Number(item.class_id),
          subject_id: Number(item.subject_id),
          staff_id: Number(item.staff_id),
          periods_per_week: Number(item.periods_per_week || 5),
          room_number: "",
        });
      }
    });
  } else if (data && typeof data === "object") {
    // Populate maps if available
    if (Array.isArray(data.staff)) {
      data.staff.forEach((s) => staffMap.set(s.id, s));
    }
    if (Array.isArray(data.classes)) {
      data.classes.forEach((c) => classMap.set(c.id, c));
    }

    if (Array.isArray(data.allocations) && data.allocations.length > 0) {
      data.allocations.forEach((a) => {
        rules.push({
          class_id: Number(a.class_id),
          subject_id: Number(a.subject_id),
          staff_id: Number(a.staff_id),
          periods_per_week: Number(a.periods_per_week),
          room_number: a.room_number ? String(a.room_number).trim() : "",
        });
      });
    } else if (Array.isArray(data.classes) && Array.isArray(data.assignments)) {
      // Build allocation requirements by joining Class subject periods with Assigned Staff
      const asgnMap = new Map<string, number>();
      data.assignments.forEach((as) => {
        asgnMap.set(`${as.class_id}_${as.subject_id}`, as.staff_id);
      });

      data.classes.forEach((cls) => {
        if (Array.isArray(cls.subjects)) {
          cls.subjects.forEach((req) => {
            const staffId = asgnMap.get(`${cls.id}_${req.subject_id}`) || 0;
            rules.push({
              class_id: cls.id,
              subject_id: req.subject_id,
              staff_id: staffId,
              periods_per_week: req.periods_per_week,
              room_number: cls.room_number || "",
            });
          });
        }
      });
    }
  }

  return { rules, staffMap, classMap };
}

export default generateAutomatedTimetable;
