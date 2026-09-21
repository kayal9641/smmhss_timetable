import React, { useState, useMemo } from "react";
import {
  Staff,
  TimetableEntry,
  SchoolTimings,
  SchoolClass,
  Subject,
  StaffAssignment,
} from "../types";
import {
  Coffee,
  Utensils,
  Search,
  Filter,
  Users,
  Printer,
  CalendarCheck,
  BookOpen,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface FreePeriodsViewProps {
  staffList: Staff[];
  entries: TimetableEntry[];
  timings: SchoolTimings;
  classes: SchoolClass[];
  subjects: Subject[];
  assignments?: StaffAssignment[];
}

export const FreePeriodsView: React.FC<FreePeriodsViewProps> = ({
  staffList,
  entries,
  timings,
  classes,
  subjects,
  assignments = [],
}) => {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<number | "all">("all");
  const [selectedDayFilter, setSelectedDayFilter] = useState<string | "all">("all");
  const [expandedCells, setExpandedCells] = useState<Record<string, boolean>>({});

  // Helper maps
  const subjectMap = useMemo(() => {
    const map = new Map<number, Subject>();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  const classMap = useMemo(() => {
    const map = new Map<number, SchoolClass>();
    classes.forEach((c) => map.set(c.id, c));
    return map;
  }, [classes]);

  // Timings and active days
  const activeDays = useMemo(() => {
    return timings.active_days && timings.active_days.length > 0
      ? timings.active_days
      : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  }, [timings.active_days]);

  const displayedDays = useMemo(() => {
    if (selectedDayFilter === "all") return activeDays;
    return activeDays.filter((d) => d === selectedDayFilter);
  }, [activeDays, selectedDayFilter]);

  const periodsCount = timings.total_periods || 8;
  const periods = useMemo(
    () => Array.from({ length: periodsCount }, (_, i) => i + 1),
    [periodsCount]
  );

  // Helper for period times
  const getPeriodTime = (p: number): string => {
    switch (p) {
      case 1:
        return "09:10 - 09:50";
      case 2:
        return "09:50 - 10:30";
      case 3:
        return "10:45 - 11:25";
      case 4:
        return "11:25 - 12:05";
      case 5:
        return "12:50 - 13:30";
      case 6:
        return "13:30 - 14:10";
      case 7:
        return "14:20 - 15:00";
      case 8:
        return "15:00 - 15:40";
      default:
        return `Period ${p}`;
    }
  };

  // Staff qualification helper
  const getStaffQualifiedSubjects = (st: Staff): Subject[] => {
    const qualifiedIds = new Set<number>(st.qualified_subject_ids || []);
    // Also include from explicit assignments
    assignments
      .filter((a) => Number(a.staff_id) === Number(st.id))
      .forEach((a) => qualifiedIds.add(Number(a.subject_id)));

    return Array.from(qualifiedIds)
      .map((id) => subjectMap.get(id))
      .filter(Boolean) as Subject[];
  };

  // Pre-calculate busy and unavailable staff for each slot
  const slotFreeStaffMap = useMemo(() => {
    const map = new Map<string, Staff[]>();

    activeDays.forEach((day) => {
      periods.forEach((p) => {
        const key = `${day}_${p}`;

        // Find staff booked in any active lesson for this day and period
        const bookedStaffIds = new Set<number>();
        entries.forEach((e) => {
          if (
            e.day === day &&
            Number(e.period) === Number(p) &&
            !e.is_docked &&
            e.day !== "DOCK" &&
            Number(e.period) !== 0
          ) {
            bookedStaffIds.add(Number(e.staff_id));
          }
        });

        // Find staff who marked this slot as unavailable
        const unavailableStaffIds = new Set<number>();
        staffList.forEach((st) => {
          if (
            st.unavailabilities?.some(
              (u) => u.day === day && Number(u.period) === Number(p)
            )
          ) {
            unavailableStaffIds.add(Number(st.id));
          }
        });

        // Free staff are those neither booked nor marked unavailable
        const freeStaff = staffList.filter(
          (st) =>
            !bookedStaffIds.has(Number(st.id)) &&
            !unavailableStaffIds.has(Number(st.id))
        );

        map.set(key, freeStaff);
      });
    });

    return map;
  }, [activeDays, periods, entries, staffList]);

  // Quick weekly stats
  const stats = useMemo(() => {
    let totalFreeSlots = 0;
    let totalSlotInstances = activeDays.length * periods.length;

    activeDays.forEach((day) => {
      periods.forEach((p) => {
        const freeList = slotFreeStaffMap.get(`${day}_${p}`) || [];
        totalFreeSlots += freeList.length;
      });
    });

    const averageFreePerSlot =
      totalSlotInstances > 0 ? (totalFreeSlots / totalSlotInstances).toFixed(1) : "0";

    // Count free periods per staff across the whole week
    const staffFreeCount = new Map<number, number>();
    staffList.forEach((s) => staffFreeCount.set(s.id, 0));

    activeDays.forEach((day) => {
      periods.forEach((p) => {
        const freeList = slotFreeStaffMap.get(`${day}_${p}`) || [];
        freeList.forEach((st) => {
          staffFreeCount.set(st.id, (staffFreeCount.get(st.id) || 0) + 1);
        });
      });
    });

    const staffRanking = staffList
      .map((st) => ({
        staff: st,
        freePeriods: staffFreeCount.get(st.id) || 0,
        subjects: getStaffQualifiedSubjects(st),
      }))
      .sort((a, b) => b.freePeriods - a.freePeriods);

    return {
      totalFreeSlots,
      averageFreePerSlot,
      staffRanking,
    };
  }, [activeDays, periods, slotFreeStaffMap, staffList]);

  const toggleCellExpand = (cellKey: string) => {
    setExpandedCells((prev) => ({
      ...prev,
      [cellKey]: !prev[cellKey],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 rounded-2xl bg-white p-6 shadow-xs border border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Free Periods & Staff Availability
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Weekly matrix of unassigned staff members for each period across all working days.
            Use this view for instant substitute teacher deployment, cover assignments, and workload balancing.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span>Print Free Schedule</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Teaching Staff
            </span>
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">{staffList.length}</span>
            <span className="text-xs text-slate-500">teachers registered</span>
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Avg. Free Staff / Period
            </span>
            <Sparkles className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-emerald-700">
              {stats.averageFreePerSlot}
            </span>
            <span className="text-xs text-slate-500">teachers per bell</span>
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Weekly Free Hours
            </span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-amber-700">
              {stats.totalFreeSlots}
            </span>
            <span className="text-xs text-slate-500">available teacher-periods</span>
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Substitution Readiness
            </span>
            <CheckCircle2 className="h-4 w-4 text-teal-500" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-teal-700">100%</span>
            <span className="text-xs text-slate-500">coverage monitored</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search by staff name */}
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-500 text-slate-800"
            />
          </div>

          {/* Filter by Subject */}
          <div className="flex items-center space-x-1.5">
            <BookOpen className="h-4 w-4 text-slate-400" />
            <select
              value={selectedSubjectFilter}
              onChange={(e) =>
                setSelectedSubjectFilter(
                  e.target.value === "all" ? "all" : Number(e.target.value)
                )
              }
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none focus:border-blue-500 text-slate-700 font-medium cursor-pointer"
            >
              <option value="all">All Qualified Subjects</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  Can Teach: {sub.name} ({sub.code})
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Day */}
          <div className="flex items-center space-x-1.5">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={selectedDayFilter}
              onChange={(e) => setSelectedDayFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none focus:border-blue-500 text-slate-700 font-medium cursor-pointer"
            >
              <option value="all">All Days (Monday - Saturday)</option>
              {activeDays.map((d) => (
                <option key={d} value={d}>
                  {d} Only
                </option>
              ))}
            </select>
          </div>
        </div>

        {(searchTerm || selectedSubjectFilter !== "all" || selectedDayFilter !== "all") && (
          <button
            onClick={() => {
              setSearchTerm("");
              setSelectedSubjectFilter("all");
              setSelectedDayFilter("all");
            }}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium self-start md:self-auto cursor-pointer"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Main Weekly Timetable Grid */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-bold text-slate-700">
                <th className="p-3.5 border-r border-slate-200 w-36 min-w-[140px] sticky left-0 bg-slate-50 z-10">
                  <div className="flex items-center space-x-1.5">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span>Period / Time</span>
                  </div>
                </th>
                {displayedDays.map((day) => (
                  <th
                    key={day}
                    className="p-3.5 border-r border-slate-200 last:border-r-0 min-w-[190px] text-center"
                  >
                    <div className="font-bold text-slate-900 text-sm">{day}</div>
                    <div className="text-[10px] text-slate-400 font-normal uppercase tracking-wider mt-0.5">
                      Working Day
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 text-xs">
              {periods.map((p) => {
                return (
                  <React.Fragment key={`row-group-${p}`}>
                    {/* Morning Interval after period 2 */}
                    {p === 3 && (
                      <tr key="morning-break" className="bg-amber-50/60 border-y border-amber-200/70">
                        <td className="p-2.5 font-semibold text-amber-900 border-r border-amber-200/70 flex items-center space-x-1.5 sticky left-0 bg-amber-50 z-10">
                          <Coffee className="h-3.5 w-3.5 text-amber-600" />
                          <span>10:30 - 10:45</span>
                        </td>
                        <td
                          colSpan={displayedDays.length}
                          className="p-2 text-center font-bold tracking-wider text-amber-800 uppercase text-[11px]"
                        >
                          ☕ Morning Interval (15 Minutes)
                        </td>
                      </tr>
                    )}

                    {/* Lunch Break after period 4 */}
                    {p === 5 && (
                      <tr key="lunch-break" className="bg-emerald-50/60 border-y border-emerald-200/70">
                        <td className="p-2.5 font-semibold text-emerald-900 border-r border-emerald-200/70 flex items-center space-x-1.5 sticky left-0 bg-emerald-50 z-10">
                          <Utensils className="h-3.5 w-3.5 text-emerald-600" />
                          <span>12:05 - 12:50</span>
                        </td>
                        <td
                          colSpan={displayedDays.length}
                          className="p-2 text-center font-bold tracking-wider text-emerald-800 uppercase text-[11px]"
                        >
                          🥗 Lunch Break (45 Minutes)
                        </td>
                      </tr>
                    )}

                    {/* Afternoon Interval after period 6 */}
                    {p === 7 && (
                      <tr key="afternoon-break" className="bg-amber-50/60 border-y border-amber-200/70">
                        <td className="p-2.5 font-semibold text-amber-900 border-r border-amber-200/70 flex items-center space-x-1.5 sticky left-0 bg-amber-50 z-10">
                          <Coffee className="h-3.5 w-3.5 text-amber-600" />
                          <span>14:10 - 14:20</span>
                        </td>
                        <td
                          colSpan={displayedDays.length}
                          className="p-2 text-center font-bold tracking-wider text-amber-800 uppercase text-[11px]"
                        >
                          ☕ Afternoon Interval (10 Minutes)
                        </td>
                      </tr>
                    )}

                    {/* Standard Period Row */}
                    <tr key={`period-row-${p}`} className="hover:bg-slate-50/40 transition-colors">
                      {/* Period Label Header */}
                      <td className="p-3.5 font-semibold text-slate-800 border-r border-slate-200 bg-slate-50/40 align-top sticky left-0 z-10">
                        <div className="font-bold text-slate-900 text-sm">Period {p}</div>
                        <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                          {getPeriodTime(p)}
                        </div>
                      </td>

                      {/* Day Columns */}
                      {displayedDays.map((day) => {
                        const cellKey = `${day}_${p}`;
                        const rawFreeStaff = slotFreeStaffMap.get(cellKey) || [];

                        // Apply subject filter and search query
                        const filteredFreeStaff = rawFreeStaff.filter((st) => {
                          // Search query
                          if (searchTerm.trim()) {
                            const term = searchTerm.toLowerCase();
                            const matchName = st.name.toLowerCase().includes(term);
                            const matchEmp = st.employee_id?.toLowerCase().includes(term);
                            if (!matchName && !matchEmp) return false;
                          }

                          // Subject qualification filter
                          if (selectedSubjectFilter !== "all") {
                            const isQualified = st.qualified_subject_ids?.includes(selectedSubjectFilter);
                            const isAssigned = assignments.some(
                              (a) =>
                                Number(a.staff_id) === Number(st.id) &&
                                Number(a.subject_id) === Number(selectedSubjectFilter)
                            );
                            if (!isQualified && !isAssigned) return false;
                          }

                          return true;
                        });

                        const isExpanded = expandedCells[cellKey];
                        const displayLimit = 4;
                        const visibleStaff = isExpanded
                          ? filteredFreeStaff
                          : filteredFreeStaff.slice(0, displayLimit);
                        const hiddenCount = filteredFreeStaff.length - displayLimit;

                        return (
                          <td
                            key={cellKey}
                            className="p-2.5 border-r border-slate-200 last:border-r-0 align-top min-w-[190px]"
                          >
                            {/* Cell Header Badge */}
                            <div className="flex items-center justify-between mb-2">
                              <span
                                className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  filteredFreeStaff.length === 0
                                    ? "bg-slate-100 text-slate-500"
                                    : filteredFreeStaff.length <= 2
                                    ? "bg-blue-50 text-blue-700 border border-blue-200/60"
                                    : "bg-emerald-50 text-emerald-800 border border-emerald-200/60"
                                }`}
                              >
                                <span>{filteredFreeStaff.length} Free</span>
                              </span>

                              {hiddenCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => toggleCellExpand(cellKey)}
                                  className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold flex items-center space-x-0.5 cursor-pointer"
                                >
                                  <span>{isExpanded ? "Collapse" : `+${hiddenCount} more`}</span>
                                  {isExpanded ? (
                                    <ChevronUp className="h-3 w-3" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3" />
                                  )}
                                </button>
                              )}
                            </div>

                            {/* Free Staff Cards */}
                            {filteredFreeStaff.length === 0 ? (
                              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-3 text-center">
                                <span className="text-[11px] text-slate-400 italic">
                                  {rawFreeStaff.length === 0
                                    ? "All staff busy in classes"
                                    : "No matching staff"}
                                </span>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {visibleStaff.map((st) => {
                                  const staffSubjects = getStaffQualifiedSubjects(st);
                                  return (
                                    <div
                                      key={st.id}
                                      className="group rounded-xl border border-slate-200/80 bg-white p-2 shadow-2xs hover:border-emerald-300 hover:shadow-xs transition-all"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="font-semibold text-xs text-slate-800 group-hover:text-emerald-950 flex items-center space-x-1">
                                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                                          <span className="truncate">{st.name}</span>
                                        </div>
                                        {st.employee_id && (
                                          <span className="text-[9px] text-slate-400 font-mono">
                                            {st.employee_id}
                                          </span>
                                        )}
                                      </div>

                                      {/* Qualifications chips */}
                                      {staffSubjects.length > 0 && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                          {staffSubjects.slice(0, 2).map((sub) => (
                                            <span
                                              key={sub.id}
                                              className="inline-block rounded px-1.5 py-0.2 text-[9px] font-medium bg-slate-100 text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-700"
                                            >
                                              {sub.code || sub.name.slice(0, 4)}
                                            </span>
                                          ))}
                                          {staffSubjects.length > 2 && (
                                            <span className="text-[9px] text-slate-400">
                                              +{staffSubjects.length - 2}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff Weekly Free Capacity Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Staff Free Period Distribution & Availability Ranking
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Overview of free hours per teacher across the 6-day cycle to ensure balanced cover duties.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {stats.staffRanking.length} Staff Monitored
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {stats.staffRanking.map(({ staff, freePeriods, subjects }) => {
            const isHighAvailability = freePeriods >= 15;
            return (
              <div
                key={staff.id}
                className="rounded-xl border border-slate-200 p-3 bg-slate-50/50 hover:bg-white hover:border-blue-300 transition-all shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 truncate">
                    {staff.name}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isHighAvailability
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {freePeriods} Free Periods
                  </span>
                </div>

                <div className="mt-2 text-[11px] text-slate-500 flex flex-wrap gap-1">
                  {subjects.length > 0 ? (
                    subjects.map((sub) => (
                      <span
                        key={sub.id}
                        className="rounded px-1.5 py-0.5 text-[9px] bg-white border border-slate-200 text-slate-600"
                      >
                        {sub.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">General Staff</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
