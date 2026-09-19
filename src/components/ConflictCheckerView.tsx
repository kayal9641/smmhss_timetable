import React from "react";
import { ConflictItem } from "../types";
import { AlertOctagon, AlertTriangle, CheckCircle2, ShieldAlert, Wrench } from "lucide-react";

interface ConflictCheckerViewProps {
  conflicts: ConflictItem[];
  onTriggerGenerate: () => void;
}

export const ConflictCheckerView: React.FC<ConflictCheckerViewProps> = ({
  conflicts,
  onTriggerGenerate,
}) => {
  const highConflicts = conflicts.filter((c) => c.severity === "high");
  const mediumConflicts = conflicts.filter((c) => c.severity === "medium");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Schedule Conflict Auditor & Diagnostics
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Continuously monitors timetable integrity, auditing teacher double-booking, class clashes, daily overloads, and availability restrictions.
          </p>
        </div>

        <button
          onClick={onTriggerGenerate}
          className="inline-flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs"
        >
          <Wrench className="h-4 w-4" />
          <span>Resolve via Auto-Generation</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          className={`rounded-2xl border p-5 shadow-xs ${
            conflicts.length === 0
              ? "border-emerald-200 bg-emerald-50/50"
              : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Overall Health</span>
            {conflicts.length === 0 ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-rose-600" />
            )}
          </div>
          <div
            className={`mt-2 text-2xl font-bold ${
              conflicts.length === 0 ? "text-emerald-700" : "text-slate-900"
            }`}
          >
            {conflicts.length === 0 ? "100% Conflict Free" : `${conflicts.length} Violations`}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {conflicts.length === 0
              ? "All hard and soft constraints fully satisfied"
              : "Action required before publishing timetable"}
          </div>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700">Hard Conflicts (Blocking)</span>
            <AlertOctagon className="h-5 w-5 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-900">{highConflicts.length}</div>
          <div className="mt-1 text-xs text-rose-700/80">
            Double bookings, qualification mismatches, unavailable slots
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700">Soft Warnings (Quality)</span>
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-900">{mediumConflicts.length}</div>
          <div className="mt-1 text-xs text-amber-700/80">
            Daily overload, uneven distribution across weekdays
          </div>
        </div>
      </div>

      {/* Zero Conflicts State */}
      {conflicts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-white p-12 text-center shadow-xs">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">
            No Conflicts Detected in Current Timetable
          </h3>
          <p className="mt-1 max-w-md text-xs text-slate-500">
            Every class has its required weekly periods scheduled without double-booking, teachers are within daily limits, and all break/lunch periods remain protected.
          </p>
        </div>
      )}

      {/* Conflict Items List */}
      {conflicts.length > 0 && (
        <div className="space-y-3">
          {conflicts.map((conflict, idx) => {
            const isHigh = conflict.severity === "high";

            return (
              <div
                key={idx}
                className={`rounded-2xl border p-4 shadow-xs transition-colors ${
                  isHigh
                    ? "border-rose-200 bg-rose-50/40 hover:bg-rose-50/70"
                    : "border-amber-200 bg-amber-50/40 hover:bg-amber-50/70"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div
                      className={`mt-0.5 rounded-lg p-1.5 ${
                        isHigh ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {isHigh ? <AlertOctagon className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            isHigh ? "bg-rose-600 text-white" : "bg-amber-600 text-white"
                          }`}
                        >
                          {conflict.severity} severity
                        </span>
                        <span className="font-mono text-xs text-slate-500">
                          {conflict.conflict_type.replace(/_/g, " ").toUpperCase()}
                        </span>
                      </div>

                      <p className="mt-1.5 text-xs font-semibold text-slate-900">
                        {conflict.explanation}
                      </p>

                      {conflict.suggested_fix && (
                        <div className="mt-2 text-xs text-slate-600">
                          <span className="font-semibold text-slate-800">Suggested Resolution:</span>{" "}
                          {conflict.suggested_fix}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-slate-500 shrink-0 pl-3">
                    {conflict.day && <div>{conflict.day}</div>}
                    {conflict.period && <div>Period {conflict.period}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
