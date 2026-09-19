import React, { useState } from "react";
import { Staff, SchoolTimings } from "../types";
import { CalendarOff, CheckCircle2, User, Info, Save } from "lucide-react";

interface AvailabilityViewProps {
  staffList: Staff[];
  timings: SchoolTimings;
  onUpdateStaffAvailability: (staffId: number, unavailabilities: { day: string; period: number; reason?: string }[]) => void;
  defaultStaffId?: number;
}

export const AvailabilityView: React.FC<AvailabilityViewProps> = ({
  staffList,
  timings,
  onUpdateStaffAvailability,
  defaultStaffId,
}) => {
  const [selectedStaffId, setSelectedStaffId] = useState<number>(defaultStaffId || staffList[0]?.id || 1);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  const selectedStaff = staffList.find((s) => s.id === selectedStaffId) || staffList[0];
  const [unavailList, setUnavailList] = useState<{ day: string; period: number; reason?: string }[]>(
    selectedStaff?.unavailabilities || []
  );

  // Sync state when staff changes
  React.useEffect(() => {
    if (selectedStaff) {
      setUnavailList(selectedStaff.unavailabilities || []);
    }
  }, [selectedStaffId, staffList]);

  if (staffList.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Teacher Availability & Blackout Slots
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure faculty leaves, non-teaching periods, meetings, and hard constraint blackout times
          </p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4">
            <CalendarOff className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Staff Members to Configure</h3>
          <p className="max-w-md text-sm text-slate-500 mt-1.5">
            Add teachers in the "Staff Members" tab first before configuring their individual period availability and blackout slots.
          </p>
        </div>
      </div>
    );
  }

  const isBlocked = (day: string, period: number): boolean => {
    return unavailList.some((u) => u.day === day && u.period === period);
  };

  const toggleSlot = (day: string, period: number) => {
    setUnavailList((prev) => {
      const exists = prev.some((u) => u.day === day && u.period === period);
      if (exists) {
        return prev.filter((u) => !(u.day === day && u.period === period));
      } else {
        return [...prev, { day, period, reason: "Meeting / Leave" }];
      }
    });
  };

  const handleSave = () => {
    onUpdateStaffAvailability(selectedStaffId, unavailList);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Staff Availability & Leave Matrix
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Mark periods when teachers are unavailable (meetings, administrative duties, part-time off). The constraint solver guarantees no classes are assigned to teachers during these slots.
          </p>
        </div>

        <button
          id="btn-save-availability"
          onClick={handleSave}
          className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs"
        >
          <Save className="h-4 w-4" />
          <span>Save Availability</span>
        </button>
      </div>

      {savedNotice && (
        <div className="flex items-center space-x-2 rounded-xl bg-emerald-50 p-3 border border-emerald-200 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Availability matrix updated for {selectedStaff?.name}!</span>
        </div>
      )}

      {/* Staff Selector */}
      <div className="flex items-center space-x-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Teacher:
        </label>
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          {staffList.map((st) => (
            <button
              key={st.id}
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

      {/* Instruction Tip */}
      <div className="flex items-center space-x-2 rounded-xl bg-slate-50 p-3 border border-slate-200/80 text-xs text-slate-600">
        <Info className="h-4 w-4 text-blue-500 shrink-0" />
        <span>
          Click any cell in the grid to toggle availability. <span className="font-bold text-rose-600">Red</span> cells indicate unavailable periods.
        </span>
      </div>

      {/* Availability Matrix Grid */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90 font-semibold text-slate-700">
              <th className="p-3 w-32 border-r border-slate-200">Period</th>
              {timings.active_days.map((day) => (
                <th key={day} className="p-3 text-center border-r border-slate-200 last:border-r-0 font-bold">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Array.from({ length: timings.total_periods }, (_, i) => i + 1).map((p) => {
              const isBreak = p === 3 || p === 7;
              const isLunch = p === 5;

              if (isBreak || isLunch) {
                return (
                  <tr key={`inter-${p}`} className="bg-slate-50/50 text-slate-400 text-center">
                    <td className="p-2 border-r border-slate-200 text-left font-medium">
                      {isLunch ? "Lunch (12:20)" : p === 3 ? "Break 1" : "Break 2"}
                    </td>
                    <td colSpan={timings.active_days.length} className="p-2 text-[10px] uppercase tracking-wider">
                      {isLunch ? "Lunch Interval" : "Short Break"}
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={`p-${p}`} className="hover:bg-slate-50/30">
                  <td className="p-3 font-semibold text-slate-800 border-r border-slate-200 bg-slate-50/40">
                    Period {p}
                  </td>
                  {timings.active_days.map((day) => {
                    const blocked = isBlocked(day, p);
                    return (
                      <td
                        key={`${day}-${p}`}
                        onClick={() => toggleSlot(day, p)}
                        className={`p-3 text-center border-r border-slate-200 last:border-r-0 cursor-pointer transition-colors ${
                          blocked
                            ? "bg-rose-50 hover:bg-rose-100/80 text-rose-700 font-bold"
                            : "bg-emerald-50/30 hover:bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {blocked ? (
                          <div className="flex items-center justify-center space-x-1">
                            <CalendarOff className="h-3.5 w-3.5 text-rose-500" />
                            <span className="text-[11px]">UNAVAILABLE</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center space-x-1 text-slate-400">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-[11px] text-emerald-700 font-medium">Available</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
