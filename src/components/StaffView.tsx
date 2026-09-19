import React, { useState } from "react";
import { Staff, Subject, SchoolClass } from "../types";
import { Plus, Edit2, Trash2, Check, X, UserCheck, ShieldCheck, Mail, CalendarOff, Users } from "lucide-react";

interface StaffViewProps {
  staffList: Staff[];
  subjects: Subject[];
  classes: SchoolClass[];
  onSaveStaff: (staff: Staff) => void;
  onDeleteStaff: (staffId: number) => void;
  onNavigateToAvailability: (staffId: number) => void;
}

export const StaffView: React.FC<StaffViewProps> = ({
  staffList,
  subjects,
  classes,
  onSaveStaff,
  onDeleteStaff,
  onNavigateToAvailability,
}) => {
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const [name, setName] = useState<string>("");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [maxDay, setMaxDay] = useState<number>(6);
  const [maxWeek, setMaxWeek] = useState<number>(26);
  const [qualifiedSubjectIds, setQualifiedSubjectIds] = useState<number[]>([]);
  const [assignedClassIds, setAssignedClassIds] = useState<number[]>([]);

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const classMap = new Map(classes.map((c) => [c.id, c]));

  const startCreate = () => {
    setIsCreating(true);
    setEditingStaff(null);
    setName("");
    setEmployeeId(`EMP00${staffList.length + 1}`);
    setEmail("");
    setPhone("");
    setMaxDay(6);
    setMaxWeek(26);
    setQualifiedSubjectIds([subjects[0]?.id || 1]);
    setAssignedClassIds([classes[0]?.id || 1]);
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
    setAssignedClassIds([...st.assigned_class_ids]);
  };

  const toggleSubjectQual = (subId: number) => {
    setQualifiedSubjectIds((prev) =>
      prev.includes(subId) ? prev.filter((id) => id !== subId) : [...prev, subId]
    );
  };

  const toggleAssignedClass = (classId: number) => {
    setAssignedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const newStaff: Staff = {
      id: editingStaff ? editingStaff.id : Date.now(),
      name: name.trim(),
      employee_id: employeeId.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      max_periods_per_day: maxDay,
      max_periods_per_week: maxWeek,
      qualified_subject_ids: qualifiedSubjectIds,
      assigned_class_ids: assignedClassIds,
      unavailabilities: editingStaff ? editingStaff.unavailabilities : [],
    };
    onSaveStaff(newStaff);
    setEditingStaff(null);
    setIsCreating(false);
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
            Manage teacher qualifications, maximum teaching limits, class authorizations, and availability.
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
            <h3 className="text-sm font-bold text-emerald-950">
              {editingStaff ? `Edit Staff: ${editingStaff.name}` : "Add New Staff Member"}
            </h3>
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
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mr. Kumar"
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
                placeholder="e.g. kumar@school.edu"
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
                placeholder="e.g. +1 555-0100"
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
                max="8"
                value={maxDay}
                onChange={(e) => setMaxDay(parseInt(e.target.value, 10) || 6)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Prevents teacher exhaustion across 8 periods
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Max Periods Per Week
              </label>
              <input
                type="number"
                min="1"
                max="40"
                value={maxWeek}
                onChange={(e) => setMaxWeek(parseInt(e.target.value, 10) || 26)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Hard ceiling for total weekly assigned teaching periods
              </span>
            </div>
          </div>

          {/* Qualified Subjects Multi-Select */}
          <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Qualified Subjects (Teacher can only be assigned to these)
            </label>
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

          {/* Assigned Classes */}
          <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Eligible Classes
            </label>
            <div className="flex flex-wrap gap-2">
              {classes.map((c) => {
                const selected = assignedClassIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleAssignedClass(c.id)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition-colors ${
                      selected
                        ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 flex justify-end space-x-2">
            <button
              onClick={() => {
                setEditingStaff(null);
                setIsCreating(false);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Save Staff</span>
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
        {staffList.map((st) => (
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
                  title="Edit Staff"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onDeleteStaff(st.id)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
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
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sub.color }} />
                      <span>{sub.name}</span>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Unavailability Count & Action */}
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
              <div className="flex items-center space-x-1 text-slate-500">
                <CalendarOff className="h-3.5 w-3.5 text-slate-400" />
                <span>{(st.unavailabilities || []).length} blocked periods</span>
              </div>
              <button
                onClick={() => onNavigateToAvailability(st.id)}
                className="font-semibold text-emerald-600 hover:text-emerald-700 text-xs"
              >
                Manage Schedule →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
