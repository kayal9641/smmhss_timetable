import React from "react";
import {
  Calendar,
  Sparkles,
  AlertTriangle,
  Play,
  RefreshCw,
  Wifi,
  WifiOff,
  User as UserIcon,
  ShieldCheck,
} from "lucide-react";
import { SchoolTimings, ConflictItem, SyncStatus, UserProfile } from "../types";
import { User } from "firebase/auth";

interface HeaderProps {
  timings: SchoolTimings;
  conflicts: ConflictItem[];
  onOpenGenerate: () => void;
  onOpenAI: () => void;
  isGenerating?: boolean;
  syncStatus: SyncStatus;
  currentUser: User | null;
  userProfile: UserProfile | null;
  onOpenAuth: () => void;
  onOpenRulesModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  timings,
  conflicts,
  onOpenGenerate,
  onOpenAI,
  isGenerating = false,
  syncStatus,
  currentUser,
  userProfile,
  onOpenAuth,
  onOpenRulesModal,
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

      {/* Action Controls & Sync/Auth Status */}
      <div className="flex items-center space-x-2.5">
        {/* Real-time Connection Status Indicator (Clickable to view rules/status) */}
        <button
          id="cloud-sync-status-indicator"
          onClick={onOpenRulesModal}
          className={`flex items-center space-x-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors cursor-pointer hover:opacity-90 ${
            syncStatus === "connected"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/70"
              : syncStatus === "syncing"
              ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/70"
              : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100/70"
          }`}
          title="Click to check Firebase Cloud Sync & Persistence settings"
        >
          {syncStatus === "connected" ? (
            <>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-semibold">Firebase Live</span>
            </>
          ) : syncStatus === "syncing" ? (
            <>
              <RefreshCw className="h-3 w-3 animate-spin text-amber-600" />
              <span className="font-semibold">Cloud Syncing...</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-rose-600" />
              <span className="font-semibold">Firestore Offline</span>
            </>
          )}
        </button>

        {/* User Auth / Profile Badge */}
        <button
          id="btn-auth-profile"
          onClick={onOpenAuth}
          className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          title={currentUser ? `Signed in as ${currentUser.email}` : "Sign In with Firebase"}
        >
          {currentUser ? (
            <>
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                {userProfile?.displayName ? userProfile.displayName[0].toUpperCase() : "U"}
              </div>
              <span className="hidden sm:inline font-semibold">
                {userProfile?.role === "admin" ? "Admin" : "Faculty"}
              </span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="hidden sm:inline">Sign In</span>
            </>
          )}
        </button>

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

