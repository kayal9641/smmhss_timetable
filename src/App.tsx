import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  NavigationTab,
  SchoolClass,
  Staff,
  Subject,
  StaffAssignment,
  SchoolTimings,
  TimetableEntry,
  ConflictItem,
  GenerationRunResult,
} from "./types";
import {
  initialClasses,
  initialStaff,
  initialSubjects,
  initialAssignments,
  initialTimings,
  initialTimetableEntries,
} from "./data/initialData";
import { ConflictChecker } from "./services/conflictChecker";
import { TimetableScheduler } from "./services/scheduler";
import { ParsedAIData } from "./services/groqService";

// Layout components
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";

// View components
import { DashboardView } from "./components/DashboardView";
import { ClassTimetableView } from "./components/ClassTimetableView";
import { StaffTimetableView } from "./components/StaffTimetableView";
import { ClassesView } from "./components/ClassesView";
import { SubjectsView } from "./components/SubjectsView";
import { StaffView } from "./components/StaffView";
import { AssignmentsView } from "./components/AssignmentsView";
import { TimingsView } from "./components/TimingsView";
import { AvailabilityView } from "./components/AvailabilityView";
import { ConflictCheckerView } from "./components/ConflictCheckerView";
import { CodeViewerView } from "./components/CodeViewerView";

