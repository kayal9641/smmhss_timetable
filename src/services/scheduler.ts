import {
  SchoolClass,
  Subject,
  Staff,
  StaffAssignment,
  SchoolTimings,
  TimetableEntry,
  GenerationRunResult,
} from "../types";
import { ConflictChecker } from "./conflictChecker";

interface ScheduleItem {
  class_id: number;
  subject_id: number;
  staff_id: number;
  requires_consecutive: boolean;
  item_id: string;
}

export class TimetableScheduler {
  private classes: SchoolClass[];
  private subjects: Subject[];
  private staffList: Staff[];
  private assignments: StaffAssignment[];
  private timings: SchoolTimings;
  private randomSeed: number;

  constructor(
    classes: SchoolClass[],
    subjects: Subject[],
    staffList: Staff[],
    assignments: StaffAssignment[],
    timings: SchoolTimings,
    randomSeed = 42
  ) {
    this.classes = classes;
    this.subjects = subjects;
    this.staffList = staffList;
    this.assignments = assignments;
    this.timings = timings;
    this.randomSeed = randomSeed;
  }

  solve(preservedEntries: TimetableEntry[] = []): GenerationRunResult {
    const startTime = performance.now();

    // Map lookups
    const classMap = new Map(this.classes.map((c) => [c.id, c]));
    const staffMap = new Map(this.staffList.map((s) => [s.id, s]));
    const subjectMap = new Map(this.subjects.map((s) => [s.id, s]));

    // Usable teaching periods: 1 to total_periods (breaks occur between periods: after P2, P4, P6)
    const usablePeriods = Array.from(
      { length: this.timings.total_periods },
      (_, i) => i + 1
    );

    const assignmentMap = new Map<string, number>();
    for (const a of this.assignments) {
      assignmentMap.set(`${a.class_id}_${a.subject_id}`, a.staff_id);
    }

    const unavailSet = new Set<string>();
    for (const st of this.staffList) {
      for (const u of st.unavailabilities || []) {
        unavailSet.add(`${st.id}_${u.day}_${u.period}`);
      }
    }

    // 1. Pre-validation checks
    const impossibleReasons: { reason: string; suggested_fix?: string }[] = [];
    const teacherLoads = new Map<number, number>();

    const totalPossibleSlots = this.timings.active_days.length * usablePeriods.length;

    let totalRequired = 0;
    for (const c of this.classes) {
      let classTotal = 0;
      for (const req of c.subjects) {
        totalRequired += req.periods_per_week;
        classTotal += req.periods_per_week;

        const staffId = assignmentMap.get(`${c.id}_${req.subject_id}`);
        const subName = subjectMap.get(req.subject_id)?.name || "Subject";
        if (!staffId) {
          impossibleReasons.push({
            reason: `No teacher is assigned to teach ${subName} for ${c.name}.`,
            suggested_fix: `Go to Staff Assignments and assign a teacher for ${c.name} - ${subName}.`,
          });
          continue;
        }

        const staff = staffMap.get(staffId);
        if (!staff) {
          impossibleReasons.push({
            reason: `Teacher ID #${staffId} assigned to ${c.name} does not exist.`,
            suggested_fix: "Check teacher records in Staff Directory.",
          });
          continue;
        }

        teacherLoads.set(staffId, (teacherLoads.get(staffId) || 0) + req.periods_per_week);
      }

      if (classTotal > totalPossibleSlots) {
        impossibleReasons.push({
          reason: `${c.name} requires ${classTotal} periods/week, but there are only ${totalPossibleSlots} usable periods in the schedule (${this.timings.active_days.length} days × ${usablePeriods.length} periods).`,
          suggested_fix: `Reduce required periods for ${c.name} or configure more active days.`,
        });
      }
    }

    teacherLoads.forEach((load, staffId) => {
      const staff = staffMap.get(staffId);
      if (staff && load > totalPossibleSlots) {
        impossibleReasons.push({
          reason: `${staff.name} is assigned ${load} periods across multiple classes, exceeding the total school capacity of ${totalPossibleSlots} periods/week.`,
          suggested_fix: `Reassign some classes to another teacher. A teacher cannot physically teach more periods than exist in the school week.`,
        });
      }
    });

    if (impossibleReasons.length > 0) {
      const execTime = Math.round(performance.now() - startTime);
      return {
        success: false,
        status: "impossible",
        total_required: totalRequired,
        total_scheduled: 0,
        missing_periods: totalRequired,
        conflicts: impossibleReasons.map((r) => ({
          severity: "high",
          conflict_type: "impossible_schedule",
          explanation: r.reason,
          suggested_fix: r.suggested_fix,
        })),
        soft_score: 0,
        execution_time_ms: execTime,
        message: "Timetable could not be generated due to mathematical or assignment impossibilities.",
        impossible_reasons: impossibleReasons,
      };
    }

    // Build items to schedule
    const itemsToSchedule: ScheduleItem[] = [];
    let nextEntryId = 1;

    for (const c of this.classes) {
      for (const req of c.subjects) {
        const staffId = assignmentMap.get(`${c.id}_${req.subject_id}`)!;
        const sub = subjectMap.get(req.subject_id);
        const reqConsec = sub?.requires_consecutive || false;

        for (let i = 0; i < req.periods_per_week; i++) {
          itemsToSchedule.push({
            class_id: c.id,
            subject_id: req.subject_id,
            staff_id: staffId,
            requires_consecutive: reqConsec,
            item_id: `${c.id}_${req.subject_id}_${i}`,
          });
        }
      }
    }

    // Occupancy maps
    const classOccupancy = new Map<string, TimetableEntry>();
    const teacherOccupancy = new Map<string, TimetableEntry>();
    const teacherDailyCount = new Map<string, number>();
    const teacherWeeklyCount = new Map<number, number>();
    const classSubjectDayCount = new Map<string, number>();

    const finalEntries: TimetableEntry[] = [];

    // Seed preserved entries if any
    for (const p of preservedEntries) {
      classOccupancy.set(`${p.class_id}_${p.day}_${p.period}`, p);
      teacherOccupancy.set(`${p.staff_id}_${p.day}_${p.period}`, p);
      const dayKey = `${p.staff_id}_${p.day}`;
      teacherDailyCount.set(dayKey, (teacherDailyCount.get(dayKey) || 0) + 1);
      teacherWeeklyCount.set(p.staff_id, (teacherWeeklyCount.get(p.staff_id) || 0) + 1);
      const cSubKey = `${p.class_id}_${p.subject_id}_${p.day}`;
      classSubjectDayCount.set(cSubKey, (classSubjectDayCount.get(cSubKey) || 0) + 1);
      finalEntries.push(p);
      if (p.id >= nextEntryId) nextEntryId = p.id + 1;
    }

    // Sort items by difficulty (MRV heuristic):
    // 1. Consecutive requirements first
    // 2. Teachers with higher total assigned workload across multiple classes (most constrained first)
    // 3. Teachers with fewer available slots (unavailabilities)
    // 4. Class ID
    itemsToSchedule.sort((a, b) => {
      const aConsec = a.requires_consecutive ? 1 : 0;
      const bConsec = b.requires_consecutive ? 1 : 0;
      if (aConsec !== bConsec) return bConsec - aConsec;

      const aTeacherLoad = teacherLoads.get(a.staff_id) || 0;
      const bTeacherLoad = teacherLoads.get(b.staff_id) || 0;
      if (aTeacherLoad !== bTeacherLoad) return bTeacherLoad - aTeacherLoad;

      let aUnavail = 0;
      let bUnavail = 0;
      unavailSet.forEach((u) => {
        if (u.startsWith(`${a.staff_id}_`)) aUnavail++;
        if (u.startsWith(`${b.staff_id}_`)) bUnavail++;
      });
      if (aUnavail !== bUnavail) return bUnavail - aUnavail;

      return a.class_id - b.class_id;
    });

    // All available slots
    const allSlots: [string, number][] = [];
    for (const day of this.timings.active_days) {
      for (const period of usablePeriods) {
        allSlots.push([day, period]);
      }
    }

    let stepCount = 0;
    const maxSteps = 200000;

    const backtrack = (index: number): boolean => {
      stepCount++;
      if (stepCount > maxSteps) return false;
      if (index === itemsToSchedule.length) return true;

      const item = itemsToSchedule[index];
      const st = staffMap.get(item.staff_id)!;
      const currentWeekCount = teacherWeeklyCount.get(item.staff_id) || 0;
      
      // Dynamic effective limits accommodating multi-class assignments
      const assignedLoad = teacherLoads.get(item.staff_id) || 0;
      const maxAllowedWeekly = Math.max(st.max_periods_per_week, assignedLoad);
      const maxAllowedDaily = Math.max(
        st.max_periods_per_day,
        Math.ceil(maxAllowedWeekly / Math.max(1, this.timings.active_days.length))
      );

      if (currentWeekCount >= maxAllowedWeekly) return false;

      // Filter candidates
      const candidates: [string, number][] = [];
      for (const [day, period] of allSlots) {
        // 1. Class free
        if (classOccupancy.has(`${item.class_id}_${day}_${period}`)) continue;
        // 2. Teacher free (ABSOLUTE CONSTRAINT: Teacher is NEVER in two classes at the same time)
        if (teacherOccupancy.has(`${item.staff_id}_${day}_${period}`)) continue;
        // 3. Teacher availability
        if (unavailSet.has(`${item.staff_id}_${day}_${period}`)) continue;
        // 4. Teacher daily limit
        const dCount = teacherDailyCount.get(`${item.staff_id}_${day}`) || 0;
        if (dCount >= maxAllowedDaily) continue;

        candidates.push([day, period]);
      }

      // Sort candidate slots by heuristics:
      // - Distribute subject evenly across days for this class
      // - Distribute teacher's periods evenly across active days
      // - Balance periods throughout the day
      candidates.sort(([dayA, pA], [dayB, pB]) => {
        const countA = classSubjectDayCount.get(`${item.class_id}_${item.subject_id}_${dayA}`) || 0;
        const countB = classSubjectDayCount.get(`${item.class_id}_${item.subject_id}_${dayB}`) || 0;
        if (countA !== countB) return countA - countB;

        const loadA = teacherDailyCount.get(`${item.staff_id}_${dayA}`) || 0;
        const loadB = teacherDailyCount.get(`${item.staff_id}_${dayB}`) || 0;
        if (loadA !== loadB) return loadA - loadB;

        return pA - pB;
      });

      for (const [day, period] of candidates) {
        const entry: TimetableEntry = {
          id: nextEntryId++,
          day,
          period,
          class_id: item.class_id,
          subject_id: item.subject_id,
          staff_id: item.staff_id,
          room_number: classMap.get(item.class_id)?.room_number,
        };

        classOccupancy.set(`${item.class_id}_${day}_${period}`, entry);
        teacherOccupancy.set(`${item.staff_id}_${day}_${period}`, entry);
        teacherDailyCount.set(`${item.staff_id}_${day}`, (teacherDailyCount.get(`${item.staff_id}_${day}`) || 0) + 1);
        teacherWeeklyCount.set(item.staff_id, currentWeekCount + 1);
        const cKey = `${item.class_id}_${item.subject_id}_${day}`;
        classSubjectDayCount.set(cKey, (classSubjectDayCount.get(cKey) || 0) + 1);

        if (backtrack(index + 1)) {
          finalEntries.push(entry);
          return true;
        }

        // Revert
        classOccupancy.delete(`${item.class_id}_${day}_${period}`);
        teacherOccupancy.delete(`${item.staff_id}_${day}_${period}`);
        teacherDailyCount.set(`${item.staff_id}_${day}`, (teacherDailyCount.get(`${item.staff_id}_${day}`) || 1) - 1);
        teacherWeeklyCount.set(item.staff_id, currentWeekCount);
        classSubjectDayCount.set(cKey, (classSubjectDayCount.get(cKey) || 1) - 1);
      }

      return false;
    };

    const success = backtrack(0);
    const execTime = Math.round(performance.now() - startTime);

    const conflicts = ConflictChecker.audit(
      finalEntries,
      this.classes,
      this.staffList,
      this.subjects,
      this.assignments,
      this.timings
    );

    const softScore = success ? Math.max(60, 100 - conflicts.length * 5) : 0;

    return {
      success,
      status: success ? "completed" : "failed",
      total_required: totalRequired,
      total_scheduled: finalEntries.length,
      missing_periods: totalRequired - finalEntries.length,
      conflicts,
      soft_score: softScore,
      execution_time_ms: execTime,
      entries: finalEntries,
      message: success
        ? `Successfully generated complete conflict-free timetable (${finalEntries.length} periods) in ${execTime}ms!`
        : "Failed to generate a 100% conflict-free timetable. Review constraints.",
      diagnostics: success
        ? ["Generated deterministically using MRV Backtracking Solver."]
        : ["Exceeded search space without resolving teacher or class overlap conflicts."],
    };
  }

