import React, { useState } from "react";
import {
  SchoolClass,
  Staff,
  SchoolTimings,
  GenerationRunResult,
} from "../types";
import {
  Play,
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Clock,
  ShieldCheck,
} from "lucide-react";

interface GenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: SchoolClass[];
  staffList: Staff[];
  timings: SchoolTimings;
  onRunGenerate: (scope: "all" | "class" | "staff" | "day", targetId?: number, dayName?: string) => Promise<GenerationRunResult>;
}

export const GenerateModal: React.FC<GenerateModalProps> = ({
  isOpen,
  onClose,
  classes,
  staffList,
  timings,
  onRunGenerate,
}) => {
  const [scope, setScope] = useState<"all" | "class" | "staff" | "day">("all");
  const [targetClassId, setTargetClassId] = useState<number>(classes[0]?.id || 1);
  const [targetStaffId, setTargetStaffId] = useState<number>(staffList[0]?.id || 1);
  const [targetDay, setTargetDay] = useState<string>("Monday");

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<GenerationRunResult | null>(null);

  if (!isOpen) return null;

  const handleStart = async () => {
    setIsRunning(true);
    setLastResult(null);
    try {
      let targetId: number | undefined = undefined;
      let dayName: string | undefined = undefined;

      if (scope === "class") targetId = targetClassId;
      else if (scope === "staff") targetId = targetStaffId;
      else if (scope === "day") dayName = targetDay;

      const result = await onRunGenerate(scope, targetId, dayName);
      setLastResult(result);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Automated Timetable Generation
              </h3>
              <p className="text-xs text-slate-500">
                Deterministic MRV Backtracking Constraint Solver
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scope Selector */}
        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Generation Scope
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: "all", label: "Full School" },
                { id: "class", label: "Single Class" },
                { id: "staff", label: "Single Staff" },
                { id: "day", label: "Specific Day" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setScope(item.id as any)}
                  className={`rounded-xl py-2 px-3 text-xs font-semibold border transition-colors ${
                    scope === item.id
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conditional Scope inputs */}
          {scope === "class" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Class to Regenerate
              </label>
              <select
                value={targetClassId}
                onChange={(e) => setTargetClassId(parseInt(e.target.value, 10))}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-blue-500 focus:outline-hidden"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Grade {c.grade})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                All other classes will remain locked in their current positions.
              </p>
            </div>
          )}

          {scope === "staff" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Staff to Regenerate
              </label>
              <select
                value={targetStaffId}
                onChange={(e) => setTargetStaffId(parseInt(e.target.value, 10))}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-blue-500 focus:outline-hidden"
              >
                {staffList.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {scope === "day" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Day to Regenerate
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
          )}

          {/* Guarantees Box */}
          <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
            <div className="font-semibold text-slate-800 flex items-center space-x-1.5">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              <span>Strict Mathematical Pipeline</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Input → Validate → Generate (MRV) → Validate → Save. The system executes hard constraint checking to guarantee 0 double bookings across both teachers and classes.
            </p>
          </div>

          {/* Result Box */}
          {lastResult && (
            <div
              className={`rounded-xl p-4 border text-xs ${
                lastResult.success
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-rose-200 bg-rose-50 text-rose-900"
              }`}
            >
              <div className="flex items-center space-x-2 font-bold">
                {lastResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                )}
                <span>{lastResult.message}</span>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] font-mono border-t border-slate-200/40 pt-2">
                <div>Scheduled: {lastResult.total_scheduled}</div>
                <div>Execution: {lastResult.execution_time_ms}ms</div>
                <div>Quality Score: {lastResult.soft_score}/100</div>
              </div>

              {lastResult.impossible_reasons && lastResult.impossible_reasons.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="font-semibold">Reason for Failure:</div>
                  {lastResult.impossible_reasons.map((r, i) => (
                    <div key={i} className="text-[11px]">
                      • {r.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-end space-x-2.5 pt-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
          <button
            id="btn-run-solver"
            disabled={isRunning || classes.length === 0 || staffList.length === 0}
            onClick={handleStart}
            className="inline-flex items-center space-x-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isRunning ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Running Constraint Solver...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>Run Solver Now</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
