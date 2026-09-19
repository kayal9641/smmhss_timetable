import React, { useState } from "react";
import { SchoolTimings } from "../types";
import { Clock, Coffee, Utensils, AlertTriangle, CheckCircle2, Save, Calendar } from "lucide-react";

interface TimingsViewProps {
  timings: SchoolTimings;
  onSaveTimings: (newTimings: SchoolTimings) => void;
}

export const TimingsView: React.FC<TimingsViewProps> = ({ timings, onSaveTimings }) => {
  const [schoolName, setSchoolName] = useState<string>(timings.school_name);
  const [academicYear, setAcademicYear] = useState<string>(timings.academic_year);
  const [startTime, setStartTime] = useState<string>(timings.start_time);
  const [endTime, setEndTime] = useState<string>(timings.end_time);
  const [periodDuration, setPeriodDuration] = useState<number>(timings.period_duration_minutes);
  const [totalPeriods, setTotalPeriods] = useState<number>(timings.total_periods);
  const [lunchStart, setLunchStart] = useState<string>(timings.lunch_start);
  const [lunchEnd, setLunchEnd] = useState<string>(timings.lunch_end);
  const [break1Start, setBreak1Start] = useState<string>(timings.break1_start);
  const [break1End, setBreak1End] = useState<string>(timings.break1_end);
  const [break2Start, setBreak2Start] = useState<string>(timings.break2_start);
  const [break2End, setBreak2End] = useState<string>(timings.break2_end);
  const [activeDays, setActiveDays] = useState<string[]>([...timings.active_days]);

  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  const allPossibleDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const toggleDay = (day: string) => {
    setActiveDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // Time calculations
  const toMinutes = (timeStr: string): number => {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  };

  const toTimeStr = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };

  const startMin = toMinutes(startTime);
  const endMin = toMinutes(endTime);

  // Compute live breakdown
  const timeline: { label: string; start: string; end: string; duration: number; type: string }[] = [];
  let curr = startMin;
  const warnings: string[] = [];

  for (let p = 1; p <= totalPeriods; p++) {
    if (p === 3) {
      const b1S = toMinutes(break1Start);
      const b1E = toMinutes(break1End);
      timeline.push({
        label: "Morning Break",
        start: break1Start,
        end: break1End,
        duration: b1E - b1S,
        type: "break",
      });
      curr = Math.max(curr, b1E);
    }

    if (p === 5) {
      const lS = toMinutes(lunchStart);
      const lE = toMinutes(lunchEnd);
      timeline.push({
        label: "Lunch Break",
        start: lunchStart,
        end: lunchEnd,
        duration: lE - lS,
        type: "lunch",
      });
      curr = Math.max(curr, lE);
    }

    if (p === 7) {
      const b2S = toMinutes(break2Start);
      const b2E = toMinutes(break2End);
      timeline.push({
        label: "Afternoon Break",
        start: break2Start,
        end: break2End,
        duration: b2E - b2S,
        type: "break",
      });
      curr = Math.max(curr, b2E);
    }

    const pStart = curr;
    const pEnd = pStart + periodDuration;
    timeline.push({
      label: `Period ${p}`,
      start: toTimeStr(pStart),
      end: toTimeStr(pEnd),
      duration: periodDuration,
      type: "period",
    });
    curr = pEnd;
  }

  if (curr > endMin) {
    const diff = curr - endMin;
    warnings.push(
      `Configured schedule concludes at ${toTimeStr(curr)}, exceeding the official school end time of ${endTime} by ${diff} minutes.`
    );
  }

  const handleSave = () => {
    const updated: SchoolTimings = {
      school_name: schoolName.trim() || "Sri Mahalakshmi Higher Secondary School",
      academic_year: academicYear.trim() || "2025-2026",
      start_time: startTime || "09:10",
      end_time: endTime || "16:00",
      period_duration_minutes: periodDuration || 40,
      total_periods: totalPeriods || 8,
      lunch_start: lunchStart || "12:20",
      lunch_end: lunchEnd || "13:00",
      break1_start: break1Start || "10:50",
      break1_end: break1End || "11:00",
      break2_start: break2Start || "14:50",
      break2_end: break2End || "15:00",
      active_days: activeDays.length > 0 ? activeDays : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    };
    onSaveTimings(updated);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            School Timings & Schedule Architecture
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure school hours, period durations, lunch breaks, and active weekdays with real-time overlap validation.
          </p>
        </div>

        <button
          id="btn-save-timings"
          onClick={handleSave}
          className="inline-flex items-center space-x-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs"
        >
          <Save className="h-4 w-4" />
          <span>Save Settings</span>
        </button>
      </div>

      {savedNotice && (
        <div className="flex items-center space-x-2 rounded-xl bg-emerald-50 p-3 border border-emerald-200 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>School timing configuration saved successfully!</span>
        </div>
      )}

      {/* Warnings Banner */}
      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-1">
          <div className="flex items-center space-x-1.5 font-bold text-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>Schedule Boundary Warning</span>
          </div>
          {warnings.map((w, idx) => (
            <p key={idx}>{w}</p>
          ))}
        </div>
      )}

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Form Controls */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            General Timings & Hours
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                School Name
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Academic Year
              </label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                School Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                School End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Period Duration (Minutes)
              </label>
              <input
                type="number"
                min="30"
                max="60"
                value={periodDuration}
                onChange={(e) => setPeriodDuration(parseInt(e.target.value, 10) || 40)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Total Periods / Day
              </label>
              <input
                type="number"
                min="4"
                max="10"
                value={totalPeriods}
                onChange={(e) => setTotalPeriods(parseInt(e.target.value, 10) || 8)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 pt-2">
            Breaks and Lunch Schedule
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Morning Break (After P2)
              </label>
              <div className="flex items-center space-x-1">
                <input
                  type="time"
                  value={break1Start}
                  onChange={(e) => setBreak1Start(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-1.5 text-xs"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="time"
                  value={break1End}
                  onChange={(e) => setBreak1End(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-1.5 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lunch Break (After P4)
              </label>
              <div className="flex items-center space-x-1">
                <input
                  type="time"
                  value={lunchStart}
                  onChange={(e) => setLunchStart(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-1.5 text-xs"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="time"
                  value={lunchEnd}
                  onChange={(e) => setLunchEnd(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-1.5 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Afternoon Break (After P6)
              </label>
              <div className="flex items-center space-x-1">
                <input
                  type="time"
                  value={break2Start}
                  onChange={(e) => setBreak2Start(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-1.5 text-xs"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="time"
                  value={break2End}
                  onChange={(e) => setBreak2End(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-1.5 text-xs"
                />
              </div>
            </div>
          </div>

          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 pt-2">
            Active School Days
          </h3>

          <div className="flex flex-wrap gap-2">
            {allPossibleDays.map((day) => {
              const active = activeDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                    active
                      ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {day} {active ? "✓" : ""}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Calculated Visual Daily Timeline */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
              <Clock className="h-4 w-4 text-blue-600" />
              <span>Calculated Daily Schedule Timeline</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              {toMinutes(endTime) - toMinutes(startTime)} mins total span
            </span>
          </div>

          <div className="mt-4 divide-y divide-slate-100 max-h-[480px] overflow-y-auto pr-1">
            {timeline.map((item, idx) => (
              <div
                key={idx}
                className={`py-2.5 px-3 rounded-xl flex items-center justify-between my-1 text-xs ${
                  item.type === "break"
                    ? "bg-amber-50 text-amber-900 font-semibold border border-amber-200/80"
                    : item.type === "lunch"
                    ? "bg-orange-50 text-orange-900 font-bold border border-orange-200"
                    : "hover:bg-slate-50 text-slate-800"
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  {item.type === "break" && <Coffee className="h-4 w-4 text-amber-600" />}
                  {item.type === "lunch" && <Utensils className="h-4 w-4 text-orange-600" />}
                  {item.type === "period" && (
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                  )}
                  <span className="font-semibold">{item.label}</span>
                </div>

                <div className="flex items-center space-x-3 text-right">
                  <span className="font-mono text-slate-600 text-[11px]">
                    {item.start} - {item.end}
                  </span>
                  <span className="text-[10px] text-slate-400 w-12">
                    {item.duration}m
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
