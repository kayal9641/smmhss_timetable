import React, { useState } from "react";
import {
  Staff,
  SchoolClass,
  Subject,
  TimetableEntry,
  SchoolTimings,
} from "../types";
import {
  Download,
  Printer,
  User,
  Coffee,
  Utensils,
  CheckCircle,
  CalendarOff,
  FileText,
  Layers,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
} from "lucide-react";
import { TimetableExporter } from "../services/exporter";

interface StaffTimetableViewProps {
  staffList: Staff[];
  classes: SchoolClass[];
  subjects: Subject[];
  entries: TimetableEntry[];
  timings: SchoolTimings;
}

export const StaffTimetableView: React.FC<StaffTimetableViewProps> = ({
  staffList,
  classes,
  subjects,
  entries,
  timings,
}) => {
  const [selectedStaffId, setSelectedStaffId] = useState<number>(staffList[0]?.id || 1);

  // PDF Export States
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isExportingAllPdf, setIsExportingAllPdf] = useState<boolean>(false);
  const [pdfProgressText, setPdfProgressText] = useState<string | null>(null);
  const [pdfToast, setPdfToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const selectedStaff = staffList.find((s) => s.id === selectedStaffId) || staffList[0];
  const classMap = new Map(classes.map((c) => [c.id, c]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  if (staffList.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Staff Timetable View
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Faculty weekly period schedule, workload analysis, free period detection, and PDF document printing
          </p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-4">
            <UserCheck className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Staff Members Added Yet</h3>
          <p className="max-w-md text-sm text-slate-500 mt-1.5">
            The application is starting with an empty database. Please navigate to the "Staff Members" tab to add your teachers and faculty members.
          </p>
        </div>
      </div>
    );
  }

  // Export current staff timetable as PDF using jsPDF + html2canvas
  const handleExportStaffPdf = async () => {
    if (!selectedStaff || isExportingPdf) return;
    setIsExportingPdf(true);
    setPdfToast(null);
    try {
      await TimetableExporter.exportStaffPDF(
        selectedStaff.id,
        entries,
        classes,
        staffList,
        subjects,
        timings
      );
      setPdfToast({
        message: `✓ Successfully generated PDF for ${selectedStaff.name} with ${timings.school_name} and ${timings.academic_year} headers!`,
        type: "success",
      });
      setTimeout(() => setPdfToast(null), 5000);
    } catch (err: any) {
      console.error("Staff PDF generation failed:", err);
      setPdfToast({
        message: `Failed to generate PDF: ${err?.message || "Unknown error"}`,
        type: "error",
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Export all staff timetables in a combined multi-page PDF document
  const handleExportAllStaffPdf = async () => {
    if (isExportingAllPdf) return;
    setIsExportingAllPdf(true);
    setPdfProgressText(`Exporting 1 / ${staffList.length}...`);
    try {
      await TimetableExporter.exportAllStaffPDF(
        staffList,
        entries,
        classes,
        subjects,
        timings,
        (current, total) => {
          setPdfProgressText(`Generating page ${current} of ${total}...`);
        }
      );
      setPdfToast({
        message: `✓ Successfully generated multi-page PDF for all ${staffList.length} faculty members!`,
        type: "success",
      });
      setTimeout(() => setPdfToast(null), 5000);
    } catch (err: any) {
      console.error("All staff PDF generation failed:", err);
      setPdfToast({
        message: `Failed to generate All Staff PDF: ${err?.message || "Unknown error"}`,
        type: "error",
      });
    } finally {
      setIsExportingAllPdf(false);
      setPdfProgressText(null);
    }
  };

  // Teaching entries for this staff member
  const staffEntries = entries.filter((e) => e.staff_id === selectedStaffId);
  const totalAssigned = staffEntries.length;

  const usablePeriodsPerDay = timings.total_periods;
  const totalSlotsWeek = timings.active_days.length * usablePeriodsPerDay;
  const freePeriodsCount = Math.max(0, totalSlotsWeek - totalAssigned);

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

  const isUnavailable = (day: string, period: number): boolean => {
    return (selectedStaff?.unavailabilities || []).some(
      (u) => u.day === day && u.period === period
    );
  };

  return (
    <div className="space-y-5">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center space-x-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Select Staff:
          </label>
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
            {staffList.map((st) => (
              <button
                key={st.id}
                id={`btn-select-staff-${st.id}`}
                onClick={() => setSelectedStaffId(st.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selectedStaffId === st.id
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {st.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-export-staff-csv"
            onClick={() =>
              TimetableExporter.exportStaffCSV(
                selectedStaffId,
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
            id="btn-print-staff-pdf"
            onClick={handleExportStaffPdf}
            disabled={isExportingPdf}
            className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-colors"
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

          {/* Multi-page All Staff PDF export */}
          <button
            id="btn-export-all-staff-pdf"
            onClick={handleExportAllStaffPdf}
            disabled={isExportingAllPdf}
            className="inline-flex items-center space-x-1.5 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100/70 disabled:opacity-50 shadow-xs transition-colors"
            title="Export all staff schedules in a single multi-page PDF document"
          >
            {isExportingAllPdf ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                <span>{pdfProgressText || "Exporting All..."}</span>
              </>
            ) : (
              <>
                <Layers className="h-3.5 w-3.5 text-emerald-600" />
                <span>All Faculty (PDF)</span>
              </>
            )}
          </button>

          <button
            id="btn-print-staff"
            onClick={() =>
              TimetableExporter.printSchedule(
                `Staff Timetable - ${selectedStaff?.name}`,
                "staff-timetable-grid"
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

      {/* Staff Stats Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500">Staff Member</div>
          <div className="mt-1 text-sm font-bold text-slate-900 flex items-center space-x-1.5">
            <User className="h-4 w-4 text-emerald-600" />
            <span>{selectedStaff?.name}</span>
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">
            ID: {selectedStaff?.employee_id || "N/A"}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500">Weekly Workload</div>
          <div className="mt-1 text-sm font-bold text-slate-900">
            {totalAssigned} / {selectedStaff?.max_periods_per_week} Periods
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">
            Max {selectedStaff?.max_periods_per_day} periods / day
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 shadow-xs">
          <div className="text-[11px] font-medium text-emerald-700">Free Periods</div>
          <div className="mt-1 text-sm font-bold text-emerald-900 flex items-center space-x-1">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <span>{freePeriodsCount} Periods / Week</span>
          </div>
          <div className="mt-0.5 text-[10px] text-emerald-600">Available for preparation</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500">Qualifications</div>
          <div className="mt-1 text-xs font-semibold text-slate-800 truncate">
            {selectedStaff?.qualified_subject_ids
              .map((id) => subjectMap.get(id)?.name)
              .filter(Boolean)
              .join(", ") || "None"}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">
            Assigned: {selectedStaff?.assigned_class_ids.map((id) => classMap.get(id)?.name).join(", ")}
          </div>
        </div>
      </div>

      {/* Main Staff Grid with Prominent FREE Indicators */}
      <div
        id="staff-timetable-grid"
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
                <React.Fragment key={`staff-period-fragment-${p}`}>
                  {p === 3 && (
                    <tr key="break-1" className="bg-amber-50/70 border-y border-amber-200/80">
                      <td className="p-2.5 font-semibold text-amber-900 border-r border-amber-200/80 flex items-center space-x-1.5">
                        <Coffee className="h-3.5 w-3.5 text-amber-600" />
                        <span>10:30 - 10:45</span>
                      </td>
                      <td
                        colSpan={timings.active_days.length}
                        className="p-2 text-center font-medium text-amber-800 uppercase text-[11px]"
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
                        className="p-2 text-center font-medium text-orange-800 uppercase text-[11px]"
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
                        className="p-2 text-center font-medium text-amber-800 uppercase text-[11px]"
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
                      (e) => e.staff_id === selectedStaffId && e.day === day && e.period === p
                    );
                    const subject = entry ? subjectMap.get(entry.subject_id) : null;
                    const cls = entry ? classMap.get(entry.class_id) : null;
                    const unavail = isUnavailable(day, p);

                    return (
                      <td
                        key={`${day}-${p}`}
                        className="p-2 border-r border-slate-200 last:border-r-0 align-top min-w-[140px]"
                      >
                        {entry && subject && cls ? (
                          <div
                            className="rounded-xl p-2.5 border shadow-2xs"
                            style={{
                              backgroundColor: `${subject.color}15`,
                              borderColor: `${subject.color}50`,
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className="inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider"
                                style={{ backgroundColor: subject.color }}
                              >
                                {cls.name}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {entry.room_number || cls.room_number || ""}
                              </span>
                            </div>

                            <div className="mt-1 font-bold text-slate-900 text-xs truncate">
                              {subject.name}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Teaching Standard {cls.grade}
                            </div>
                          </div>
                        ) : unavail ? (
                          <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-100/80 border border-slate-200 text-slate-500 text-center">
                            <CalendarOff className="h-3.5 w-3.5 text-slate-400 mb-0.5" />
                            <span className="font-bold text-[10px] uppercase tracking-wider text-slate-600">
                              Unavailable
                            </span>
                            <span className="text-[9px] text-slate-400">Leave / Meeting</span>
                          </div>
                        ) : (
                          // REQUIREMENT 13: "Display clear indicators for FREE periods"
                          <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-emerald-200/80 bg-emerald-50/50 text-emerald-700 text-center transition-colors hover:bg-emerald-50">
                            <span className="font-black text-xs tracking-wider uppercase text-emerald-700">
                              FREE
                            </span>
                            <span className="text-[10px] text-emerald-600/80 mt-0.5">
                              No Class Assigned
                            </span>
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
    </div>
  );
};