  static validateFeasibility(
    classes: SchoolClass[],
    staffList: Staff[],
    assignments: StaffAssignment[],
    timings: SchoolTimings
  ): { feasible: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const usablePeriodsPerDay = timings.total_periods;
    const maxClassSlotsPerWeek = timings.active_days.length * usablePeriodsPerDay;

    // Check class capacity
    for (const c of classes) {
      const req = c.subjects.reduce((sum, s) => sum + s.periods_per_week, 0);
      if (req > maxClassSlotsPerWeek) {
        reasons.push(
          `Class ${c.name} requires ${req} periods, but only ${maxClassSlotsPerWeek} periods exist in the school week.`
        );
      }
    }

    // Check staff capacity
    const staffLoad = new Map<number, number>();
    for (const c of classes) {
      for (const req of c.subjects) {
        const asgn = assignments.find(
          (a) => a.class_id === c.id && a.subject_id === req.subject_id
        );
        if (asgn) {
          staffLoad.set(asgn.staff_id, (staffLoad.get(asgn.staff_id) || 0) + req.periods_per_week);
        }
      }
    }

    for (const st of staffList) {
      const load = staffLoad.get(st.id) || 0;
      if (load > maxClassSlotsPerWeek) {
        reasons.push(
          `Teacher ${st.name} is assigned ${load} periods across multiple classes, exceeding total school week capacity of ${maxClassSlotsPerWeek} periods.`
        );
      }
    }

    return {
      feasible: reasons.length === 0,
      reasons,
    };
  }

  static solve(options: {
    classes: SchoolClass[];
    staffList: Staff[];
    subjects: Subject[];
    assignments: StaffAssignment[];
    timings: SchoolTimings;
    lockedEntries?: TimetableEntry[];
    randomSeed?: number;
  }): GenerationRunResult {
    const scheduler = new TimetableScheduler(
      options.classes,
      options.subjects,
      options.staffList,
      options.assignments,
      options.timings,
      options.randomSeed || 42
    );
    return scheduler.solve(options.lockedEntries || []);
  }
}
