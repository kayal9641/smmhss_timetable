import React, { useState } from "react";
import { Subject } from "../types";
import { Plus, Edit2, Trash2, Check, X, BookOpen, Palette } from "lucide-react";

interface SubjectsViewProps {
  subjects: Subject[];
  onSaveSubject: (sub: Subject) => void;
  onDeleteSubject: (subjectId: number) => void;
}

export const SubjectsView: React.FC<SubjectsViewProps> = ({
  subjects,
  onSaveSubject,
  onDeleteSubject,
}) => {
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const [name, setName] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [color, setColor] = useState<string>("#3b82f6");
  const [category, setCategory] = useState<string>("STEM");
  const [consecutive, setConsecutive] = useState<boolean>(false);
  const [defaultPeriods, setDefaultPeriods] = useState<number>(5);

  const predefinedColors = [
    "#2563eb", // Blue
    "#059669", // Green
    "#7c3aed", // Purple
    "#d97706", // Amber
    "#db2777", // Pink
    "#0891b2", // Cyan
    "#65a30d", // Lime
    "#ea580c", // Orange
    "#dc2626", // Red
    "#475569", // Slate
  ];

  const startCreate = () => {
    setIsCreating(true);
    setEditingSubject(null);
    setName("");
    setCode("");
    setColor(predefinedColors[subjects.length % predefinedColors.length]);
    setCategory("STEM");
    setConsecutive(false);
    setDefaultPeriods(5);
  };

  const startEdit = (s: Subject) => {
    setEditingSubject(s);
    setIsCreating(false);
    setName(s.name);
    setCode(s.code);
    setColor(s.color);
    setCategory(s.category);
    setConsecutive(s.requires_consecutive);
    setDefaultPeriods(s.default_periods_per_week);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const finalCode = code.trim().toUpperCase() || name.slice(0, 4).toUpperCase();
    const newSubject: Subject = {
      id: editingSubject ? editingSubject.id : Date.now(),
      name: name.trim(),
      code: finalCode,
      color,
      category,
      requires_consecutive: consecutive,
      default_periods_per_week: defaultPeriods,
      icon: "book",
    };
    onSaveSubject(newSubject);
    setEditingSubject(null);
    setIsCreating(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Subjects & Curriculum
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Define subjects, visual identifier colors, consecutive period flags, and default weekly requirements.
          </p>
        </div>

        {!isCreating && !editingSubject && (
          <button
            id="btn-add-subject"
            onClick={startCreate}
            className="inline-flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Add Subject</span>
          </button>
        )}
      </div>

      {/* Editor Modal */}
      {(isCreating || editingSubject) && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-blue-200/60">
            <h3 className="text-sm font-bold text-blue-950">
              {editingSubject ? `Edit Subject: ${editingSubject.name}` : "Add New Subject"}
            </h3>
            <button
              onClick={() => {
                setEditingSubject(null);
                setIsCreating(false);
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subject Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!code) setCode(e.target.value.slice(0, 4).toUpperCase());
                }}
                placeholder="e.g. Mathematics"
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Short Code (e.g. MATH)
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. MATH"
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs uppercase focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-blue-500 focus:outline-hidden"
              >
                <option value="STEM">STEM (Math/Science)</option>
                <option value="Languages">Languages</option>
                <option value="Humanities">Humanities & Social</option>
                <option value="Creative">Creative Arts & Music</option>
                <option value="Sports">Sports & Physical Ed</option>
              </select>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Identifier Color
              </label>
              <div className="flex items-center space-x-2">
                {predefinedColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full transition-transform ${
                      color === c ? "scale-110 ring-2 ring-blue-500 ring-offset-2" : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-7 w-7 cursor-pointer rounded-full border-0 p-0"
                  title="Custom color"
                />
              </div>
            </div>

            <div className="flex items-center space-x-4 pt-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consecutive}
                  onChange={(e) => setConsecutive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-medium text-slate-700">
                  Requires Consecutive Double Periods (e.g. Labs)
                </span>
              </label>
            </div>
          </div>

          <div className="mt-5 flex justify-end space-x-2">
            <button
              onClick={() => {
                setEditingSubject(null);
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
              <span>Save Subject</span>
            </button>
          </div>
        </div>
      )}

      {/* Subjects Grid */}
      {subjects.length === 0 && !isCreating && !editingSubject && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 mb-4">
            <BookOpen className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Subjects Configured</h3>
          <p className="max-w-md text-sm text-slate-500 mt-1.5 mb-5">
            Start by adding the subjects taught in your school curriculum (e.g., Mathematics, English, Science, Languages).
          </p>
          <button
            onClick={startCreate}
            className="inline-flex items-center space-x-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Add First Subject</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {subjects.map((s) => (
          <div
            key={s.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-slate-300 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <span
                  className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-2xs"
                  style={{ backgroundColor: s.color }}
                >
                  {s.code}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{s.name}</h3>
                  <span className="text-[10px] font-medium text-slate-500">{s.category}</span>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={() => startEdit(s)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onDeleteSubject(s.id)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
              <span>Consecutive: {s.requires_consecutive ? "Yes" : "No"}</span>
              <span className="font-semibold text-slate-700">
                Default: {s.default_periods_per_week} /wk
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
