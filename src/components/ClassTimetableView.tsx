import React, { useState } from "react";
import {
  SchoolClass,
  Staff,
  Subject,
  TimetableEntry,
  SchoolTimings,
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
} from "lucide-react";
import { TimetableExporter } from "../services/exporter";

interface ClassTimetableViewProps {
  classes: SchoolClass[];
  staffList: Staff[];
  subjects: Subject[];
  entries: TimetableEntry[];
  timings: SchoolTimings;
  onMoveEntry: (entryId: number, newDay: string, newPeriod: number) => { success: boolean; error?: string };
  onRegenerateClass: (classId: number) => void;
}

export const ClassTimetableView: React.FC<ClassTimetableViewProps> = ({
  classes,
  staffList,
  subjects,
  entries,
  timings,
  onMoveEntry,
  onRegenerateClass,
}) => {
  const [selectedClassId, setSelectedClassId] = useState<number>(classes[0]?.id || 1);
  const [moveModalEntry, setMoveModalEntry] = useState<TimetableEntry | null>(null);
  const [targetDay, setTargetDay] = useState<string>("Monday");
  const [targetPeriod, setTargetPeriod] = useState<number>(1);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moveSuccess, setMoveSuccess] = useState<string | null>(null);

  // PDF Export States
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isExportingAllPdf, setIsExportingAllPdf] = useState<boolean>(false);
  const [pdfProgressText, setPdfProgressText] = useState<string | null>(null);
  const [pdfToast, setPdfToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const selectedClass = classes.find((c) => c.id === selectedClassId) || classes[0];
  const staffMap = new Map(staffList.map((s) => [s.id, s]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

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

  // Export current class timetable as PDF using jsPDF + html2canvas
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

  // Get period times
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

  const handleOpenMove = (entry: TimetableEntry) => {
    setMoveModalEntry(entry);
    setTargetDay(entry.day);
    setTargetPeriod(entry.period);
    setMoveError(null);
    setMoveSuccess(null);
  };

  const handleApplyMove = () => {
    if (!moveModalEntry) return;
    const result = onMoveEntry(moveModalEntry.id, targetDay, targetPeriod);
    if (!result.success) {
      setMoveError(result.error || "Cannot move to this slot due to conflict.");
      setMoveSuccess(null);
    } else {
      setMoveSuccess("Successfully moved without conflict!");
      setMoveError(null);
      setTimeout(() => setMoveModalEntry(null), 1000);
    }
  };

  return (
    <div className="space-y-5">
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
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
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
            className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs"
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
            className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs"
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
            className="inline-flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
            className="inline-flex items-center space-x-1.5 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100/70 disabled:opacity-50 shadow-xs transition-colors"
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
            className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs"
            title="Quick browser print"
          >
            <Printer className="h-3.5 w-3.5 text-slate-500" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* PDF Export Feedback Toast Banner */}
      {pdfToast && (
        <div
          className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-xs font-medium border shadow-xs transition-all ${
            pdfToast.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center space-x-2">
            {pdfToast.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{pdfToast.message}</span>
          </div>
          <button
            onClick={() => setPdfToast(null)}
            className="text-slate-400 hover:text-slate-600 ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Class Details Banner */}
      <div className="flex items-center justify-between rounded-xl bg-blue-50/60 border border-blue-100 px-4 py-3">
        <div className="flex items-center space-x-3">
          <span className="text-sm font-bold text-blue-900">
            Standard: {selectedClass?.name}
          </span>
          <span className="text-xs text-blue-700">
            Room: {selectedClass?.room_number || "Not specified"}
          </span>
          <span className="text-xs text-blue-700">
            Grade: {selectedClass?.grade} (Section {selectedClass?.section})
          </span>
        </div>
        <div className="text-xs text-blue-800 font-medium">
          Click any lesson card to move or reassign slot
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
                    const entry = entries.find(
                      (e) => e.class_id === selectedClassId && e.day === day && e.period === p
                    );
                    const subject = entry ? subjectMap.get(entry.subject_id) : null;
                    const staff = entry ? staffMap.get(entry.staff_id) : null;

                    return (
                      <td
                        key={`${day}-${p}`}
                        className="p-2 border-r border-slate-200 last:border-r-0 align-top min-w-[140px]"
                      >
                        {entry && subject ? (
                          <div
                            onClick={() => handleOpenMove(entry)}
                            className="group relative cursor-pointer rounded-xl p-2.5 border shadow-2xs transition-all hover:scale-[1.02] hover:shadow-xs"
                            style={{
                              backgroundColor: `${subject.color}10`,
                              borderColor: `${subject.color}40`,
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className="inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider"
                                style={{ backgroundColor: subject.color }}
                              >
                                {subject.code}
                              </span>
                              <Move className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>

                            <div className="mt-1 font-bold text-slate-900 text-xs truncate">
                              {subject.name}
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
                          </div>
                        ) : (
                          <div className="h-16 flex items-center justify-center rounded-lg border border-dashed border-slate-200 text-[11px] text-slate-300">
                            Open
                          </div>
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

      {/* Manual Move Modal with Instant Real-Time Validation */}
      {moveModalEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Move Lesson Slot
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Select target Day and Period. The conflict checker automatically validates teacher and class availability before committing.
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
                <span className="font-semibold text-slate-700">Current Slot:</span>{" "}
                {moveModalEntry.day}, Period {moveModalEntry.period}
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
                  {Array.from({ length: timings.total_periods }, (_, i) => i + 1)
                    .filter((p) => p !== 3 && p !== 5 && p !== 7)
                    .map((p) => (
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

            <div className="mt-6 flex justify-end space-x-2">
              <button
                onClick={() => setMoveModalEntry(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyMove}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs"
              >
                Validate & Move
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
