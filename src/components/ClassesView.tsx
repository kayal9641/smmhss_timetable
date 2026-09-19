import React, { useState } from "react";
import { SchoolClass, Subject } from "../types";
import { Plus, Edit2, Trash2, Check, X, BookOpen, GraduationCap } from "lucide-react";

interface ClassesViewProps {
  classes: SchoolClass[];
  subjects: Subject[];
  onSaveClass: (cls: SchoolClass) => void;
  onDeleteClass: (classId: number) => void;
}

export const ClassesView: React.FC<ClassesViewProps> = ({
  classes,
  subjects,
  onSaveClass,
  onDeleteClass,
}) => {
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const [formName, setFormName] = useState<string>("");
  const [formGrade, setFormGrade] = useState<string>("");
  const [formSection, setFormSection] = useState<string>("");
  const [formRoom, setFormRoom] = useState<string>("");
  const [formSubjects, setFormSubjects] = useState<{ subject_id: number; periods_per_week: number }[]>([]);

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const startCreate = () => {
    setIsCreating(true);
    setEditingClass(null);
    setFormName("");
    setFormGrade("8");
    setFormSection("A");
    setFormRoom("");
    // Default subject list
    setFormSubjects(
      subjects.slice(0, 6).map((s) => ({
        subject_id: s.id,
        periods_per_week: s.default_periods_per_week || 4,
      }))
    );
  };

  const startEdit = (cls: SchoolClass) => {
    setEditingClass(cls);
    setIsCreating(false);
    setFormName(cls.name);
    setFormGrade(cls.grade);
    setFormSection(cls.section);
    setFormRoom(cls.room_number || "");
    setFormSubjects([...cls.subjects]);
  };

  const handlePeriodChange = (subjectId: number, periods: number) => {
    setFormSubjects((prev) => {
      const idx = prev.findIndex((p) => p.subject_id === subjectId);
      if (periods <= 0) {
        return prev.filter((p) => p.subject_id !== subjectId);
      }
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { subject_id: subjectId, periods_per_week: periods };
        return next;
      } else {
        return [...prev, { subject_id: subjectId, periods_per_week: periods }];
      }
    });
  };

  const handleSave = () => {
    const finalName = formName.trim() || `${formGrade}-${formSection}`;
    const newClass: SchoolClass = {
      id: editingClass ? editingClass.id : Date.now(),
      name: finalName,
      grade: formGrade.trim() || "8",
      section: formSection.trim() || "A",
      room_number: formRoom.trim() || undefined,
      subjects: formSubjects.filter((s) => s.periods_per_week > 0),
    };
    onSaveClass(newClass);
    setEditingClass(null);
    setIsCreating(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Class Management & Subject Requirements
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure classes, sections, rooms, and customized weekly subject period quotas for each standard.
          </p>
        </div>
        {!isCreating && !editingClass && (
          <button
            id="btn-add-class"
            onClick={startCreate}
            className="inline-flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Add Class</span>
          </button>
        )}
      </div>

      {/* Editor Modal / Panel */}
      {(isCreating || editingClass) && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-blue-200/60">
            <h3 className="text-sm font-bold text-blue-950">
              {editingClass ? `Edit Class: ${editingClass.name}` : "Create New Class"}
            </h3>
            <button
              onClick={() => {
                setEditingClass(null);
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
                Class Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. 8-A"
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Grade / Standard
              </label>
              <input
                type="text"
                value={formGrade}
                onChange={(e) => setFormGrade(e.target.value)}
                placeholder="e.g. 8"
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Section
              </label>
              <input
                type="text"
                value={formSection}
                onChange={(e) => setFormSection(e.target.value)}
                placeholder="e.g. A"
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Room Number
              </label>
              <input
                type="text"
                value={formRoom}
                onChange={(e) => setFormRoom(e.target.value)}
                placeholder="e.g. Room 101"
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Subject allocations */}
          <div className="mt-5">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Weekly Subject Periods Required for this Class
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {subjects.map((s) => {
                const current = formSubjects.find((fs) => fs.subject_id === s.id)?.periods_per_week || 0;
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs"
                  >
                    <div className="flex items-center space-x-2">
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="text-xs font-medium text-slate-800 truncate">
                        {s.name}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={current}
                        onChange={(e) => handlePeriodChange(s.id, parseInt(e.target.value, 10) || 0)}
                        className="w-14 rounded-md border border-slate-300 p-1 text-center text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-hidden"
                      />
                      <span className="text-[10px] text-slate-400">/wk</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 flex justify-end space-x-2">
            <button
              onClick={() => {
                setEditingClass(null);
                setIsCreating(false);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center space-x-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Save Class</span>
            </button>
          </div>
        </div>
      )}

      {/* Classes Grid */}
      {classes.length === 0 && !isCreating && !editingClass && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-4">
            <GraduationCap className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Classes Configured</h3>
          <p className="max-w-md text-sm text-slate-500 mt-1.5 mb-5">
            Start by adding the classes, standards, and sections for your school (e.g., Grade/Standard 8, Section A).
          </p>
          <button
            onClick={startCreate}
            className="inline-flex items-center space-x-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Add First Class</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map((c) => {
          const totalPeriods = c.subjects.reduce((sum, s) => sum + s.periods_per_week, 0);

          return (
            <div
              key={c.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{c.name}</h3>
                    <p className="text-xs text-slate-500">
                      Standard {c.grade} • Section {c.section}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => startEdit(c)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    title="Edit Class"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteClass(c.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    title="Delete Class"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3">
                <span>Room: {c.room_number || "Default"}</span>
                <span className="font-semibold text-blue-700">{totalPeriods} Periods / Week</span>
              </div>

              {/* Subject Badges */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.subjects.map((subReq) => {
                  const s = subjectMap.get(subReq.subject_id);
                  if (!s) return null;
                  return (
                    <span
                      key={s.id}
                      className="inline-flex items-center space-x-1 rounded-md px-2 py-0.5 text-[10px] font-semibold text-slate-700 bg-slate-50 border border-slate-200/80"
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                      <span>{s.name}:</span>
                      <span className="font-bold text-slate-900">{subReq.periods_per_week}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
