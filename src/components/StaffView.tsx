import React, { useState } from "react";
import {
  Staff,
  Subject,
  SchoolClass,
  TimetableEntry,
  SchoolTimings,
  StaffAssignment,
  StaffScheduleSlot,
} from "../types";
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  UserCheck,
  CalendarOff,
  Users,
  Zap,
  Clock,
  BookOpen,
  AlertTriangle,
} from "lucide-react";

interface StaffViewProps {
  staffList: Staff[];
  subjects: Subject[];
  classes: SchoolClass[];
  entries?: TimetableEntry[];
  timings?: SchoolTimings;
  assignments?: StaffAssignment[];
  onSaveStaff: (
    staff: Staff,
    scheduleSlots?: StaffScheduleSlot[],
    deletedEntryIds?: number[]
  ) => void | Promise<void>;
  onDeleteStaff: (staffId: number) => void;
  onRemoveStaffClass?: (staffId: number, classId: number) => void | Promise<void>;
}

const formatPeriodTime = (p: number, timings?: SchoolTimings): string => {
  switch (p) {
    case 1:
      return "09:10 - 09:50";
    case 2:
      return "09:50 - 10:30";
    case 3:
      return "10:45 - 11:25";
    case 4:
      return "11:25 - 12:05";
    case 5:
      return "12:50 - 13:30";
    case 6:
      return "13:30 - 14:10";
    case 7:
      return "14:20 - 15:00";
    case 8:
      return "15:00 - 15:40";
    default:
      return `Period ${p}`;
  }
};