// Modals
import { GenerateModal } from "./components/GenerateModal";
import { AIAssistantModal } from "./components/AIAssistantModal";

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>("dashboard");

  // Core State (initialized from empty defaults with localStorage persistence)
  const [classes, setClasses] = useState<SchoolClass[]>(() => {
    try {
      const saved = localStorage.getItem("sm_classes_v1");
      return saved ? JSON.parse(saved) : initialClasses;
    } catch {
      return initialClasses;
    }
  });
  const [staffList, setStaffList] = useState<Staff[]>(() => {
    try {
      const saved = localStorage.getItem("sm_staff_v1");
      return saved ? JSON.parse(saved) : initialStaff;
    } catch {
      return initialStaff;
    }
  });
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    try {
      const saved = localStorage.getItem("sm_subjects_v1");
      return saved ? JSON.parse(saved) : initialSubjects;
    } catch {
      return initialSubjects;
    }
  });
  const [assignments, setAssignments] = useState<StaffAssignment[]>(() => {
    try {
      const saved = localStorage.getItem("sm_assignments_v1");
      return saved ? JSON.parse(saved) : initialAssignments;
    } catch {
      return initialAssignments;
    }
  });
  const [timings, setTimings] = useState<SchoolTimings>(() => {
    try {
      const saved = localStorage.getItem("sm_timings_v1");
      return saved ? JSON.parse(saved) : initialTimings;
    } catch {
      return initialTimings;
    }
  });
  const [entries, setEntries] = useState<TimetableEntry[]>(() => {
    try {
      const saved = localStorage.getItem("sm_entries_v1");
      return saved ? JSON.parse(saved) : initialTimetableEntries;
    } catch {
      return initialTimetableEntries;
    }
  });

  // Local storage auto-sync
  useEffect(() => {
    try {
      localStorage.setItem("sm_classes_v1", JSON.stringify(classes));
    } catch {}
  }, [classes]);

  useEffect(() => {
    try {
      localStorage.setItem("sm_staff_v1", JSON.stringify(staffList));
    } catch {}
  }, [staffList]);

  useEffect(() => {
    try {
      localStorage.setItem("sm_subjects_v1", JSON.stringify(subjects));
    } catch {}
  }, [subjects]);

  useEffect(() => {
    try {
      localStorage.setItem("sm_assignments_v1", JSON.stringify(assignments));
    } catch {}
  }, [assignments]);

  useEffect(() => {
    try {
      localStorage.setItem("sm_timings_v1", JSON.stringify(timings));
    } catch {}
  }, [timings]);

  useEffect(() => {
    try {
      localStorage.setItem("sm_entries_v1", JSON.stringify(entries));
    } catch {}
  }, [entries]);

  // Availability sub-navigation target
  const [selectedStaffAvailabilityId, setSelectedStaffAvailabilityId] = useState<number | undefined>(undefined);

  // Modals
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState<boolean>(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState<boolean>(false);

  // Automatic Conflict Audit Calculation
  const conflicts = useMemo<ConflictItem[]>(() => {
    return ConflictChecker.audit(
      entries,
      classes,
      staffList,
      subjects,
      assignments,
      timings
    );
  }, [entries, classes, staffList, subjects, assignments, timings]);

  // Solver execution handler
  const handleRunGenerate = useCallback(
    async (
      scope: "all" | "class" | "staff" | "day",
      targetId?: number,
      dayName?: string
    ): Promise<GenerationRunResult> => {
      const startTime = performance.now();

      // Check impossibility first
      const preValidation = TimetableScheduler.validateFeasibility(
        classes,
        staffList,
        assignments,
        timings
      );

      if (!preValidation.feasible) {
        return {
          success: false,
          status: "failed",
          total_required: 0,
          total_scheduled: 0,
          missing_periods: 0,
          conflicts: [],
          execution_time_ms: Math.round(performance.now() - startTime),
          soft_score: 0,
          message: "Pre-validation failed: Timetable configuration is mathematically impossible.",
          impossible_reasons: preValidation.reasons.map((r) => ({
            reason: r,
          })),
        };
      }

      // Run solver
      const lockedEntries =
        scope === "class"
          ? entries.filter((e) => e.class_id !== targetId)
          : scope === "staff"
          ? entries.filter((e) => e.staff_id !== targetId)
          : scope === "day"
          ? entries.filter((e) => e.day !== dayName)
          : [];

      const result = TimetableScheduler.solve({
        classes,
        staffList,
        subjects,
        assignments,
        timings,
        lockedEntries,
      });

      if (result.success && result.entries) {
        setEntries(result.entries);
      }

      return result;
    },
    [classes, staffList, subjects, assignments, timings, entries]
  );

  // Manual move entry handler with validation
  const handleMoveEntry = useCallback(
    (entryId: number, newDay: string, newPeriod: number): { success: boolean; error?: string } => {
      const entry = entries.find((e) => e.id === entryId);
      if (!entry) return { success: false, error: "Entry not found" };

      // Validate slot availability
      const validation = ConflictChecker.canAssignSlot(
        entries,
        entry.class_id,
        entry.staff_id,
        newDay,
        newPeriod,
        timings,
        staffList,
        entryId
      );

      if (!validation.allowed) {
        return { success: false, error: validation.reason };
      }

      // Apply move
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId ? { ...e, day: newDay, period: newPeriod } : e
        )
      );

      return { success: true };
    },
    [entries, timings, staffList]
  );

  // Regenerate single class
  const handleRegenerateClass = useCallback(
    (classId: number) => {
      handleRunGenerate("class", classId);
    },
    [handleRunGenerate]
  );

  // Class CRUD
  const handleSaveClass = useCallback((cls: SchoolClass) => {
    setClasses((prev) => {
      const exists = prev.some((c) => c.id === cls.id);
      return exists ? prev.map((c) => (c.id === cls.id ? cls : c)) : [...prev, cls];
    });
  }, []);

  const handleDeleteClass = useCallback((classId: number) => {
    setClasses((prev) => prev.filter((c) => c.id !== classId));
    setAssignments((prev) => prev.filter((a) => a.class_id !== classId));
    setEntries((prev) => prev.filter((e) => e.class_id !== classId));
  }, []);

  // Subject CRUD
  const handleSaveSubject = useCallback((sub: Subject) => {
    setSubjects((prev) => {
      const exists = prev.some((s) => s.id === sub.id);
      return exists ? prev.map((s) => (s.id === sub.id ? sub : s)) : [...prev, sub];
    });
  }, []);

  const handleDeleteSubject = useCallback((subId: number) => {
    setSubjects((prev) => prev.filter((s) => s.id !== subId));
    setAssignments((prev) => prev.filter((a) => a.subject_id !== subId));
    setEntries((prev) => prev.filter((e) => e.subject_id !== subId));
  }, []);

  // Staff CRUD
  const handleSaveStaff = useCallback((staff: Staff) => {
    setStaffList((prev) => {
      const exists = prev.some((s) => s.id === staff.id);
      return exists ? prev.map((s) => (s.id === staff.id ? staff : s)) : [...prev, staff];
    });
  }, []);

  const handleDeleteStaff = useCallback((staffId: number) => {
    setStaffList((prev) => prev.filter((s) => s.id !== staffId));
    setAssignments((prev) => prev.filter((a) => a.staff_id !== staffId));
    setEntries((prev) => prev.filter((e) => e.staff_id !== staffId));
  }, []);

  // Assignment CRUD
  const handleSaveAssignment = useCallback((asgn: StaffAssignment) => {
    setAssignments((prev) => [...prev, asgn]);
  }, []);

  const handleDeleteAssignment = useCallback((asgnId: number) => {
    setAssignments((prev) => prev.filter((a) => a.id !== asgnId));
  }, []);

  // Timings Update
  const handleSaveTimings = useCallback((newTimings: SchoolTimings) => {
    setTimings(newTimings);
  }, []);

  // Availability Update
  const handleUpdateStaffAvailability = useCallback(
    (staffId: number, unavailabilities: { day: string; period: number; reason?: string }[]) => {
      setStaffList((prev) =>
        prev.map((s) => (s.id === staffId ? { ...s, unavailabilities } : s))
      );
    },
    []
  );

  // Natural Language AI Application
  const handleApplyParsedAIData = useCallback(
    (data: ParsedAIData): { success: boolean; logs: string[] } => {
      const logs: string[] = [];

      // Find or create subject
      let targetSubject = data.subject_name
        ? subjects.find((s) => s.name.toLowerCase() === data.subject_name!.toLowerCase())
        : undefined;

      if (!targetSubject && data.subject_name) {
        targetSubject = {
          id: Date.now(),
          name: data.subject_name,
          code: data.subject_name.slice(0, 4).toUpperCase(),
          color: "#4f46e5",
          icon: "book-open",
          category: "STEM",
          requires_consecutive: false,
          default_periods_per_week: 5,
        };
        setSubjects((prev) => [...prev, targetSubject!]);
        logs.push(`Created subject: ${targetSubject.name}`);
      }

      // Find or create staff
      let targetStaff = data.staff_name
        ? staffList.find((st) => st.name.toLowerCase() === data.staff_name!.toLowerCase())
        : undefined;

      if (!targetStaff && data.staff_name) {
        targetStaff = {
          id: Date.now() + 1,
          name: data.staff_name,
          employee_id: `EMP${Date.now().toString().slice(-4)}`,
          email: `${data.staff_name.toLowerCase().replace(/\s+/g, ".")}@academy.edu`,
          phone: "+1 555-0199",
          max_periods_per_day: data.max_periods_per_day || 6,
          max_periods_per_week: 25,
          qualified_subject_ids: targetSubject ? [targetSubject.id] : [],
          assigned_class_ids: [],
          unavailabilities: data.unavailable || [],
        };
        setStaffList((prev) => [...prev, targetStaff!]);
        logs.push(`Added new teacher: ${targetStaff.name}`);
      } else if (targetStaff) {
        // Update qualification & unavailabilities
        const updatedQuals = targetSubject && !targetStaff.qualified_subject_ids.includes(targetSubject.id)
          ? [...targetStaff.qualified_subject_ids, targetSubject.id]
          : targetStaff.qualified_subject_ids;

        const updatedUnavail = data.unavailable
          ? [...(targetStaff.unavailabilities || []), ...data.unavailable]
          : targetStaff.unavailabilities;

        targetStaff = {
          ...targetStaff,
          qualified_subject_ids: updatedQuals,
          unavailabilities: updatedUnavail,
        };
        setStaffList((prev) =>
          prev.map((s) => (s.id === targetStaff!.id ? targetStaff! : s))
        );
        logs.push(`Updated ${targetStaff.name} qualifications & availability`);
      }

      // Map to classes and create assignments
      if (data.class_names && targetStaff && targetSubject) {
        data.class_names.forEach((cName) => {
          const matchedClass = classes.find(
            (c) => c.name.toLowerCase() === cName.toLowerCase()
          );
          if (matchedClass) {
            // Check if already assigned
            const existing = assignments.some(
              (a) =>
                a.class_id === matchedClass.id &&
                a.subject_id === targetSubject!.id &&
                a.staff_id === targetStaff!.id
            );
            if (!existing) {
              setAssignments((prev) => [
                ...prev,
                {
                  id: Date.now() + Math.random(),
                  class_id: matchedClass.id,
                  subject_id: targetSubject!.id,
                  staff_id: targetStaff!.id,
                },
              ]);
              logs.push(`Assigned ${targetStaff!.name} to ${targetSubject!.name} for Class ${matchedClass.name}`);
            }
          }
        });
      }

      return { success: true, logs };
    },
    [subjects, staffList, classes, assignments]
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans text-slate-900 antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (tab !== "availability") {
            setSelectedStaffAvailabilityId(undefined);
          }
        }}
        conflicts={conflicts}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <Header
          timings={timings}
          conflicts={conflicts}
          onOpenGenerate={() => setIsGenerateModalOpen(true)}
          onOpenAI={() => setIsAIModalOpen(true)}
          onOpenCodeViewer={() => setCurrentTab("code_viewer")}
        />

        {/* Scrollable Workspace View Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {currentTab === "dashboard" && (
              <DashboardView
                classes={classes}
                staffList={staffList}
                subjects={subjects}
                assignments={assignments}
                entries={entries}
                timings={timings}
                conflicts={conflicts}
                onNavigate={(tab) => setCurrentTab(tab)}
                onOpenGenerate={() => setIsGenerateModalOpen(true)}
                onOpenAI={() => setIsAIModalOpen(true)}
              />
            )}

            {currentTab === "class_timetable" && (
              <ClassTimetableView
                classes={classes}
                staffList={staffList}
                subjects={subjects}
                entries={entries}
                timings={timings}
                onMoveEntry={handleMoveEntry}
                onRegenerateClass={handleRegenerateClass}
              />
            )}

            {currentTab === "staff_timetable" && (
              <StaffTimetableView
                staffList={staffList}
                classes={classes}
                subjects={subjects}
                entries={entries}
                timings={timings}
              />
            )}

            {currentTab === "classes" && (
              <ClassesView
                classes={classes}
                subjects={subjects}
                onSaveClass={handleSaveClass}
                onDeleteClass={handleDeleteClass}
              />
            )}

            {currentTab === "subjects" && (
              <SubjectsView
                subjects={subjects}
                onSaveSubject={handleSaveSubject}
                onDeleteSubject={handleDeleteSubject}
              />
            )}

            {currentTab === "staff" && (
              <StaffView
                staffList={staffList}
                subjects={subjects}
                classes={classes}
                onSaveStaff={handleSaveStaff}
                onDeleteStaff={handleDeleteStaff}
                onNavigateToAvailability={(staffId) => {
                  setSelectedStaffAvailabilityId(staffId);
                  setCurrentTab("availability");
                }}
              />
            )}

            {currentTab === "assignments" && (
              <AssignmentsView
                assignments={assignments}
                classes={classes}
                subjects={subjects}
                staffList={staffList}
                onSaveAssignment={handleSaveAssignment}
                onDeleteAssignment={handleDeleteAssignment}
              />
            )}

            {currentTab === "timings" && (
              <TimingsView
                timings={timings}
                onSaveTimings={handleSaveTimings}
              />
            )}

            {currentTab === "availability" && (
              <AvailabilityView
                staffList={staffList}
                timings={timings}
                onUpdateStaffAvailability={handleUpdateStaffAvailability}
                defaultStaffId={selectedStaffAvailabilityId}
              />
            )}

            {currentTab === "conflicts" && (
              <ConflictCheckerView
                conflicts={conflicts}
                onTriggerGenerate={() => setIsGenerateModalOpen(true)}
              />
            )}

            {currentTab === "code_viewer" && (
              <CodeViewerView />
            )}
          </div>
        </main>
      </div>

      {/* Generation Modal */}
      <GenerateModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        classes={classes}
        staffList={staffList}
        timings={timings}
        onRunGenerate={handleRunGenerate}
      />

      {/* Natural Language AI Assistant Modal */}
      <AIAssistantModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onApplyParsedData={handleApplyParsedAIData}
      />
    </div>
  );
}
