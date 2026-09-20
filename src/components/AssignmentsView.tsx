import React, { useState } from "react";
import { StaffAssignment, SchoolClass, Subject, Staff } from "../types";
import { Plus, Trash2, GitFork, AlertTriangle, Check, X, ShieldCheck } from "lucide-react";

interface AssignmentsViewProps {
  assignments: StaffAssignment[];
  classes: SchoolClass[];
  subjects: Subject[];
  staffList: Staff[];
  timings?: { active_days?: string[]; total_periods?: number };
  onSaveAssignment: (
    asgn: StaffAssignment,
    slot?: { day: string; period: number; toDock?: boolean }
  ) => void;
  onDeleteAssignment: (asgnId: number) => void;
}

export const AssignmentsView: React.FC<AssignmentsViewProps> = ({
  assignments,
  classes,
  subjects,
  staffList,
  timings,
  onSaveAssignment,
  onDeleteAssignment,
}) => {
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [selectedStaffId, setSelectedStaffId] = useState<number>(staffList[0]?.id || 1);
  const [selectedClassId, setSelectedClassId] = useState<number>(classes[0]?.id || 1);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number>(subjects[0]?.id || 1);
  
  // Direct Timetable Placement Inputs
  const [directSchedule, setDirectSchedule] = useState<boolean>(true);
  const activeDays = timings?.active_days && timings.active_days.length > 0
    ? timings.active_days
    : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const totalPeriods = timings?.total_periods || 8;
  const [targetDay, setTargetDay] = useState<string>(activeDays[0] || "Monday");
  const [targetPeriod, setTargetPeriod] = useState<number>(1);
  const [placeInDock, setPlaceInDock] = useState<boolean>(false);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [filterClassId, setFilterClassId] = useState<string>("all");

  const staffMap = new Map(staffList.map((s) => [s.id, s]));
  const classMap = new Map(classes.map((c) => [c.id, c]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const handleAdd = () => {
    setValidationError(null);
    const staff = staffMap.get(selectedStaffId);
    if (!staff) return;

    // Check qualification
    if (!staff.qualified_subject_ids.includes(selectedSubjectId)) {
      const subName = subjectMap.get(selectedSubjectId)?.name || "Subject";
      setValidationError(`${staff.name} is not qualified to teach ${subName}. Select a qualified teacher.`);
      return;
    }

    onSaveAssignment(
      {
        id: Date.now(),
        staff_id: selectedStaffId,
        class_id: selectedClassId,
        subject_id: selectedSubjectId,
      },
      directSchedule
        ? {
            day: placeInDock ? "DOCK" : targetDay,
            period: placeInDock ? 0 : targetPeriod,
            toDock: placeInDock,
          }
        : undefined
    );
    setIsAdding(false);
  };

  const filteredAssignments = filterClassId === "all"
    ? assignments
    : assignments.filter((a) => a.class_id === parseInt(filterClassId, 10));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Staff Assignments (Teacher → Subject → Class)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Explicitly authorize which teacher handles each subject for each standard. The constraint solver guarantees teachers are never double booked.
          </p>
        </div>

        {!isAdding && (
          <button
            id="btn-add-assignment"
            onClick={() => {
              setIsAdding(true);
              setValidationError(null);
            }}
            className="inline-flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>New Assignment</span>
          </button>
        )}
      </div>

      {/* Add Assignment Modal / Form */}
      {isAdding && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-blue-200/60">
            <h3 className="text-sm font-bold text-blue-950">
              Create Staff Assignment
            </h3>
            <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Teacher
              </label>
              <select
                value={selectedStaffId}
                onChange={(e) => {
                  setSelectedStaffId(parseInt(e.target.value, 10));
                  setValidationError(null);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-blue-500 focus:outline-hidden"
              >
                {staffList.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.qualified_subject_ids.map((id) => subjectMap.get(id)?.name).join(", ")})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subject
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => {
                  setSelectedSubjectId(parseInt(e.target.value, 10));
                  setValidationError(null);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-blue-500 focus:outline-hidden"
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
                Class / Standard
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(parseInt(e.target.value, 10));
                  setValidationError(null);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-blue-500 focus:outline-hidden"
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} (Std {cls.grade})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Direct Timetable Slot Placement (Simultaneous Class & Staff Update) */}
          <div className="mt-4 rounded-xl border border-blue-200/80 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="chk-direct-schedule"
                  checked={directSchedule}
                  onChange={(e) => setDirectSchedule(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="chk-direct-schedule" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Direct Timetable Placement (Instantly Populates Class & Staff Timetables)
                </label>
              </div>

              {directSchedule && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="chk-dock"
                    checked={placeInDock}
                    onChange={(e) => setPlaceInDock(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                  />
                  <label htmlFor="chk-dock" className="text-[11px] font-medium text-slate-600 cursor-pointer">
                    Place in Holding Dock instead
                  </label>
                </div>
              )}
            </div>

            {directSchedule && !placeInDock && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Day
                  </label>
                  <select
                    value={targetDay}
                    onChange={(e) => setTargetDay(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-blue-500 focus:outline-hidden"
                  >
                    {activeDays.map((d) => (
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
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-blue-500 focus:outline-hidden"
                  >
                    {Array.from({ length: totalPeriods }, (_, i) => i + 1).map((p) => (
                      <option key={p} value={p}>
                        Period {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {directSchedule && (
              <div className="mt-2 text-[11px] text-blue-700/90 bg-blue-50/80 rounded-lg p-2 flex items-center space-x-1.5">
                <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span>
                  {placeInDock
                    ? "Will be placed in the Extra Classes Holding Dock ready to drag onto the grid at any time."
                    : `Will immediately assign this teacher and subject to ${classMap.get(selectedClassId)?.name || "Selected Class"} on ${targetDay}, Period ${targetPeriod}.`}
                </span>
              </div>
            )}
          </div>

          {validationError && (
            <div className="mt-4 flex items-start space-x-2 rounded-xl bg-rose-50 p-3 border border-rose-200 text-xs text-rose-800">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="mt-5 flex justify-end space-x-2">
            <button
              onClick={() => setIsAdding(false)}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="inline-flex items-center space-x-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Assign Teacher</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center space-x-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <label className="text-xs font-semibold text-slate-600">Filter by Class:</label>
        <select
          value={filterClassId}
          onChange={(e) => setFilterClassId(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs focus:border-blue-500 focus:outline-hidden"
        >
          <option value="all">All Classes ({assignments.length} total assignments)</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id.toString()}>
              Class {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Assignments Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 font-semibold text-slate-700">
              <th className="p-3.5">Teacher</th>
              <th className="p-3.5">Subject</th>
              <th className="p-3.5">Class / Standard</th>
              <th className="p-3.5">Required Periods / Wk</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAssignments.length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-slate-500">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mx-auto mb-3">
                    <GitFork className="h-6 w-6" />
                  </div>
                  <p className="font-bold text-slate-800 text-sm">No Staff Assignments Found</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    {classes.length === 0 || staffList.length === 0 || subjects.length === 0
                      ? "First add your Classes, Subjects, and Teachers, then assign teachers here."
                      : "Click 'New Assignment' above to link a teacher to their designated class standard and subject."}
                  </p>
                </td>
              </tr>
            )}
            {filteredAssignments.map((a) => {
              const staff = staffMap.get(a.staff_id);
              const sub = subjectMap.get(a.subject_id);
              const cls = classMap.get(a.class_id);

              const reqPeriods = cls?.subjects.find((s) => s.subject_id === a.subject_id)?.periods_per_week || "-";

              return (
                <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-3.5 font-bold text-slate-900">
                    <div className="flex items-center space-x-2">
                      <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                        {staff?.name.slice(0, 2) || "T"}
                      </div>
                      <span>{staff?.name || "Unknown"}</span>
                    </div>
                  </td>

                  <td className="p-3.5">
                    {sub && (
                      <span
                        className="inline-flex items-center space-x-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold text-white"
                        style={{ backgroundColor: sub.color }}
                      >
                        <span>{sub.name}</span>
                        <span className="opacity-75 font-mono text-[9px]">({sub.code})</span>
                      </span>
                    )}
                  </td>

                  <td className="p-3.5 font-bold text-slate-800">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700 border border-slate-200">
                      {cls?.name || "Unknown"}
                    </span>
                  </td>

                  <td className="p-3.5 font-semibold text-slate-700">
                    {reqPeriods} periods / week
                  </td>

                  <td className="p-3.5 text-right">
                    <button
                      onClick={() => onDeleteAssignment(a.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      title="Remove Assignment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
