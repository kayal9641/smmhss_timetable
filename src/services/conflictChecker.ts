import {
  TimetableEntry,
  SchoolClass,
  Staff,
  Subject,
  StaffAssignment,
  SchoolTimings,
  ConflictItem,
} from "../types";

export class ConflictChecker {
  static audit(
    entries: TimetableEntry[],
    classes: SchoolClass[],
    staffList: Staff[],
    subjects: Subject[],
    assignments: StaffAssignment[],
    timings: SchoolTimings,
    lunchPeriod = 5,
    breakPeriods: number[] = [3, 7]
  ): ConflictItem[] {
    const conflicts: ConflictItem[] = [];

    const classMap = new Map(classes.map((c) => [c.id, c.name]));
    const staffMap = new Map(staffList.map((s) => [s.id, s]));
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));

    // 1. HARD CONSTRAINT: Teacher Double Booking
    const teacherSlots = new Map<string, TimetableEntry[]>();
    for (const e of entries) {
      const key = `${e.staff_id}_${e.day}_${e.period}`;
      if (!teacherSlots.has(key)) teacherSlots.set(key, []);
      teacherSlots.get(key)!.push(e);
    }

    teacherSlots.forEach((slotEntries) => {
      if (slotEntries.length > 1) {
        const st = staffMap.get(slotEntries[0].staff_id);
        const day = slotEntries[0].day;
        const period = slotEntries[0].period;
        const classNames = slotEntries.map((e) => classMap.get(e.class_id) || `Class ${e.class_id}`);
        const subjectNames = slotEntries.map((e) => subjectMap.get(e.subject_id)?.name || "Subject");

        conflicts.push({
          severity: "high",
          conflict_type: "teacher_double_booking",
          day,
          period,
          staff_name: st?.name || "Teacher",
          class_name: classNames.join(", "),
          subject_name: subjectNames.join(", "),
          explanation: `Teacher ${st?.name || "Teacher"} is simultaneously scheduled to teach classes (${classNames.join(", ")}) on ${day} Period ${period}.`,
          suggested_fix: `Move one of the classes to a free period for ${st?.name || "Teacher"}.`,
        });
      }
    });

    // 2. HARD CONSTRAINT: Class Double Booking
    const classSlots = new Map<string, TimetableEntry[]>();
    for (const e of entries) {
      const key = `${e.class_id}_${e.day}_${e.period}`;
      if (!classSlots.has(key)) classSlots.set(key, []);
      classSlots.get(key)!.push(e);
    }

    classSlots.forEach((slotEntries) => {
      if (slotEntries.length > 1) {
        const cName = classMap.get(slotEntries[0].class_id) || "Class";
        const day = slotEntries[0].day;
        const period = slotEntries[0].period;
        const subNames = slotEntries.map((e) => subjectMap.get(e.subject_id)?.name || "Subject");
        const staffNames = slotEntries.map((e) => staffMap.get(e.staff_id)?.name || "Teacher");

        conflicts.push({
          severity: "high",
          conflict_type: "class_double_booking",
          day,
          period,
          class_name: cName,
          staff_name: staffNames.join(", "),
          subject_name: subNames.join(", "),
          explanation: `Class ${cName} has multiple subjects (${subNames.join(", ")}) scheduled at the same time on ${day} Period ${period}.`,
          suggested_fix: `Move one subject to an open period on ${day} or another weekday.`,
        });
      }
    });

    // 3. HARD CONSTRAINT: Teacher Availability
    const unavailSet = new Set<string>();
    for (const s of staffList) {
      for (const u of s.unavailabilities || []) {
        unavailSet.add(`${s.id}_${u.day}_${u.period}`);
      }
    }

    for (const e of entries) {
      if (unavailSet.has(`${e.staff_id}_${e.day}_${e.period}`)) {
        const stName = staffMap.get(e.staff_id)?.name || "Teacher";
        const cName = classMap.get(e.class_id) || "Class";
        const subName = subjectMap.get(e.subject_id)?.name || "Subject";
        conflicts.push({
          severity: "high",
          conflict_type: "teacher_unavailable",
          day: e.day,
          period: e.period,
          class_name: cName,
          staff_name: stName,
          subject_name: subName,
          explanation: `${stName} is marked unavailable on ${e.day} Period ${e.period}, but is assigned to teach ${cName} (${subName}).`,
          suggested_fix: `Move this lesson to when ${stName} is available, or adjust availability.`,
        });
      }
    }

    // 4. HARD CONSTRAINT: Teacher Qualifications & Authorizations
    for (const e of entries) {
      const st = staffMap.get(e.staff_id);
      const isAssigned = assignments.some(
        (a) => a.staff_id === e.staff_id && a.subject_id === e.subject_id && a.class_id === e.class_id
      );
      if (st && !isAssigned && !st.qualified_subject_ids.includes(e.subject_id)) {
        const subName = subjectMap.get(e.subject_id)?.name || "Subject";
        conflicts.push({
          severity: "high",
          conflict_type: "qualification_mismatch",
          day: e.day,
          period: e.period,
          class_name: classMap.get(e.class_id) || "Class",
          staff_name: st.name,
          subject_name: subName,
          explanation: `${st.name} is scheduled to teach ${subName}, but is neither assigned nor qualified for it.`,
          suggested_fix: `Assign ${st.name} in Staff Assignments or select another teacher.`,
        });
      }
    }

    // 5. HARD CONSTRAINT: Daily and Weekly limits
    const dailyCount = new Map<string, number>();
    const weeklyCount = new Map<number, number>();

    for (const e of entries) {
      const dayKey = `${e.staff_id}_${e.day}`;
      dailyCount.set(dayKey, (dailyCount.get(dayKey) || 0) + 1);
      weeklyCount.set(e.staff_id, (weeklyCount.get(e.staff_id) || 0) + 1);
    }

    for (const st of staffList) {
      for (const d of timings.active_days) {
        const count = dailyCount.get(`${st.id}_${d}`) || 0;
        if (count > st.max_periods_per_day) {
          conflicts.push({
            severity: "medium",
            conflict_type: "daily_overload",
            day: d,
            staff_name: st.name,
            explanation: `${st.name} has ${count} periods assigned on ${d} (Limit: ${st.max_periods_per_day}/day).`,
            suggested_fix: `Move some periods to other active days with lighter workload.`,
          });
        }
      }

      const totalWeek = weeklyCount.get(st.id) || 0;
      const assignedCount = assignments
        .filter((a) => a.staff_id === st.id)
        .reduce((sum, a) => {
          const cls = classes.find((c) => c.id === a.class_id);
          const req = cls?.subjects.find((s) => s.subject_id === a.subject_id);
          return sum + (req?.periods_per_week || 0);
        }, 0);
      const effectiveMaxWeek = Math.max(st.max_periods_per_week, assignedCount);
      const maxSlotsInWeek = timings.active_days.length * timings.total_periods;

      if (totalWeek > effectiveMaxWeek || totalWeek > maxSlotsInWeek) {
        conflicts.push({
          severity: "high",
          conflict_type: "weekly_overload",
          staff_name: st.name,
          explanation: `${st.name} has ${totalWeek} total periods this week (Limit: ${effectiveMaxWeek}/week).`,
          suggested_fix: `Reassign classes/periods to another teacher.`,
        });
      }
    }

    // 6. Subject requirements per class (missing or extra)
    const requiredMap = new Map<string, number>();
    for (const c of classes) {
      for (const req of c.subjects) {
        requiredMap.set(`${c.id}_${req.subject_id}`, req.periods_per_week);
      }
    }

    const scheduledMap = new Map<string, number>();
    for (const e of entries) {
      const key = `${e.class_id}_${e.subject_id}`;
      scheduledMap.set(key, (scheduledMap.get(key) || 0) + 1);
    }

    requiredMap.forEach((reqCount, key) => {
      const [cIdStr, sIdStr] = (key || "").split("_");
      const cId = parseInt(cIdStr, 10);
      const sId = parseInt(sIdStr, 10);
      const scheduled = scheduledMap.get(key) || 0;
      const cName = classMap.get(cId) || "Class";
      const sName = subjectMap.get(sId)?.name || "Subject";

      if (scheduled < reqCount) {
        conflicts.push({
          severity: "high",
          conflict_type: "missing_subject_periods",
          class_name: cName,
          subject_name: sName,
          explanation: `${cName} requires ${reqCount} periods/week of ${sName}, but only ${scheduled} are assigned (Missing: ${reqCount - scheduled}).`,
          suggested_fix: `Generate or schedule ${reqCount - scheduled} additional period(s).`,
        });
      } else if (scheduled > reqCount) {
        conflicts.push({
          severity: "medium",
          conflict_type: "extra_subject_periods",
          class_name: cName,
          subject_name: sName,
          explanation: `${cName} has ${scheduled} periods of ${sName} scheduled, exceeding required ${reqCount} by ${scheduled - reqCount}.`,
          suggested_fix: `Remove ${scheduled - reqCount} extra period(s).`,
        });
      }
    });

    return conflicts;
  }

  static canAssignSlot(
    entries: TimetableEntry[],
    classId: number,
    staffId: number,
    day: string,
    period: number,
    timings: SchoolTimings,
    staffList: Staff[],
    excludeEntryId?: number
  ): { allowed: boolean; reason?: string } {
    // 1. Period bounds check
    if (period < 1 || period > timings.total_periods) {
      return { allowed: false, reason: `Period ${period} is outside valid range (1 to ${timings.total_periods}).` };
    }

    // Filter out the entry being moved
    const otherEntries = entries.filter((e) => e.id !== excludeEntryId);

    // 2. Check Teacher collision
    const teacherClash = otherEntries.find(
      (e) => e.staff_id === staffId && e.day === day && e.period === period
    );
    if (teacherClash) {
      return {
        allowed: false,
        reason: `Teacher is already teaching Class ${teacherClash.class_id} on ${day} Period ${period}.`,
      };
    }

    // 3. Check Class collision
    const classClash = otherEntries.find(
      (e) => e.class_id === classId && e.day === day && e.period === period
    );
    if (classClash) {
      return {
        allowed: false,
        reason: `Class is already scheduled for another lesson on ${day} Period ${period}.`,
      };
    }

    // 4. Check Teacher unavailability
    const staff = staffList.find((s) => s.id === staffId);
    if (staff) {
      const isBlocked = (staff.unavailabilities || []).some(
        (u) => u.day === day && u.period === period
      );
      if (isBlocked) {
        return {
          allowed: false,
          reason: `Teacher ${staff.name} is marked as unavailable (Meeting / Leave) on ${day} Period ${period}.`,
        };
      }

      // 5. Daily limit
      const dailyCount = otherEntries.filter(
        (e) => e.staff_id === staffId && e.day === day
      ).length;
      if (dailyCount >= staff.max_periods_per_day) {
        return {
          allowed: false,
          reason: `Teacher ${staff.name} would exceed max daily teaching limit of ${staff.max_periods_per_day} periods on ${day}.`,
        };
      }
    }

    return { allowed: true };
  }
}
