import React, { useState } from "react";
import {
  SchoolClass,
  Staff,
  Subject,
  TimetableEntry,
  SchoolTimings,
  StaffAssignment,
} from "../types";
import {
  Download,
  Printer,
  RefreshCw,
  Move,
  Info,
  CheckCircle2,
  AlertTriangle,
  Coffee,
  Utensils,
  MapPin,
  User,
  FileText,
  Layers,
  GraduationCap,
  Archive,
  Plus,
  Trash2,
  ArrowUpRight,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import { TimetableExporter } from "../services/exporter";

interface ClassTimetableViewProps {
  classes: SchoolClass[];
  staffList: Staff[];
  subjects: Subject[];
  entries: TimetableEntry[];
  timings: SchoolTimings;
  assignments?: StaffAssignment[];
  onMoveEntry: (
    entryId: number,
    newDay: string,
    newPeriod: number,
    options?: { forceSwap?: boolean; toDock?: boolean }
  ) => Promise<{ success: boolean; error?: string }> | { success: boolean; error?: string };
  onDeleteEntry?: (entryId: number) => void;
  onAddEntry?: (entry: TimetableEntry) => void;
  onAssignSlot?: (
    classId: number,
    day: string,
    period: number,
    subjectId: number,
    staffId: number
  ) => void;
  onRegenerateClass: (classId: number) => void;
}

export const ClassTimetableView: React.FC<ClassTimetableViewProps> = ({
  classes,
  staffList,
  subjects,
  entries,
  timings,
  assignments = [],
  onMoveEntry,
  onDeleteEntry,
  onAddEntry,
  onAssignSlot,
  onRegenerateClass,
}) => {
  const [selectedClassId, setSelectedClassId] = useState<number>(classes[0]?.id || 1);
  const [moveModalEntry, setMoveModalEntry] = useState<TimetableEntry | null>(null);
  const [targetDay, setTargetDay] = useState<string>("Monday");
  const [targetPeriod, setTargetPeriod] = useState<number>(1);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moveSuccess, setMoveSuccess] = useState<string | null>(null);
  const [moveToast, setMoveToast] = useState<string | null>(null);

  // Drag & Drop State
  const [draggedEntry, setDraggedEntry] = useState<TimetableEntry | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ day: string; period: number } | null>(null);
  const [isOverDock, setIsOverDock] = useState<boolean>(false);

  // Quick Add Extra Class to Dock modal state
  const [isAddDockOpen, setIsAddDockOpen] = useState<boolean>(false);
  const [dockSubjectId, setDockSubjectId] = useState<number>(subjects[0]?.id || 1);
  const [dockStaffId, setDockStaffId] = useState<number>(staffList[0]?.id || 1);

  // Inline Period Assignment Popover state
  const [activeSlotPopover, setActiveSlotPopover] = useState<{
    day: string;
    period: number;
    subjectId: number;
    staffId: number;
  } | null>(null);

  // PDF Export States
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isExportingAllPdf, setIsExportingAllPdf] = useState<boolean>(false);
  const [pdfProgressText, setPdfProgressText] = useState<string | null>(null);
  const [pdfToast, setPdfToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const selectedClass = classes.find((c) => Number(c.id) === Number(selectedClassId)) || classes[0];

  const staffMap = React.useMemo(() => {
    const map = new Map<any, Staff>();
    staffList.forEach((s) => {
      map.set(s.id, s);
      map.set(String(s.id), s);
      map.set(Number(s.id), s);
    });
    return map;
  }, [staffList]);

  const subjectMap = React.useMemo(() => {
    const map = new Map<any, Subject>();
    subjects.forEach((s) => {
      map.set(s.id, s);
      map.set(String(s.id), s);
      map.set(Number(s.id), s);
    });
    return map;
  }, [subjects]);

  // Holding Dock entries for this class (or all classes if needed)
  const dockedEntries = React.useMemo(() => {
    return entries.filter((e) => {
      if (!e) return false;
      const isDocked = Boolean(e.is_docked || e.day === "DOCK" || Number(e.period) === 0);
      if (!isDocked) return false;
      return Number(e.class_id) === Number(selectedClassId);
    });
  }, [entries, selectedClassId]);

  // Dynamically filter staff members assigned/qualified to teach the selected subject
  const eligibleStaffForActiveSlot = React.useMemo(() => {
    if (!activeSlotPopover) return staffList;
    const subjId = activeSlotPopover.subjectId;
    const filtered = staffList.filter((st) => {
      const isQualified = st.qualified_subject_ids?.includes(subjId);
      const isAssigned = assignments.some(
        (a) => Number(a.staff_id) === Number(st.id) && Number(a.subject_id) === Number(subjId)
      );
      return isQualified || isAssigned;
    });
    return filtered.length > 0 ? filtered : staffList;
  }, [activeSlotPopover?.subjectId, staffList, assignments]);

  // Real-time conflict lookup for staff in the current slot
  const staffConflictMap = React.useMemo(() => {
    if (!activeSlotPopover) return new Map<number, string>();
    const { day, period } = activeSlotPopover;
    const map = new Map<number, string>();

    staffList.forEach((st) => {
      // 1. Conflict: already teaching another class during this identical Day and Period
      const busyEntry = entries.find(
        (e) =>
          e.day === day &&
          Number(e.period) === Number(period) &&
          Number(e.staff_id) === Number(st.id) &&
          Number(e.class_id) !== Number(selectedClassId) &&
          !e.is_docked &&
          e.day !== "DOCK" &&
          Number(e.period) !== 0
      );
      if (busyEntry) {
        const busyClass = classes.find((c) => Number(c.id) === Number(busyEntry.class_id));
        map.set(
          st.id,
          `Busy in ${busyClass ? busyClass.name : `Class #${busyEntry.class_id}`}`
        );
        return;
      }

      // 2. Unavailability flag
      const unavail = st.unavailabilities?.find(
        (u) => u.day === day && Number(u.period) === Number(period)
      );
      if (unavail) {
        map.set(st.id, unavail.reason || "Marked unavailable");
      }
    });

    return map;
  }, [activeSlotPopover?.day, activeSlotPopover?.period, staffList, entries, selectedClassId, classes]);

  if (classes.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Class Timetable View
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Weekly period schedule, room assignments, and conflict-free lesson distribution
          </p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-4">
            <GraduationCap className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Classes Created Yet</h3>
          <p className="max-w-md text-sm text-slate-500 mt-1.5">
            The application is starting with an empty database. Please navigate to the "Classes" tab to create your school standards, sections, and subject requirements.
          </p>
        </div>
      </div>
    );
  }

  // Export current class timetable as PDF
  const handleExportClassPdf = async () => {
    if (!selectedClass || isExportingPdf) return;
    setIsExportingPdf(true);
    setPdfToast(null);
    try {
      await TimetableExporter.exportClassPDF(
        selectedClass.id,
        entries,
        classes,
        staffList,
        subjects,
        timings
      );
      setPdfToast({
        message: `✓ Successfully generated PDF for ${selectedClass.name} with ${timings.school_name} and ${timings.academic_year} headers!`,
        type: "success",
      });
      setTimeout(() => setPdfToast(null), 5000);
    } catch (err: any) {
      console.error("PDF generation failed:", err);
      setPdfToast({
        message: `Failed to generate PDF: ${err?.message || "Unknown error"}`,
        type: "error",
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Export all class timetables in a combined multi-page PDF document
  const handleExportAllClassesPdf = async () => {
    if (isExportingAllPdf) return;
    setIsExportingAllPdf(true);
    setPdfProgressText(`Exporting 1 / ${classes.length}...`);
    try {
      await TimetableExporter.exportAllClassesPDF(
        classes,
        entries,
        staffList,
        subjects,
        timings,
        (current, total) => {
          setPdfProgressText(`Generating page ${current} of ${total}...`);
        }
      );
      setPdfToast({
        message: `✓ Successfully generated multi-page PDF for all ${classes.length} classes!`,
        type: "success",
      });
      setTimeout(() => setPdfToast(null), 5000);
    } catch (err: any) {
      console.error("All classes PDF generation failed:", err);
      setPdfToast({
        message: `Failed to generate All Classes PDF: ${err?.message || "Unknown error"}`,
        type: "error",
      });
    } finally {
      setIsExportingAllPdf(false);
      setPdfProgressText(null);
    }
  };

  const getPeriodTime = (p: number): string => {
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

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, entry: TimetableEntry) => {
    setDraggedEntry(entry);
    e.dataTransfer.setData("application/json", JSON.stringify(entry));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedEntry(null);
    setDragOverSlot(null);
    setIsOverDock(false);
  };

  const handleDropOnSlot = async (e: React.DragEvent, day: string, period: number) => {
    e.preventDefault();
    setDragOverSlot(null);

    let entryToMove = draggedEntry;
    if (!entryToMove) {
      try {
        const raw = e.dataTransfer.getData("application/json");
        if (raw) entryToMove = JSON.parse(raw);
      } catch {
        // ignore
      }
    }
    if (!entryToMove) return;

    // If dropped on the same slot, do nothing
    if (
      entryToMove.day === day &&
      Number(entryToMove.period) === Number(period) &&
      !entryToMove.is_docked
    ) {
      return;
    }

    try {
      const result = await onMoveEntry(entryToMove.id, day, period, { forceSwap: true });
      if (result.success) {
        setMoveToast(`✓ Assigned to ${day} - Period ${period} (swapped if occupied)`);
        setTimeout(() => setMoveToast(null), 3000);
      }
    } catch (err) {
      console.error("Drop error:", err);
    } finally {
      setDraggedEntry(null);
    }
  };

  const handleDropOnDock = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsOverDock(false);

    let entryToMove = draggedEntry;
    if (!entryToMove) {
      try {
        const raw = e.dataTransfer.getData("application/json");
        if (raw) entryToMove = JSON.parse(raw);
      } catch {
        // ignore
      }
    }
    if (!entryToMove) return;

    if (entryToMove.is_docked || entryToMove.day === "DOCK" || Number(entryToMove.period) === 0) {
      return;
    }

    try {
      const result = await onMoveEntry(entryToMove.id, "DOCK", 0, { toDock: true });
      if (result.success) {
        setMoveToast(`✓ Lesson moved to Holding Dock (slot freed)`);
        setTimeout(() => setMoveToast(null), 3000);
      }
    } catch (err) {
      console.error("Dock drop error:", err);
    } finally {
      setDraggedEntry(null);
    }
  };

  const handleSendToDock = async (entry: TimetableEntry) => {
    try {
      await onMoveEntry(entry.id, "DOCK", 0, { toDock: true });
      setMoveToast(`✓ Lesson moved to Holding Dock`);
      setTimeout(() => setMoveToast(null), 3000);
      if (moveModalEntry?.id === entry.id) {
        setMoveModalEntry(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Manual Modal Move
  const handleOpenMove = (entry: TimetableEntry) => {
    setMoveModalEntry(entry);
    setTargetDay(entry.day === "DOCK" ? (timings.active_days[0] || "Monday") : entry.day);
    setTargetPeriod(entry.period === 0 ? 1 : entry.period);
    setMoveError(null);
    setMoveSuccess(null);
  };

  const handleApplyMove = async () => {
    if (!moveModalEntry) return;
    try {
      const result = await onMoveEntry(moveModalEntry.id, targetDay, targetPeriod, { forceSwap: true });
      if (!result.success) {
        setMoveError(result.error || "Cannot move to this slot.");
        setMoveSuccess(null);
      } else {
        setMoveSuccess("Successfully placed / swapped slot!");
        setMoveError(null);
        setTimeout(() => setMoveModalEntry(null), 800);
      }
    } catch (err: any) {
      setMoveError(err.message || "Failed to move slot.");
      setMoveSuccess(null);
    }
  };

  // Add new extra class directly to the holding dock
  const handleCreateDockEntry = () => {
    if (!onAddEntry) return;
    const newEntry: TimetableEntry = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      class_id: selectedClassId,
      subject_id: dockSubjectId,
      staff_id: dockStaffId,
      day: "DOCK",
      period: 0,
      room_number: selectedClass?.room_number || "",
      is_docked: true,
    };
    onAddEntry(newEntry);
    setIsAddDockOpen(false);
    setMoveToast(`✓ Added extra class to Holding Dock`);
    setTimeout(() => setMoveToast(null), 3000);
  };

  // Inline slot assignment confirmation handler
  const handleConfirmInlineAssignment = (day: string, period: number) => {
    if (!activeSlotPopover) return;
    const { subjectId, staffId } = activeSlotPopover;

    if (onAssignSlot) {
      onAssignSlot(selectedClassId, day, period, subjectId, staffId);
    } else {
      const existing = entries.find(
        (e) =>
          Number(e.class_id) === Number(selectedClassId) &&
          e.day === day &&
          Number(e.period) === Number(period) &&
          !e.is_docked
      );
      if (existing) {
        if (onAddEntry) {
          onAddEntry({
            ...existing,
            subject_id: subjectId,
            staff_id: staffId,
          });
        }
      } else if (onAddEntry) {
        onAddEntry({
          id: Date.now() + Math.floor(Math.random() * 1000),
          class_id: selectedClassId,
          day,
          period,
          subject_id: subjectId,
          staff_id: staffId,
          room_number: selectedClass?.room_number || "",
          is_docked: false,
        });
      }
    }

    const assignedSubject = subjectMap.get(subjectId);
    const assignedStaff = staffMap.get(staffId);
    setMoveToast(
      `✓ Assigned ${assignedSubject?.name || "Subject"} (${assignedStaff?.name || "Teacher"}) on ${day} Period ${period}`
    );
    setTimeout(() => setMoveToast(null), 3000);
    setActiveSlotPopover(null);
  };

  return (
    <div className="space-y-6">
      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center space-x-3">
          <label htmlFor="class-select" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Select Class:
          </label>
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
            {classes.map((cls) => (
              <button
                key={cls.id}
                id={`btn-select-class-${cls.name}`}
                onClick={() => setSelectedClassId(cls.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  selectedClassId === cls.id
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {cls.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-regen-class"
            onClick={() => onRegenerateClass(selectedClassId)}
            className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer"
            title="Regenerate only this class while locking other classes"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
            <span>Regenerate</span>
          </button>

          <button
            id="btn-export-class-csv"
            onClick={() =>
              TimetableExporter.exportClassCSV(
                selectedClassId,
                entries,
                classes,
                staffList,
                subjects,
                timings
              )
            }
            className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer"
            title="Export CSV spreadsheet"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>CSV</span>
          </button>

          {/* Primary Print to PDF button using jsPDF + html2canvas */}
          <button
            id="btn-print-class-pdf"
            onClick={handleExportClassPdf}
            disabled={isExportingPdf}
            className="inline-flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
            title="Export clean, formatted PDF document with school name and academic year header"
          >
            {isExportingPdf ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Exporting PDF...</span>
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5" />
                <span>Print to PDF</span>
              </>
            )}
          </button>

          {/* Multi-page All Classes PDF export */}
          <button
            id="btn-export-all-classes-pdf"
            onClick={handleExportAllClassesPdf}
            disabled={isExportingAllPdf}
            className="inline-flex items-center space-x-1.5 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100/70 disabled:opacity-50 shadow-xs transition-colors cursor-pointer"
            title="Export all classes in a single multi-page PDF document"
          >
            {isExportingAllPdf ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-600" />
                <span>{pdfProgressText || "Exporting All..."}</span>
              </>
            ) : (
              <>
                <Layers className="h-3.5 w-3.5 text-blue-600" />
                <span>All Classes (PDF)</span>
              </>
            )}
          </button>

          <button
            id="btn-print-class"
            onClick={() =>
              TimetableExporter.printSchedule(
                `Class Timetable - ${selectedClass?.name}`,
                "class-timetable-grid"
              )
            }
            className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer"
            title="Quick browser print"
          >
            <Printer className="h-3.5 w-3.5 text-slate-500" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Floating Action Toast / Feedback */}
      {(moveToast || pdfToast) && (
        <div
          className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-xs font-medium border shadow-xs transition-all ${
            pdfToast && pdfToast.type === "error"
              ? "bg-rose-50 text-rose-800 border-rose-200"
              : "bg-emerald-50 text-emerald-800 border-emerald-200"
          }`}
        >
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{moveToast || pdfToast?.message}</span>
          </div>
          <button
            onClick={() => {
              setMoveToast(null);
              setPdfToast(null);
            }}
            className="text-slate-400 hover:text-slate-600 ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Class Details Banner & Drag-and-Drop Guidance */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-blue-50/70 border border-blue-200/70 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-blue-950">
            Standard: {selectedClass?.name}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-800">
            Room: {selectedClass?.room_number || "Main Building"}
          </span>
          <span className="text-xs text-blue-700">
            Grade {selectedClass?.grade} • Sec {selectedClass?.section}
          </span>
        </div>
        <div className="flex items-center space-x-2 text-xs text-blue-900 font-medium">
          <Sparkles className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          <span>
            <strong>Free-Form Drag & Drop:</strong> Drag cards anywhere to reassign or swap slots. Drag to the bottom Dock to temporarily free a slot.
          </span>
        </div>
      </div>

      {/* Main Timetable Grid */}
      <div
        id="class-timetable-grid"
        className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs"
      >
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-semibold text-slate-700">
              <th className="p-3 w-32 border-r border-slate-200">Period / Time</th>
              {timings.active_days.map((day) => (
                <th key={day} className="p-3 border-r border-slate-200 last:border-r-0 text-center font-bold">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {Array.from({ length: timings.total_periods }, (_, i) => i + 1).map((p) => {
              return (
                <React.Fragment key={`period-fragment-${p}`}>
                  {p === 3 && (
                    <tr key="break-1" className="bg-amber-50/70 border-y border-amber-200/80">
                      <td className="p-2.5 font-semibold text-amber-900 border-r border-amber-200/80 flex items-center space-x-1.5">
                        <Coffee className="h-3.5 w-3.5 text-amber-600" />
                        <span>10:30 - 10:45</span>
                      </td>
                      <td
                        colSpan={timings.active_days.length}
                        className="p-2 text-center font-medium tracking-wide text-amber-800 uppercase text-[11px]"
                      >
                        ☕ Morning Interval (15 minutes)
                      </td>
                    </tr>
                  )}

                  {p === 5 && (
                    <tr key="lunch" className="bg-orange-50/80 border-y border-orange-200">
                      <td className="p-2.5 font-semibold text-orange-900 border-r border-orange-200 flex items-center space-x-1.5">
                        <Utensils className="h-3.5 w-3.5 text-orange-600" />
                        <span>12:05 - 12:50</span>
                      </td>
                      <td
                        colSpan={timings.active_days.length}
                        className="p-2 text-center font-medium tracking-wide text-orange-800 uppercase text-[11px]"
                      >
                        🍱 Lunch Break (45 minutes)
                      </td>
                    </tr>
                  )}

                  {p === 7 && (
                    <tr key="break-2" className="bg-amber-50/70 border-y border-amber-200/80">
                      <td className="p-2.5 font-semibold text-amber-900 border-r border-amber-200/80 flex items-center space-x-1.5">
                        <Coffee className="h-3.5 w-3.5 text-amber-600" />
                        <span>14:10 - 14:20</span>
                      </td>
                      <td
                        colSpan={timings.active_days.length}
                        className="p-2 text-center font-medium tracking-wide text-amber-800 uppercase text-[11px]"
                      >
                        ☕ Afternoon Interval (10 minutes)
                      </td>
                    </tr>
                  )}

                  <tr key={`period-${p}`} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3 font-semibold text-slate-800 border-r border-slate-200 bg-slate-50/30">
                      <div>Period {p}</div>
                      <div className="text-[10px] font-normal text-slate-400 mt-0.5">
                        {getPeriodTime(p)}
                      </div>
                    </td>

                    {timings.active_days.map((day) => {
                      const entry = entries.find((e) => {
                        if (!e) return false;
                        if (e.is_docked || e.day === "DOCK" || Number(e.period) === 0) return false;

                        const entryClassId = e.class_id !== undefined ? e.class_id : (e as any).classId;
                        if (entryClassId !== undefined && selectedClassId !== undefined) {
                          if (Number(entryClassId) !== Number(selectedClassId)) return false;
                        }

                        const entryDay = String(e.day || (e as any).day_name || (e as any).dayName || "").trim().toLowerCase();
                        const targetDayStr = String(day || "").trim().toLowerCase();
                        if (entryDay !== targetDayStr) return false;

                        const entryPeriod = e.period !== undefined ? e.period : ((e as any).period_number ?? (e as any).periodNumber);
                        if (Number(entryPeriod) !== Number(p)) return false;

                        return true;
                      });

                      const rawSubjectId = entry ? (entry.subject_id !== undefined ? entry.subject_id : (entry as any).subjectId) : null;
                      const rawStaffId = entry ? (entry.staff_id !== undefined ? entry.staff_id : (entry as any).staffId) : null;

                      const subject = entry ? (
                        subjectMap.get(rawSubjectId) ||
                        subjectMap.get(Number(rawSubjectId)) ||
                        subjectMap.get(String(rawSubjectId)) || {
                          id: Number(rawSubjectId) || 0,
                          name: (entry as any).subject_name || (entry as any).subject || `Subject ${rawSubjectId ?? ""}`,
                          code: (entry as any).subject_code || (entry as any).code || `SUB${rawSubjectId ?? ""}`,
                          color: "#2563eb",
                          is_lab: false,
                          periods_per_week: 1,
                        }
                      ) : null;

                      const staff = entry ? (
                        staffMap.get(rawStaffId) ||
                        staffMap.get(Number(rawStaffId)) ||
                        staffMap.get(String(rawStaffId)) ||
                        (rawStaffId ? {
                          id: Number(rawStaffId) || 0,
                          name: (entry as any).staff_name || (entry as any).teacher_name || `Teacher ${rawStaffId}`,
                          employee_id: "",
                          max_periods_per_day: 6,
                          max_periods_per_week: 30,
                          qualified_subject_ids: [],
                          assigned_class_ids: [],
                          unavailabilities: [],
                        } : null)
                      ) : null;

                      const isSlotHovered = dragOverSlot?.day === day && dragOverSlot?.period === p;
                      const isCurrentSlotPopoverOpen =
                        activeSlotPopover?.day === day && activeSlotPopover?.period === p;

                      return (
                        <td
                          key={`${day}-${p}`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            if (dragOverSlot?.day !== day || dragOverSlot?.period !== p) {
                              setDragOverSlot({ day, period: p });
                            }
                          }}
                          onDragLeave={() => {
                            if (dragOverSlot?.day === day && dragOverSlot?.period === p) {
                              setDragOverSlot(null);
                            }
                          }}
                          onDrop={(e) => handleDropOnSlot(e, day, p)}
                          className={`relative p-2 border-r border-slate-200 last:border-r-0 align-top min-w-[140px] transition-colors ${
                            isSlotHovered
                              ? entry
                                ? "bg-amber-100/60 ring-2 ring-inset ring-amber-400"
                                : "bg-blue-100/60 ring-2 ring-inset ring-blue-400"
                              : ""
                          }`}
                        >
                          {entry ? (
                            <div
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, entry)}
                              onDragEnd={handleDragEnd}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveSlotPopover({
                                  day,
                                  period: p,
                                  subjectId: entry.subject_id,
                                  staffId: entry.staff_id,
                                });
                              }}
                              className={`group relative cursor-pointer rounded-xl p-2.5 border shadow-2xs transition-all hover:scale-[1.02] hover:shadow-xs ${
                                draggedEntry?.id === entry.id ? "opacity-40 ring-2 ring-blue-500" : ""
                              }`}
                              style={{
                                backgroundColor: `${subject?.color || "#2563eb"}15`,
                                borderColor: `${subject?.color || "#2563eb"}40`,
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <span
                                  className="inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider"
                                  style={{ backgroundColor: subject?.color || "#2563eb" }}
                                >
                                  {subject?.code || subject?.name?.slice(0, 4) || "SUB"}
                                </span>
                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSendToDock(entry);
                                    }}
                                    title="Send to Extra Classes Holding Dock"
                                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-amber-600 transition-opacity"
                                  >
                                    <Archive className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenMove(entry);
                                    }}
                                    title="Move lesson"
                                    className="p-0.5 text-slate-400 opacity-60 group-hover:opacity-100 hover:text-blue-600"
                                  >
                                    <Move className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>

                              <div className="mt-1 font-bold text-slate-900 text-xs truncate">
                                {subject?.name || "Subject"}
                              </div>

                              <div className="mt-1 flex items-center space-x-1 text-[11px] text-slate-600 truncate">
                                <User className="h-3 w-3 text-slate-400 shrink-0" />
                                <span className="truncate">{staff?.name || "Teacher"}</span>
                              </div>

                              {entry.room_number && (
                                <div className="mt-0.5 flex items-center space-x-1 text-[10px] text-slate-400">
                                  <MapPin className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                                  <span>{entry.room_number}</span>
                                </div>
                              )}

                              {isSlotHovered && (
                                <div className="absolute inset-0 bg-amber-500/15 backdrop-blur-[0.5px] rounded-xl flex items-center justify-center pointer-events-none">
                                  <span className="bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                                    Swap Slots
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveSlotPopover({
                                  day,
                                  period: p,
                                  subjectId: subjects[0]?.id || 1,
                                  staffId: staffList[0]?.id || 1,
                                });
                              }}
                              className={`h-16 flex items-center justify-center rounded-lg border text-[11px] cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 hover:text-blue-600 transition-all ${
                                isSlotHovered
                                  ? "border-blue-400 bg-blue-50/70 text-blue-600 font-semibold"
                                  : "border-dashed border-slate-200 text-slate-300"
                              }`}
                            >
                              {isSlotHovered ? "Drop to Place" : "Open"}
                            </div>
                          )}

                          {/* Inline Period Assignment Popover on Click */}
                          {isCurrentSlotPopoverOpen && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveSlotPopover(null);
                                }}
                              />
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute left-1 top-1 z-50 w-56 rounded-xl bg-white p-3 shadow-2xl border-2 border-blue-500 ring-4 ring-blue-500/10 text-left"
                              >
                                <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100">
                                  <div className="text-[11px] font-bold text-slate-900 flex items-center space-x-1.5">
                                    <Sparkles className="h-3 w-3 text-blue-600" />
                                    <span>Assign {day} · P{p}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setActiveSlotPopover(null)}
                                    className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>

                                <div className="space-y-2.5">
                                  <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                      Subject
                                    </label>
                                    <select
                                      value={activeSlotPopover.subjectId}
                                      onChange={(e) => {
                                        const newSubjId = Number(e.target.value);
                                        const eligible = staffList.filter((st) => {
                                          const isQual = st.qualified_subject_ids?.includes(newSubjId);
                                          const isAsgn = assignments.some(
                                            (a) =>
                                              Number(a.staff_id) === Number(st.id) &&
                                              Number(a.subject_id) === Number(newSubjId)
                                          );
                                          return isQual || isAsgn;
                                        });
                                        const fallback = eligible.length > 0 ? eligible : staffList;
                                        const isCurrentEligible = fallback.some((s) => s.id === activeSlotPopover.staffId);
                                        setActiveSlotPopover((prev) =>
                                          prev
                                            ? {
                                                ...prev,
                                                subjectId: newSubjId,
                                                staffId: isCurrentEligible ? prev.staffId : (fallback[0]?.id || prev.staffId),
                                              }
                                            : null
                                        );
                                      }}
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none cursor-pointer"
                                    >
                                      {subjects.map((sub) => (
                                        <option key={sub.id} value={sub.id}>
                                          {sub.name} ({sub.code || sub.name.slice(0, 4)})
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                        Teacher (Staff)
                                      </label>
                                      <span className="text-[9px] text-slate-400 font-medium">
                                        {eligibleStaffForActiveSlot.length} eligible
                                      </span>
                                    </div>
                                    <select
                                      value={activeSlotPopover.staffId}
                                      onChange={(e) =>
                                        setActiveSlotPopover((prev) =>
                                          prev ? { ...prev, staffId: Number(e.target.value) } : null
                                        )
                                      }
                                      className={`w-full rounded-lg border px-2.5 py-1.5 text-xs focus:bg-white focus:outline-none cursor-pointer transition-colors ${
                                        staffConflictMap.has(activeSlotPopover.staffId)
                                          ? "border-rose-400 bg-rose-50/70 text-rose-900 font-medium focus:border-rose-500"
                                          : "border-slate-200 bg-slate-50 text-slate-800 font-medium focus:border-blue-500"
                                      }`}
                                    >
                                      {eligibleStaffForActiveSlot.map((st) => {
                                        const conflictText = staffConflictMap.get(st.id);
                                        return (
                                          <option
                                            key={st.id}
                                            value={st.id}
                                            className={conflictText ? "text-rose-600 font-bold bg-rose-50" : "text-slate-800"}
                                          >
                                            {conflictText
                                              ? `⚠️ ${st.name} (${conflictText})`
                                              : st.name}
                                          </option>
                                        );
                                      })}
                                    </select>

                                    {/* Real-time conflict intimation alert */}
                                    {staffConflictMap.has(activeSlotPopover.staffId) && (
                                      <div className="mt-1.5 rounded-lg bg-rose-50 border border-rose-200 p-2 text-[10px] text-rose-800 flex items-start space-x-1.5 leading-tight">
                                        <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
                                        <div>
                                          <span className="font-bold text-rose-900">Conflict Detected:</span>{" "}
                                          {staffConflictMap.get(activeSlotPopover.staffId)}.
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
                                    <button
                                      type="button"
                                      onClick={() => setActiveSlotPopover(null)}
                                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleConfirmInlineAssignment(day, p)}
                                      className="inline-flex items-center space-x-1 rounded-lg bg-blue-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-blue-700 shadow-xs cursor-pointer"
                                    >
                                      <Check className="h-3 w-3" />
                                      <span>Save</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Extra Classes "Holding Dock" (Staging Area) */}
      <div
        id="holding-dock-container"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (!isOverDock) setIsOverDock(true);
        }}
        onDragLeave={() => setIsOverDock(false)}
        onDrop={handleDropOnDock}
        className={`rounded-2xl border-2 transition-all p-5 shadow-xs ${
          isOverDock
            ? "border-blue-500 bg-blue-50/80 ring-4 ring-blue-100"
            : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Archive className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Extra Classes Holding Dock (Staging Area)
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                  {dockedEntries.length} {dockedEntries.length === 1 ? "Class" : "Classes"} Held
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Drag lesson cards from the timetable down here to free up slots. Drag any card from here into any day & period above to assign.
              </p>
            </div>
          </div>

          <button
            id="btn-add-dock-entry"
            onClick={() => setIsAddDockOpen(true)}
            className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 text-slate-600" />
            <span>Add Class to Dock</span>
          </button>
        </div>

        {/* Docked Cards Grid */}
        <div className="mt-4">
          {dockedEntries.length === 0 ? (
            <div
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                isOverDock
                  ? "border-blue-400 bg-blue-100/40 text-blue-800"
                  : "border-slate-200/80 bg-slate-50/50 text-slate-400"
              }`}
            >
              <Archive className={`h-8 w-8 mb-2 ${isOverDock ? "text-blue-600 animate-bounce" : "text-slate-300"}`} />
              <p className="text-xs font-semibold text-slate-700">
                {isOverDock ? "Release to place card in the Holding Dock" : "Holding Dock is currently empty"}
              </p>
              <p className="text-[11px] text-slate-400 max-w-md mt-0.5">
                Drag any lesson from the active grid above and drop it here to temporarily unseat it without losing data.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {dockedEntries.map((entry) => {
                const subject = subjectMap.get(entry.subject_id);
                const staff = staffMap.get(entry.staff_id);

                return (
                  <div
                    key={entry.id}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, entry)}
                    onDragEnd={handleDragEnd}
                    className={`group relative cursor-grab active:cursor-grabbing rounded-xl p-3 border shadow-2xs transition-all hover:scale-[1.02] hover:shadow-md ${
                      draggedEntry?.id === entry.id ? "opacity-40 ring-2 ring-blue-500" : "bg-white"
                    }`}
                    style={{
                      borderLeftWidth: "4px",
                      borderLeftColor: subject?.color || "#2563eb",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider"
                        style={{ backgroundColor: subject?.color || "#2563eb" }}
                      >
                        {subject?.code || "SUB"}
                      </span>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleOpenMove(entry)}
                          title="Assign to slot in timetable"
                          className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                        {onDeleteEntry && (
                          <button
                            onClick={() => onDeleteEntry(entry.id)}
                            title="Remove from dock"
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-1.5 font-bold text-slate-900 text-xs truncate">
                      {subject?.name || "Subject"}
                    </div>

                    <div className="mt-1 flex items-center space-x-1 text-[11px] text-slate-600 truncate">
                      <User className="h-3 w-3 text-slate-400 shrink-0" />
                      <span className="truncate">{staff?.name || "Teacher"}</span>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                      <span className="flex items-center space-x-1 font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        <span>Unassigned / Held</span>
                      </span>
                      <span className="text-slate-400 group-hover:text-blue-600 font-semibold flex items-center space-x-0.5">
                        <Move className="h-2.5 w-2.5" />
                        <span>Drag to grid</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Add Extra Class to Dock Modal */}
      {isAddDockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Archive className="h-4 w-4 text-amber-600" />
                <span>Add Extra Class to Holding Dock</span>
              </h3>
              <button
                onClick={() => setIsAddDockOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Create an unassigned lesson card for <strong>{selectedClass?.name}</strong>. It will be staged in the Holding Dock ready to drag into the timetable grid at any time.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subject
                </label>
                <select
                  value={dockSubjectId}
                  onChange={(e) => setDockSubjectId(parseInt(e.target.value, 10))}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-blue-500 focus:outline-hidden"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} ({sub.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Teacher
                </label>
                <select
                  value={dockStaffId}
                  onChange={(e) => setDockStaffId(parseInt(e.target.value, 10))}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-blue-500 focus:outline-hidden"
                >
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-2">
              <button
                onClick={() => setIsAddDockOpen(false)}
                className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDockEntry}
                className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 shadow-xs cursor-pointer"
              >
                Add to Dock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Move / Swap Slot Modal */}
      {moveModalEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Reassign or Swap Timetable Slot
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Select target Day and Period. If the slot is already occupied, the existing lesson will automatically swap positions with this one.
            </p>

            <div className="mt-4 rounded-xl bg-slate-50 p-3 border border-slate-100 space-y-1 text-xs">
              <div>
                <span className="font-semibold text-slate-700">Subject:</span>{" "}
                {subjectMap.get(moveModalEntry.subject_id)?.name}
              </div>
              <div>
                <span className="font-semibold text-slate-700">Teacher:</span>{" "}
                {staffMap.get(moveModalEntry.staff_id)?.name}
              </div>
              <div>
                <span className="font-semibold text-slate-700">Current Location:</span>{" "}
                {moveModalEntry.is_docked || moveModalEntry.day === "DOCK"
                  ? "Holding Dock (Unassigned)"
                  : `${moveModalEntry.day}, Period ${moveModalEntry.period}`}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Day
                </label>
                <select
                  value={targetDay}
                  onChange={(e) => setTargetDay(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-blue-500 focus:outline-hidden"
                >
                  {timings.active_days.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Period
                </label>
                <select
                  value={targetPeriod}
                  onChange={(e) => setTargetPeriod(parseInt(e.target.value, 10))}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-blue-500 focus:outline-hidden"
                >
                  {Array.from({ length: timings.total_periods }, (_, i) => i + 1).map((p) => (
                    <option key={p} value={p}>
                      Period {p} ({getPeriodTime(p)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {moveError && (
              <div className="mt-4 flex items-start space-x-2 rounded-xl bg-rose-50 p-3 border border-rose-200 text-xs text-rose-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{moveError}</span>
              </div>
            )}

            {moveSuccess && (
              <div className="mt-4 flex items-center space-x-2 rounded-xl bg-emerald-50 p-3 border border-emerald-200 text-xs text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{moveSuccess}</span>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              {!moveModalEntry.is_docked && moveModalEntry.day !== "DOCK" ? (
                <button
                  onClick={() => handleSendToDock(moveModalEntry)}
                  className="inline-flex items-center space-x-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer"
                >
                  <Archive className="h-3.5 w-3.5 text-amber-700" />
                  <span>Send to Dock</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex space-x-2">
                <button
                  onClick={() => setMoveModalEntry(null)}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyMove}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs cursor-pointer"
                >
                  Reassign / Swap
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
