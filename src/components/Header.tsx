import React from "react";
import {
  Calendar,
  Sparkles,
  AlertTriangle,
  Play,
  RefreshCw,
} from "lucide-react";
import { SchoolTimings, ConflictItem } from "../types";

interface HeaderProps {
  timings: SchoolTimings;
  conflicts: ConflictItem[];
  onOpenGenerate: () => void;
  onOpenAI: () => void;
  onOpenCodeViewer?: () => void;
  isGenerating?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  timings,
  conflicts,
  onOpenGenerate,
  onOpenAI,
  isGenerating = false,
}) => {
  const highConflicts = conflicts.filter((c) => c.severity === "high").length;

  return (
    <header
      id="app-header"
      className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-3.5 backdrop-blur shadow-xs"
    >
      {/* Brand / School Info */}
      <div className="flex items-center space-x-3.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
          <Calendar className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-semibold text-slate-900 tracking-tight">
              {timings.school_name}
            </h1>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200/60">
              {timings.academic_year}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Automated Timetable & Staff Management System
          </p>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center space-x-2.5">
        {/* AI Assistant Button */}
        <button
          id="btn-open-ai-assistant"
          onClick={onOpenAI}
          className="inline-flex items-center space-x-1.5 rounded-lg border border-purple-200 bg-purple-50/80 px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-100 transition-colors"
          title="Groq AI Natural Language Setup Assistant"
        >
          <Sparkles className="h-4 w-4 text-purple-600" />
          <span className="hidden sm:inline">AI Assistant</span>
        </button>

        {/* Conflict Badge */}
        {conflicts.length > 0 && (
          <div
            id="header-conflicts-indicator"
            className={`flex items-center space-x-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
              highConflicts > 0
                ? "bg-rose-50 text-rose-700 border border-rose-200"
                : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>
              {conflicts.length} {conflicts.length === 1 ? "Conflict" : "Conflicts"}
            </span>
          </div>
        )}

        {/* Generate Timetable CTA */}
        <button
          id="btn-generate-timetable"
          onClick={onOpenGenerate}
          disabled={isGenerating}
          className="inline-flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Solving...</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Generate Timetable</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
