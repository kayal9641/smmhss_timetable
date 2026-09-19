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
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./services/firebase";
import {
  subscribeToTimings,
  subscribeToClasses,
  subscribeToSubjects,
  subscribeToStaff,
  subscribeToAssignments,
  subscribeToTimetableEntries,
  saveSchoolTimingsCloud,
  saveClassCloud,
  deleteClassCloud,
  saveSubjectCloud,
  deleteSubjectCloud,
  saveStaffCloud,
  deleteStaffCloud,
  saveAssignmentCloud,
  deleteAssignmentCloud,
  saveTimetableEntriesCloud,
  moveTimetableSlotTransactionCloud,
  getUserProfile,
} from "./services/firebaseService";
import { UserProfile, SyncStatus } from "./types";

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
import { AuthModal } from "./components/AuthModal";

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

  // Modals & Firebase Auth
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState<boolean>(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("connected");

  // Auth state listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const prof = await getUserProfile(user.uid);
          setUserProfile(prof);
        } catch (e) {
          console.error("Error fetching user profile:", e);
        }
      } else {
        setUserProfile(null);
      }
    });
    return () => unsub();
  }, []);

  // Online / Offline network status listener
  useEffect(() => {
    const handleOnline = () => setSyncStatus("connected");
    const handleOffline = () => setSyncStatus("offline");
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Real-time Cloud Listeners: Firestore as the Central Single Source of Truth
  useEffect(() => {
    setSyncStatus("syncing");

    const unsubTimings = subscribeToTimings(
      (t) => {
        if (t) setTimings(t);
        setSyncStatus(navigator.onLine ? "connected" : "offline");
      },
      () => setSyncStatus("offline")
    );

    const unsubClasses = subscribeToClasses(
      (clsList) => {
        setClasses(clsList);
        setSyncStatus(navigator.onLine ? "connected" : "offline");
      },
      () => setSyncStatus("offline")
    );

    const unsubSubjects = subscribeToSubjects(
      (subjList) => {
        setSubjects(subjList);
        setSyncStatus(navigator.onLine ? "connected" : "offline");
      },
      () => setSyncStatus("offline")
    );

    const unsubStaff = subscribeToStaff(
      (stList) => {
        setStaffList(stList);
        setSyncStatus(navigator.onLine ? "connected" : "offline");
      },
      () => setSyncStatus("offline")
    );

    const unsubAssignments = subscribeToAssignments(
      (asgnList) => {
        setAssignments(asgnList);
        setSyncStatus(navigator.onLine ? "connected" : "offline");
      },
      () => setSyncStatus("offline")
    );

    const unsubEntries = subscribeToTimetableEntries(
      (entryList) => {
        setEntries(entryList);
        setSyncStatus(navigator.onLine ? "connected" : "offline");
      },
      () => setSyncStatus("offline")
    );

    return () => {
      unsubTimings();
      unsubClasses();
      unsubSubjects();
      unsubStaff();
      unsubAssignments();
      unsubEntries();
    };
  }, []);

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
        try {
          setSyncStatus("syncing");
          await saveTimetableEntriesCloud(result.entries);
          setSyncStatus("connected");
        } catch (err) {
          console.error("Error saving generated timetable to Firebase:", err);
          setSyncStatus(navigator.onLine ? "connected" : "offline");
        }
      }

      return result;
    },
    [classes, staffList, subjects, assignments, timings, entries]
  );

  // Manual move entry handler with validation & cloud atomic transaction
  const handleMoveEntry = useCallback(
    async (
      entryId: number,
      newDay: string,
      newPeriod: number
    ): Promise<{ success: boolean; error?: string }> => {
      const entry = entries.find((e) => e.id === entryId);
      if (!entry) return { success: false, error: "Entry not found" };

      // Validate slot availability client-side first
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

      // Execute atomic Firestore cloud transaction to prevent multi-user race conditions
      setSyncStatus("syncing");
      const classMap = new Map(classes.map((c) => [c.id, c]));
      const staffMap = new Map(staffList.map((s) => [s.id, s]));

      const cloudResult = await moveTimetableSlotTransactionCloud(
        entryId,
        newDay,
        newPeriod,
        classMap,
        staffMap
      );

      setSyncStatus(navigator.onLine ? "connected" : "offline");

      if (!cloudResult.success) {
        return { success: false, error: cloudResult.error };
      }

      // Optimistic update (Firestore real-time listener will also emit update)
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId ? { ...e, day: newDay, period: newPeriod } : e
        )
      );

      return { success: true };
    },
    [entries, timings, staffList, classes]
  );

  // Regenerate single class
  const handleRegenerateClass = useCallback(
    (classId: number) => {
      handleRunGenerate("class", classId);
    },
    [handleRunGenerate]
  );

  // Class CRUD with Cloud persistence
  const handleSaveClass = useCallback(async (cls: SchoolClass) => {
    setClasses((prev) => {
      const exists = prev.some((c) => c.id === cls.id);
      return exists ? prev.map((c) => (c.id === cls.id ? cls : c)) : [...prev, cls];
    });
    try {
      setSyncStatus("syncing");
      await saveClassCloud(cls);
      setSyncStatus("connected");
    } catch (err) {
      console.error("Failed to save class to cloud:", err);
      setSyncStatus(navigator.onLine ? "connected" : "offline");
    }
  }, []);

  const handleDeleteClass = useCallback(async (classId: number) => {
    setClasses((prev) => prev.filter((c) => c.id !== classId));
    setAssignments((prev) => prev.filter((a) => a.class_id !== classId));
    setEntries((prev) => prev.filter((e) => e.class_id !== classId));
    try {
      setSyncStatus("syncing");
      await deleteClassCloud(classId);
      setSyncStatus("connected");
    } catch (err) {
      console.error("Failed to delete class from cloud:", err);
      setSyncStatus(navigator.onLine ? "connected" : "offline");
    }
  }, []);

  // Subject CRUD with Cloud persistence
  const handleSaveSubject = useCallback(async (sub: Subject) => {
    setSubjects((prev) => {
      const exists = prev.some((s) => s.id === sub.id);
      return exists ? prev.map((s) => (s.id === sub.id ? sub : s)) : [...prev, sub];
    });
    try {
      setSyncStatus("syncing");
      await saveSubjectCloud(sub);
      setSyncStatus("connected");
    } catch (err) {
      console.error("Failed to save subject to cloud:", err);
      setSyncStatus(navigator.onLine ? "connected" : "offline");
    }
  }, []);

  const handleDeleteSubject = useCallback(async (subId: number) => {
    setSubjects((prev) => prev.filter((s) => s.id !== subId));
    setAssignments((prev) => prev.filter((a) => a.subject_id !== subId));
    setEntries((prev) => prev.filter((e) => e.subject_id !== subId));
    try {
      setSyncStatus("syncing");
      await deleteSubjectCloud(subId);
      setSyncStatus("connected");
    } catch (err) {
      console.error("Failed to delete subject from cloud:", err);
      setSyncStatus(navigator.onLine ? "connected" : "offline");
    }
  }, []);

  // Staff CRUD with Cloud persistence
  const handleSaveStaff = useCallback(async (staff: Staff) => {
    setStaffList((prev) => {
      const exists = prev.some((s) => s.id === staff.id);
      return exists ? prev.map((s) => (s.id === staff.id ? staff : s)) : [...prev, staff];
    });
    try {
      setSyncStatus("syncing");
      await saveStaffCloud(staff);
      setSyncStatus("connected");
    } catch (err) {
      console.error("Failed to save staff to cloud:", err);
      setSyncStatus(navigator.onLine ? "connected" : "offline");
    }
  }, []);

  const handleDeleteStaff = useCallback(async (staffId: number) => {
    setStaffList((prev) => prev.filter((s) => s.id !== staffId));
    setAssignments((prev) => prev.filter((a) => a.staff_id !== staffId));
    setEntries((prev) => prev.filter((e) => e.staff_id !== staffId));
    try {
      setSyncStatus("syncing");
      await deleteStaffCloud(staffId);
      setSyncStatus("connected");
    } catch (err) {
      console.error("Failed to delete staff from cloud:", err);
      setSyncStatus(navigator.onLine ? "connected" : "offline");
    }
  }, []);

  // Assignment CRUD with Cloud persistence
  const handleSaveAssignment = useCallback(async (asgn: StaffAssignment) => {
    setAssignments((prev) => [...prev, asgn]);
    try {
      setSyncStatus("syncing");
      await saveAssignmentCloud(asgn);
      setSyncStatus("connected");
    } catch (err) {
      console.error("Failed to save assignment to cloud:", err);
      setSyncStatus(navigator.onLine ? "connected" : "offline");
    }
  }, []);

  const handleDeleteAssignment = useCallback(async (asgnId: number) => {
    setAssignments((prev) => prev.filter((a) => a.id !== asgnId));
    try {
      setSyncStatus("syncing");
      await deleteAssignmentCloud(asgnId);
      setSyncStatus("connected");
    } catch (err) {
      console.error("Failed to delete assignment from cloud:", err);
      setSyncStatus(navigator.onLine ? "connected" : "offline");
    }
  }, []);

  // Timings Update with Cloud persistence
  const handleSaveTimings = useCallback(async (newTimings: SchoolTimings) => {
    setTimings(newTimings);
    try {
      setSyncStatus("syncing");
      await saveSchoolTimingsCloud(newTimings);
      setSyncStatus("connected");
    } catch (err) {
      console.error("Failed to save timings to cloud:", err);
      setSyncStatus(navigator.onLine ? "connected" : "offline");
    }
  }, []);

  // Availability Update with Cloud persistence
  const handleUpdateStaffAvailability = useCallback(
    async (staffId: number, unavailabilities: { day: string; period: number; reason?: string }[]) => {
      const targetStaff = staffList.find((s) => s.id === staffId);
      if (!targetStaff) return;
      const updatedStaff = { ...targetStaff, unavailabilities };

      setStaffList((prev) =>
        prev.map((s) => (s.id === staffId ? updatedStaff : s))
      );
      try {
        setSyncStatus("syncing");
        await saveStaffCloud(updatedStaff);
        setSyncStatus("connected");
      } catch (err) {
        console.error("Failed to update staff availability in cloud:", err);
        setSyncStatus(navigator.onLine ? "connected" : "offline");
      }
    },
    [staffList]
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
        saveSubjectCloud(targetSubject).catch(console.error);
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
        saveStaffCloud(targetStaff).catch(console.error);
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
        saveStaffCloud(targetStaff).catch(console.error);
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
              const newAsgn: StaffAssignment = {
                id: Date.now() + Math.random(),
                class_id: matchedClass.id,
                subject_id: targetSubject!.id,
                staff_id: targetStaff!.id,
              };
              setAssignments((prev) => [...prev, newAsgn]);
              saveAssignmentCloud(newAsgn).catch(console.error);
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
          syncStatus={syncStatus}
          currentUser={currentUser}
          userProfile={userProfile}
          onOpenAuth={() => setIsAuthModalOpen(true)}
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

      {/* Firebase Cloud Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        userProfile={userProfile}
        onProfileUpdated={(p) => setUserProfile(p)}
      />
    </div>
  );
}
