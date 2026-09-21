import React from "react";
import {
  LayoutDashboard,
  CalendarDays,
  UserCheck,
  GraduationCap,
  BookOpen,
  Users,
  Clock,
  AlertOctagon,
  Coffee,
} from "lucide-react";
import { NavigationTab, ConflictItem } from "../types";

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  conflicts: ConflictItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  conflicts,
}) => {
  const highConflicts = conflicts.filter((c) => c.severity === "high").length;

  const navItems: {
    id: NavigationTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeColor?: string;
  }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "class_timetable", label: "Class Timetable", icon: CalendarDays },
    { id: "staff_timetable", label: "Staff Timetable", icon: UserCheck },
    { id: "free_periods", label: "Free Periods", icon: Coffee },
    { id: "classes", label: "Classes", icon: GraduationCap },
    { id: "subjects", label: "Subjects", icon: BookOpen },
    { id: "staff", label: "Staff Members", icon: Users },
    { id: "timings", label: "School Timings", icon: Clock },
    {
      id: "conflicts",
      label: "Conflict Checker",
      icon: AlertOctagon,
      badge: conflicts.length,
      badgeColor: highConflicts > 0 ? "bg-rose-500 text-white" : "bg-amber-500 text-white",
    },
  ];

  return (
    <aside
      id="app-sidebar"
      className="flex w-64 flex-col border-r border-slate-200 bg-white p-4 shrink-0"
    >
      <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase px-3 mb-2">
        Main Navigation
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => onSelectTab(item.id)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon
                  className={`h-4 w-4 ${
                    isActive ? "text-blue-600" : "text-slate-400"
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer System Info */}
      <div className="mt-auto border-t border-slate-100 pt-4 px-2 text-xs text-slate-400">
        <div className="flex items-center justify-between">
          <span>Engine</span>
          <span className="font-mono text-[11px] text-slate-600">Backtracking MRV</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span>Backend</span>
          <span className="font-mono text-[11px] text-emerald-600">FastAPI / Python 3.11</span>
        </div>
      </div>
    </aside>
  );
};