export const StaffView: React.FC<StaffViewProps> = ({
  staffList,
  subjects,
  classes,
  entries = [],
  timings,
  assignments = [],
  onSaveStaff,
  onDeleteStaff,
  onRemoveStaffClass,
}) => {
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [name, setName] = useState<string>("");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [maxDay, setMaxDay] = useState<number>(6);
  const [maxWeek, setMaxWeek] = useState<number>(26);
  const [qualifiedSubjectIds, setQualifiedSubjectIds] = useState<number[]>([]);
  const [assignedClassIds, setAssignedClassIds] = useState<number[]>([]);
  const [scheduleSlots, setScheduleSlots] = useState<StaffScheduleSlot[]>([]);
  const [deletedEntryIds, setDeletedEntryIds] = useState<number[]>([]);

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const classMap = new Map(classes.map((c) => [c.id, c]));

  const activeDays =
    timings?.active_days && timings.active_days.length > 0
      ? timings.active_days
      : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const totalPeriods = timings?.total_periods || 8;

  const startCreate = () => {
    setIsCreating(true);
    setEditingStaff(null);
    setName("");
    setEmployeeId(`EMP00${staffList.length + 1}`);
    setEmail("");
    setPhone("");
    setMaxDay(6);
    setMaxWeek(26);
    setDeletedEntryIds([]);
    const initialQual = [subjects[0]?.id || 1];
    const initialClass = [classes[0]?.id || 1];
    setQualifiedSubjectIds(initialQual);
    setAssignedClassIds(initialClass);

    if (classes.length > 0) {
      setScheduleSlots([
        {
          tempId: `slot_${Date.now()}_0`,
          classId: classes[0].id,
          subjectId: initialQual[0],
          day: activeDays[0] || "Monday",
          period: 1,
        },
      ]);
    } else {
      setScheduleSlots([]);
    }
  };

  const startEdit = (st: Staff) => {
    setEditingStaff(st);
    setIsCreating(false);
    setName(st.name);
    setEmployeeId(st.employee_id || "");
    setEmail(st.email || "");
    setPhone(st.phone || "");
    setMaxDay(st.max_periods_per_day);
    setMaxWeek(st.max_periods_per_week);
    setQualifiedSubjectIds([...st.qualified_subject_ids]);

    // Strict validation: Only include assigned classes that currently exist in the school
    const validAssignedClasses = (st.assigned_class_ids || []).filter((cId) =>
      classMap.has(cId)
    );
    setAssignedClassIds(validAssignedClasses);

    // Pre-populate scheduleSlots from existing entries for this staff member
    // ONLY for classes that are currently in validAssignedClasses!
    const allEntriesForStaff = entries.filter(
      (e) =>
        Number(e.staff_id) === Number(st.id) &&
        !e.is_docked &&
        e.day !== "DOCK" &&
        Number(e.period) > 0
    );

    const validEntriesForStaff = allEntriesForStaff.filter((e) =>
      validAssignedClasses.includes(Number(e.class_id))
    );

    // Track any orphaned entry IDs (entries belonging to classes no longer assigned)
    // so they will be deleted atomically in Firestore and local state
    const orphanedEntryIds = allEntriesForStaff
      .filter((e) => !validAssignedClasses.includes(Number(e.class_id)))
      .map((e) => e.id);

    setDeletedEntryIds(orphanedEntryIds);

    if (validEntriesForStaff.length > 0) {
      const mappedSlots: StaffScheduleSlot[] = validEntriesForStaff.map((e) => ({
        id: e.id,
        tempId: `slot_${e.id}_${Math.random()}`,
        classId: e.class_id,
        subjectId: e.subject_id,
        day: e.day,
        period: e.period,
      }));
      setScheduleSlots(mappedSlots);
    } else {
      // If no valid entries exist yet, create initial slot rows strictly for the valid assigned classes
      const initialSlots: StaffScheduleSlot[] = validAssignedClasses.map((classId, idx) => {
        const asgn = assignments.find(
          (a) => Number(a.staff_id) === Number(st.id) && Number(a.class_id) === Number(classId)
        );
        const subId = asgn?.subject_id || st.qualified_subject_ids[0] || subjects[0]?.id || 1;
        return {
          tempId: `slot_init_${classId}_${idx}_${Date.now()}`,
          classId: classId,
          subjectId: subId,
          day: activeDays[idx % activeDays.length] || "Monday",
          period: ((idx * 2) % totalPeriods) + 1,
        };
      });
      setScheduleSlots(initialSlots);
    }
  };

  const toggleSubjectQual = (subId: number) => {
    setQualifiedSubjectIds((prev) => {
      const updated = prev.includes(subId)
        ? prev.filter((id) => id !== subId)
        : [...prev, subId];

      // If any schedule slot was using the deselected subject, reassign it
      if (prev.includes(subId) && updated.length > 0) {
        setScheduleSlots((slots) =>
          slots.map((s) =>
            s.subjectId === subId ? { ...s, subjectId: updated[0] } : s
          )
        );
      }
      return updated;
    });
  };

  const toggleAssignedClass = (classId: number) => {
    if (assignedClassIds.includes(classId)) {
      // 1. Unselect the class immediately from local form state
      setAssignedClassIds((prev) => prev.filter((id) => id !== classId));

      // 2. Queue any existing persistent timetable entries for this class to be deleted in Firestore
      const slotsToRemove = scheduleSlots.filter((s) => s.classId === classId);
      const idsToRemove = slotsToRemove.filter((s) => s.id).map((s) => s.id!);
      if (idsToRemove.length > 0) {
        setDeletedEntryIds((prev) => [...prev, ...idsToRemove]);
      }

      // 3. Location 1: Erase all inline schedule slot rows for this class immediately from Staff Form UI
      setScheduleSlots((prev) => prev.filter((s) => s.classId !== classId));

      // 4. Locations 2 & 3: Global Timetable Cleansing
      // If an existing staff member is being edited, immediately wipe all scheduled periods
      // for this teacher-class pairing from both the Class Timetable grid and the Staff Timetable grid
      if (editingStaff && onRemoveStaffClass) {
        onRemoveStaffClass(editingStaff.id, classId);
      }
    } else {
      setAssignedClassIds((prev) => [...prev, classId]);
      const defaultSub = qualifiedSubjectIds[0] || subjects[0]?.id || 1;
      setScheduleSlots((prev) => [
        ...prev,
        {
          tempId: `slot_${Date.now()}_${classId}`,
          classId: classId,
          subjectId: defaultSub,
          day: activeDays[0] || "Monday",
          period: 1,
        },
      ]);
    }
  };

  const handleAddSlotForClass = (classId: number) => {
    const defaultSub = qualifiedSubjectIds[0] || subjects[0]?.id || 1;
    const existingClassSlots = scheduleSlots.filter((s) => s.classId === classId);
    let nextPeriod = 1;
    let nextDay = activeDays[0] || "Monday";

    if (existingClassSlots.length > 0) {
      const lastSlot = existingClassSlots[existingClassSlots.length - 1];
      nextDay = lastSlot.day;
      nextPeriod = (lastSlot.period % totalPeriods) + 1;
    }

    setScheduleSlots((prev) => [
      ...prev,
      {
        tempId: `slot_${Date.now()}_${Math.random()}`,
        classId: classId,
        subjectId: defaultSub,
        day: nextDay,
        period: nextPeriod,
      },
    ]);
  };

  const handleUpdateSlot = (tempId: string, updates: Partial<StaffScheduleSlot>) => {
    setScheduleSlots((prev) =>
      prev.map((s) => (s.tempId === tempId ? { ...s, ...updates } : s))
    );
  };

  const handleRemoveSlot = (tempId: string) => {
    const slotToRemove = scheduleSlots.find((s) => s.tempId === tempId);
    if (slotToRemove?.id) {
      setDeletedEntryIds((prev) => [...prev, slotToRemove.id!]);
    }
    setScheduleSlots((prev) => prev.filter((s) => s.tempId !== tempId));
  };

  // Real-Time Staff Availability & Conflict Verification
  const getSlotConflictWarning = (slot: StaffScheduleSlot): string | null => {
    if (!slot.day || slot.day === "DOCK" || !slot.period || Number(slot.period) <= 0) {
      return null;
    }

    const teacherName = name.trim() || editingStaff?.name || "Teacher";
    const slotDay = String(slot.day).trim().toLowerCase();
    const slotPeriod = Number(slot.period);

    // 1. Scan this teacher's active schedule array across all other rows in this form
    const otherFormSlot = scheduleSlots.find(
      (s) =>
        s.tempId !== slot.tempId &&
        assignedClassIds.includes(s.classId) &&
        String(s.day).trim().toLowerCase() === slotDay &&
        Number(s.period) === slotPeriod
    );

    if (otherFormSlot) {
      const otherClassObj = classMap.get(otherFormSlot.classId);
      const otherSubObj = subjectMap.get(otherFormSlot.subjectId);
      const otherClassName = otherClassObj ? `Class ${otherClassObj.name}` : "another class";
      const otherSubName = otherSubObj ? ` ${otherSubObj.name}` : "";
      return `⚠️ Warning: ${teacherName} is already taking ${otherClassName}${otherSubName} during ${slot.day} - Period ${slot.period}.`;
    }

    // 2. Scan teacher's existing schedule array across other classes in the timetable (not being edited in the form)
    if (editingStaff) {
      const existingConflict = entries.find((e) => {
        if (Number(e.staff_id) !== Number(editingStaff.id)) return false;
        if (e.is_docked || e.day === "DOCK" || Number(e.period) <= 0) return false;
        if (
          String(e.day).trim().toLowerCase() !== slotDay ||
          Number(e.period) !== slotPeriod
        )
          return false;
        // If this entry matches one of the current form slot IDs, it's represented in the form
        if (scheduleSlots.some((s) => Number(s.id) === Number(e.id))) return false;
        return true;
      });

      if (existingConflict) {
        const otherClassObj = classMap.get(existingConflict.class_id);
        const otherSubObj = subjectMap.get(existingConflict.subject_id);
        const otherClassName = otherClassObj ? `Class ${otherClassObj.name}` : "another class";
        const otherSubName = otherSubObj ? ` ${otherSubObj.name}` : "";
        return `⚠️ Warning: ${teacherName} is already taking ${otherClassName}${otherSubName} during ${slot.day} - Period ${slot.period}.`;
      }

      // 3. Scan teacher unavailability / blocked periods
      const unavail = (editingStaff.unavailabilities || []).find(
        (u) =>
          String(u.day).trim().toLowerCase() === slotDay &&
          Number(u.period) === slotPeriod
      );
      if (unavail) {
        const reasonSuffix = unavail.reason ? ` (${unavail.reason})` : "";
        return `⚠️ Warning: ${teacherName} is marked unavailable during ${slot.day} - Period ${slot.period}${reasonSuffix}.`;
      }
    }

    return null;
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      const staffId = editingStaff ? editingStaff.id : Date.now();
      const activeAssignedClasses = assignedClassIds.filter((cId) => classMap.has(cId));

      const newStaff: Staff = {
        id: staffId,
        name: name.trim(),
        employee_id: employeeId.trim() || "",
        email: email.trim() || "",
        phone: phone.trim() || "",
        max_periods_per_day: maxDay,
        max_periods_per_week: maxWeek,
        qualified_subject_ids: qualifiedSubjectIds,
        assigned_class_ids: activeAssignedClasses,
        unavailabilities: editingStaff?.unavailabilities
          ? editingStaff.unavailabilities.map((u) => ({
              day: u.day,
              period: u.period,
              reason: u.reason || "",
            }))
          : [],
      };

      // Strict sanity filter: ensure scheduleSlots only contains classes that are in activeAssignedClasses
      const sanitizedSlots = scheduleSlots.filter(
        (s) => activeAssignedClasses.includes(s.classId) && classMap.has(s.classId)
      );

      await onSaveStaff(newStaff, sanitizedSlots, deletedEntryIds);
      setEditingStaff(null);
      setIsCreating(false);
    } catch (err) {
      console.error("Failed to save staff:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Staff & Faculty Directory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage teacher qualifications, maximum teaching limits, class authorizations, and direct timetable mappings.
          </p>
        </div>

        {!isCreating && !editingStaff && (
          <button
            id="btn-add-staff"
            onClick={startCreate}
            className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Add Staff Member</span>
          </button>
        )}
      </div>

      {/* Editor Modal */}
      {(isCreating || editingStaff) && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-emerald-200/60">
            <div className="flex items-center space-x-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <UserCheck className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-emerald-950">
                  {editingStaff ? `Edit Staff: ${editingStaff.name}` : "Add New Staff Member"}
                </h3>
                <p className="text-[11px] text-emerald-700">
                  Configure faculty credentials, qualified subjects, and inline period assignments.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setEditingStaff(null);
                setIsCreating(false);
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. RENUGA DEVI"
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Employee ID
              </label>
              <input
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="e.g. EMP001"
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. renuga@school.edu"
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Max Periods Per Day
              </label>
              <input
                type="number"
                min="1"
                max={totalPeriods}
                value={maxDay}
                onChange={(e) => setMaxDay(parseInt(e.target.value, 10) || 6)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Prevents teacher exhaustion across {totalPeriods} periods
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Max Periods Per Week
              </label>
              <input
                type="number"
                min="1"
                max="48"
                value={maxWeek}
                onChange={(e) => setMaxWeek(parseInt(e.target.value, 10) || 26)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Weekly maximum ceiling for total assigned periods
              </span>
            </div>
          </div>

          {/* Qualified Subjects Multi-Select */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Qualified Subjects (Select subjects this teacher is certified to teach)
              </label>
              <span className="text-[11px] text-slate-500">
                {qualifiedSubjectIds.length} qualified
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {subjects.map((s) => {
                const selected = qualifiedSubjectIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSubjectQual(s.id)}
                    className={`inline-flex items-center space-x-1.5 rounded-lg px-2.5 py-1 text-xs font-medium border transition-colors ${
                      selected
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${selected ? "bg-white" : ""}`}
                      style={!selected ? { backgroundColor: s.color } : {}}
                    />
                    <span>{s.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Eligible Classes & Structured Inline Schedule Rows */}
          <div className="mt-5 pt-4 border-t border-emerald-200/60">
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block text-xs font-bold text-slate-800">
                  Eligible Classes
                </label>
                <p className="text-[11px] text-slate-500">
                  Select classes authorized for this teacher. Each selected class unlocks inline subject & period schedule rows.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                {assignedClassIds.length} Classes Selected
              </span>
            </div>

            {/* Quick Class Selection Badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {classes.map((c) => {
                const selected = assignedClassIds.includes(c.id);
                const countForClass = scheduleSlots.filter((s) => s.classId === c.id).length;
                return (
                  <button
                    key={c.id}
                    id={`btn-class-badge-${c.id}`}
                    type="button"
                    onClick={() => toggleAssignedClass(c.id)}
                    className={`inline-flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all ${
                      selected
                        ? "bg-blue-600 text-white border-blue-700 shadow-2xs"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {selected ? <Check className="h-3 w-3 text-white" /> : null}
                    <span>{c.name}</span>
                    {selected && countForClass > 0 && (
                      <span className="ml-1 px-1.5 py-0.2 bg-blue-800/80 rounded-full text-[10px] text-white font-medium">
                        {countForClass} {countForClass === 1 ? "slot" : "slots"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Dynamic Structured Class, Subject, and Period Schedule Rows */}
            {(() => {
              const activeEligibleClassIds = assignedClassIds.filter((cId) => classMap.has(cId));
              const sanitizedSlots = scheduleSlots.filter((s) =>
                activeEligibleClassIds.includes(s.classId)
              );

              if (activeEligibleClassIds.length === 0) {
                return (
                  <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center">
                    <p className="text-xs text-slate-500 font-medium">
                      No eligible classes selected yet. Choose at least one class above to configure inline subject & period assignments.
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-3 mt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Zap className="h-4 w-4 text-amber-500" />
                      <span className="text-xs font-bold text-slate-800">
                        Inline Schedule Slots (Force-Override Priority)
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Auto-populates Class & Staff Timetables
                    </span>
                  </div>

                  <div className="space-y-3">
                    {activeEligibleClassIds.map((classId) => {
                      const cls = classMap.get(classId)!;
                      const classSlots = sanitizedSlots.filter((s) => s.classId === classId);

                      return (
                        <div
                          key={classId}
                          className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-3"
                        >
                          {/* Class Header */}
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <div className="flex items-center space-x-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                Class {cls.name}
                              </span>
                              {cls.room_number && (
                                <span className="text-[11px] text-slate-500 font-medium">
                                  Room {cls.room_number}
                                </span>
                              )}
                              <span className="text-[11px] text-slate-400">
                                • {classSlots.length} {classSlots.length === 1 ? "period" : "periods"} mapped
                              </span>
                            </div>

                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => handleAddSlotForClass(classId)}
                                className="inline-flex items-center space-x-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                              >
                                <Plus className="h-3 w-3" />
                                <span>Add Period</span>
                              </button>
                              <button
                                type="button"
                                id={`btn-remove-class-${classId}`}
                                onClick={() => toggleAssignedClass(classId)}
                                className="inline-flex items-center space-x-1 text-[11px] text-rose-500 hover:text-rose-700 font-medium px-2 py-1 rounded-md hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                                <span>Remove Class</span>
                              </button>
                            </div>
                          </div>

                          {/* List of Schedule Slot Rows */}
                          {classSlots.length === 0 ? (
                            <div className="p-3 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-center">
                              <p className="text-xs text-slate-500 mb-2">
                                No teaching slots mapped for Class {cls.name} yet.
                              </p>
                              <button
                                type="button"
                                onClick={() => handleAddSlotForClass(classId)}
                                className="inline-flex items-center space-x-1.5 rounded-lg bg-white px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-300 hover:bg-emerald-50 shadow-2xs"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                <span>Map Schedule Slot</span>
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              {classSlots.map((slot, sIdx) => {
                                // Filter teacher's qualified subjects only!
                                const teacherQualifiedSubjects = subjects.filter((s) =>
                                  qualifiedSubjectIds.includes(s.id)
                                );
                                const availableSubjects =
                                  teacherQualifiedSubjects.length > 0 ? teacherQualifiedSubjects : subjects;

                                const conflictWarning = getSlotConflictWarning(slot);
                                const hasConflict = !!conflictWarning;

                                return (
                                  <div key={slot.tempId} className="space-y-1.5">
                                    <div
                                      className={`flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-lg border transition-all ${
                                        hasConflict
                                          ? "bg-rose-50/40 border-rose-300 shadow-2xs"
                                          : "bg-slate-50 border-slate-200/80"
                                      }`}
                                    >
                                      {/* Slot Number */}
                                      <div className="flex items-center justify-between sm:justify-start space-x-2">
                                        <span
                                          className={`h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                                            hasConflict
                                              ? "bg-rose-200 text-rose-800"
                                              : "bg-slate-200 text-slate-700"
                                          }`}
                                        >
                                          {sIdx + 1}
                                        </span>
                                      </div>

                                      {/* 3 Inline Selectors Grid */}
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                                        {/* 1. [Select Subject]: Filters only qualified subjects */}
                                        <div>
                                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                                            Subject (Qualified Only)
                                          </label>
                                          <select
                                            value={slot.subjectId}
                                            onChange={(e) =>
                                              handleUpdateSlot(slot.tempId!, {
                                                subjectId: Number(e.target.value),
                                              })
                                            }
                                            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-hidden"
                                          >
                                            {availableSubjects.map((sub) => (
                                              <option key={sub.id} value={sub.id}>
                                                {sub.name} ({sub.code})
                                              </option>
                                            ))}
                                          </select>
                                        </div>

                                        {/* 2. [Select Day]: Monday to Friday/Saturday */}
                                        <div>
                                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                                            Day
                                          </label>
                                          <select
                                            value={slot.day}
                                            onChange={(e) =>
                                              handleUpdateSlot(slot.tempId!, {
                                                day: e.target.value,
                                              })
                                            }
                                            className={`w-full rounded-md border bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 focus:outline-hidden ${
                                              hasConflict
                                                ? "border-rose-400 focus:border-rose-500 text-rose-900"
                                                : "border-slate-300 focus:border-emerald-500"
                                            }`}
                                          >
                                            {activeDays.map((d) => (
                                              <option key={d} value={d}>
                                                {d}
                                              </option>
                                            ))}
                                            <option value="DOCK">Holding Dock (Staged)</option>
                                          </select>
                                        </div>

                                        {/* 3. [Select Period]: Period 1 to 8 */}
                                        <div>
                                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                                            Period
                                          </label>
                                          <select
                                            value={slot.period}
                                            onChange={(e) =>
                                              handleUpdateSlot(slot.tempId!, {
                                                period: Number(e.target.value),
                                              })
                                            }
                                            className={`w-full rounded-md border bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 focus:outline-hidden ${
                                              hasConflict
                                                ? "border-rose-400 focus:border-rose-500 text-rose-900"
                                                : "border-slate-300 focus:border-emerald-500"
                                            }`}
                                          >
                                            {Array.from(
                                              { length: totalPeriods },
                                              (_, i) => i + 1
                                            ).map((p) => (
                                              <option key={p} value={p}>
                                                Period {p} ({formatPeriodTime(p, timings)})
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>

                                      {/* Delete Slot Action */}
                                      <div className="flex items-center justify-end sm:justify-center pt-1 sm:pt-4">
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveSlot(slot.tempId!)}
                                          className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                          title="Remove this slot"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Visual Conflict Warning Alert (Soft-Override) */}
                                    {hasConflict && (
                                      <div className="flex items-center space-x-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 shadow-2xs">
                                        <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                                        <span>{conflictWarning}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Real-Time Auto-Population Notice */}
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 flex items-start space-x-2.5">
            <Zap className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Instant Auto-Population & Force-Override Active:</span>{" "}
              Saving this form will immediately populate all {scheduleSlots.length} mapped period(s) in both{" "}
              <strong>Class Timetables</strong> and <strong>Staff Timetables</strong> simultaneously without page refresh, force-overriding any background scheduling rules.
            </div>
          </div>

          <div className="mt-5 flex justify-end space-x-2">
            <button
              onClick={() => {
                setEditingStaff(null);
                setIsCreating(false);
              }}
              disabled={isSaving}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{isSaving ? "Saving & Syncing..." : "Save Staff & Auto-Populate Timetables"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Staff Cards Grid */}
      {staffList.length === 0 && !isCreating && !editingStaff && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-4">
            <Users className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Staff Members Configured</h3>
          <p className="max-w-md text-sm text-slate-500 mt-1.5 mb-5">
            Start by adding your teachers and faculty members, defining their subjects and maximum workload.
          </p>
          <button
            onClick={startCreate}
            className="inline-flex items-center space-x-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Add First Staff Member</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {staffList.map((st) => {
          const teacherEntries = entries.filter(
            (e) =>
              Number(e.staff_id) === Number(st.id) &&
              !e.is_docked &&
              e.day !== "DOCK" &&
              Number(e.period) > 0
          );
          const dockedCount = entries.filter(
            (e) =>
              Number(e.staff_id) === Number(st.id) &&
              (e.is_docked || e.day === "DOCK" || Number(e.period) === 0)
          ).length;

          return (
            <div
              key={st.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{st.name}</h3>
                    <p className="text-xs text-slate-500">ID: {st.employee_id || "N/A"}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => startEdit(st)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    title="Edit Staff & Schedule"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      if (
                        window.confirm(
                          `Are you sure you want to delete staff member "${st.name}"? This will remove all their timetable assignments.`
                        )
                      ) {
                        try {
                          setDeletingId(st.id);
                          await onDeleteStaff(st.id);
                        } catch (err) {
                          console.error("Failed to delete staff:", err);
                        } finally {
                          setDeletingId(null);
                        }
                      }
                    }}
                    disabled={deletingId === st.id}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    title="Delete Staff"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
                <div className="text-slate-500">
                  Max Daily: <span className="font-semibold text-slate-800">{st.max_periods_per_day}</span>
                </div>
                <div className="text-slate-500">
                  Max Weekly: <span className="font-semibold text-slate-800">{st.max_periods_per_week}</span>
                </div>
              </div>

              {/* Scheduled Timetable Slots Count */}
              <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 border border-slate-200/70 text-xs">
                <span className="text-slate-600 font-medium flex items-center space-x-1.5">
                  <Clock className="h-3.5 w-3.5 text-blue-600" />
                  <span>Mapped Teaching Slots:</span>
                </span>
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-blue-700">
                    {teacherEntries.length} periods
                  </span>
                  {dockedCount > 0 && (
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                      +{dockedCount} docked
                    </span>
                  )}
                </div>
              </div>

              {/* Qualifications */}
              <div className="mt-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Qualified Subjects
                </div>
                <div className="flex flex-wrap gap-1">
                  {st.qualified_subject_ids.map((sId) => {
                    const sub = subjectMap.get(sId);
                    if (!sub) return null;
                    return (
                      <span
                        key={sId}
                        className="inline-flex items-center space-x-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 bg-slate-50 border border-slate-200"
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: sub.color }}
                        />
                        <span>{sub.name}</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Authorized Classes */}
              <div className="mt-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Authorized Classes
                </div>
                <div className="flex flex-wrap gap-1">
                  {st.assigned_class_ids.map((cId) => {
                    const c = classMap.get(cId);
                    if (!c) return null;
                    return (
                      <span
                        key={cId}
                        className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200"
                      >
                        {c.name}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Unavailability Count */}
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                <div className="flex items-center space-x-1 text-slate-500">
                  <CalendarOff className="h-3.5 w-3.5 text-slate-400" />
                  <span>{(st.unavailabilities || []).length} blocked periods</span>
                </div>
                {(st.unavailabilities || []).length > 0 && (
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 border border-rose-100">
                    Restricted
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

