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
  StaffScheduleSlot,
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
import { doc, deleteDoc } from "firebase/firestore";
import { auth, db } from "./services/firebase";
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
  saveStaffWithSchedulesAtomicCloud,
  removeStaffClassCloud,
  deleteStaffCloud,
  saveTimetableEntriesCloud,
  saveSingleTimetableEntryCloud,
  deleteTimetableEntryCloud,
  swapOrMoveTimetableEntriesCloud,
  moveTimetableSlotTransactionCloud,
  getUserProfile,
} from "./services/firebaseService";
import { UserProfile, SyncStatus } from "./types";

// Layout components
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { FirestoreRulesModal } from "./components/FirestoreRulesModal";

// View components
import { DashboardView } from "./components/DashboardView";
import { ClassTimetableView } from "./components/ClassTimetableView";
import { StaffTimetableView } from "./components/StaffTimetableView";
import { ClassesView } from "./components/ClassesView";
import { SubjectsView } from "./components/SubjectsView";
import { StaffView } from "./components/StaffView";
import { TimingsView } from "./components/TimingsView";
import { ConflictCheckerView } from "./components/ConflictCheckerView";

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
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("connected");
  const [syncError, setSyncError] = useState<string | null>(null);

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

  // Real-time Cloud Listeners with Safe Persistence (Guards against data wipe-out on reload)
  useEffect(() => {
    setSyncStatus("syncing");

    const unsubTimings = subscribeToTimings(
      (t) => {
        if (t) {
          setTimings(t);
        } else {
          // If Firestore document doesn't exist yet, preserve local timings and initialize Firestore
          setTimings((prev) => {
            saveSchoolTimingsCloud(prev).catch(() => {});
            return prev;
          });
        }
        setSyncStatus(navigator.onLine ? "connected" : "offline");
        setSyncError(null);
      },
      (err: any) => {
        console.error("Timings sync notice:", err);
        if (err?.code === "permission-denied" || err?.message?.includes("permissions")) {
          setSyncError("permission-denied");
        }
        setSyncStatus("offline");
      }
    );

    const unsubClasses = subscribeToClasses(
      (clsList) => {
        if (clsList.length > 0) {
          setClasses(clsList);
        } else {
          // If cloud has no documents, check if local state has classes and upload them so they are not lost on reload
          setClasses((prev) => {
            if (prev && prev.length > 0) {
              prev.forEach((c) => saveClassCloud(c).catch(() => {}));
              return prev;
            }
            return [];
          });
        }
        setSyncStatus(navigator.onLine ? "connected" : "offline");
        setSyncError(null);
      },
      (err: any) => {
        console.error("Classes sync notice:", err);
        if (err?.code === "permission-denied" || err?.message?.includes("permissions")) {
          setSyncError("permission-denied");
        }
        setSyncStatus("offline");
      }
    );

    const unsubSubjects = subscribeToSubjects(
      (subjList) => {
        if (subjList.length > 0) {
          setSubjects(subjList);
        } else {
          // If cloud has no documents, check if local state has subjects and upload them so they are not lost on reload
          setSubjects((prev) => {
            if (prev && prev.length > 0) {
              prev.forEach((s) => saveSubjectCloud(s).catch(() => {}));
              return prev;
            }
            return [];
          });
        }
        setSyncStatus(navigator.onLine ? "connected" : "offline");
        setSyncError(null);
      },
      (err: any) => {
        console.error("Subjects sync notice:", err);
        if (err?.code === "permission-denied" || err?.message?.includes("permissions")) {
          setSyncError("permission-denied");
        }
        setSyncStatus("offline");
      }
    );

    const unsubStaff = subscribeToStaff(
      (stList) => {
        if (stList.length > 0) {
          setStaffList(stList);
        } else {
          // If cloud has no documents, check if local state has staff and upload them so they are not lost on reload
          setStaffList((prev) => {
            if (prev && prev.length > 0) {
              prev.forEach((s) => saveStaffCloud(s).catch(() => {}));
              return prev;
            }
            return [];
          });
        }
        setSyncStatus(navigator.onLine ? "connected" : "offline");
        setSyncError(null);
      },
      (err: any) => {
        console.error("Staff sync notice:", err);
        if (err?.code === "permission-denied" || err?.message?.includes("permissions")) {
          setSyncError("permission-denied");
        }
        setSyncStatus("offline");
      }
    );

    const unsubAssignments = subscribeToAssignments(
      (asgnList) => {
        if (asgnList.length > 0) {
          setAssignments(asgnList);
        } else {
          // If cloud has no documents, check if local state has assignments and upload them so they are not lost on reload
          setAssignments((prev) => {
            if (prev && prev.length > 0) {
              prev.forEach((a) => saveAssignmentCloud(a).catch(() => {}));
              return prev;
            }
            return [];
          });
        }
        setSyncStatus(navigator.onLine ? "connected" : "offline");
        setSyncError(null);
      },
      (err: any) => {
        console.error("Assignments sync notice:", err);
        if (err?.code === "permission-denied" || err?.message?.includes("permissions")) {
          setSyncError("permission-denied");
        }
        setSyncStatus("offline");
      }
    );

    const unsubEntries = subscribeToTimetableEntries(
      (entryList) => {
        if (entryList.length > 0) {
          setEntries(entryList);
        } else {
          // If cloud has no documents, check if local state has entries and upload them so they are not lost on reload
          setEntries((prev) => {
            if (prev && prev.length > 0) {
              saveTimetableEntriesCloud(prev).catch(() => {});
              return prev;
            }
            return [];
          });
        }
        setSyncStatus(navigator.onLine ? "connected" : "offline");
        setSyncError(null);
      },
      (err: any) => {
        console.error("Entries sync notice:", err);
        if (err?.code === "permission-denied" || err?.message?.includes("permissions")) {
          setSyncError("permission-denied");
        }
        setSyncStatus("offline");
      }
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
      newPeriod: number,
      options?: { forceSwap?: boolean; toDock?: boolean }
    ): Promise<{ success: boolean; error?: string }> => {
      const entry = entries.find((e) => Number(e.id) === Number(entryId));
      if (!entry) return { success: false, error: "Entry not found" };

      const isDockTarget = newDay === "DOCK" || newPeriod === 0 || options?.toDock;

      // Find if target slot is occupied by another entry in the same class
      let targetOccupant: TimetableEntry | undefined;
      if (!isDockTarget) {
        targetOccupant = entries.find(
          (e) =>
            Number(e.id) !== Number(entryId) &&
            !e.is_docked &&
            e.day !== "DOCK" &&
            Number(e.class_id) === Number(entry.class_id) &&
            String(e.day).trim().toLowerCase() === String(newDay).trim().toLowerCase() &&
            Number(e.period) === Number(newPeriod)
        );
      }

      const wasFromDock = Boolean(entry.is_docked || entry.day === "DOCK" || entry.period === 0);

      // Prepare updated entries list
      const updatedEntriesToSave: TimetableEntry[] = [];

      const updatedDraggedEntry: TimetableEntry = {
        ...entry,
        day: isDockTarget ? "DOCK" : newDay,
        period: isDockTarget ? 0 : newPeriod,
        is_docked: isDockTarget,
      };
      updatedEntriesToSave.push(updatedDraggedEntry);

      let updatedOccupantEntry: TimetableEntry | undefined;
      if (targetOccupant) {
        updatedOccupantEntry = {
          ...targetOccupant,
          day: wasFromDock ? "DOCK" : entry.day,
          period: wasFromDock ? 0 : entry.period,
          is_docked: wasFromDock,
        };
        updatedEntriesToSave.push(updatedOccupantEntry);
      }

      // Optimistic local state update (instant UI reaction)
      setEntries((prev) => {
        return prev.map((e) => {
          if (Number(e.id) === Number(entryId)) {
            return updatedDraggedEntry;
          }
          if (targetOccupant && Number(e.id) === Number(targetOccupant.id)) {
            return updatedOccupantEntry!;
          }
          return e;
        });
      });

      // Synchronize with Firestore backend
      setSyncStatus("syncing");
      try {
        await swapOrMoveTimetableEntriesCloud(updatedEntriesToSave);
        setSyncStatus("connected");
        setSyncError(null);
        return { success: true };
      } catch (err: any) {
        console.error("Free-form move save error:", err);
        setSyncStatus(navigator.onLine ? "connected" : "offline");
        return { success: true }; // Retain optimistic client update
      }
    },
    [entries]
  );

  // Direct deletion of an entry (from holding dock or timetable grid)
  const handleDeleteEntry = useCallback(
    async (entryId: number) => {
      setEntries((prev) => prev.filter((e) => Number(e.id) !== Number(entryId)));
      try {
        setSyncStatus("syncing");
        await deleteTimetableEntryCloud(entryId);
        setSyncStatus("connected");
      } catch (err) {
        console.error("Failed to delete entry:", err);
        setSyncStatus(navigator.onLine ? "connected" : "offline");
      }
    },
    []
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
      setSyncError(null);
    } catch (err: any) {
      console.error("Failed to save class to cloud:", err);
      if (err?.code === "permission-denied" || err?.message?.includes("permissions")) {
        setSyncError("permission-denied");
      }
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
    } catch (err: any) {
      console.error("Failed to delete class from cloud:", err);
      if (err?.code === "permission-denied" || err?.message?.includes("permissions")) {
        setSyncError("permission-denied");
      }
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
      setSyncError(null);
    } catch (err: any) {
      console.error("Failed to save subject to cloud:", err);
      if (err?.code === "permission-denied" || err?.message?.includes("permissions")) {
        setSyncError("permission-denied");
      }
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
    } catch (err: any) {
      console.error("Failed to delete subject from cloud:", err);
      if (err?.code === "permission-denied" || err?.message?.includes("permissions")) {
        setSyncError("permission-denied");
      }
      setSyncStatus(navigator.onLine ? "connected" : "offline");
    }
  }, []);

  // Staff CRUD with Cloud persistence, simultaneous Timetable slot force-overrides,
  // and cascading data cleanup on class/slot deletion
  const handleSaveStaff = useCallback(
    async (
      staff: Staff,
      scheduleSlots?: StaffScheduleSlot[],
      explicitDeletedEntryIds?: number[]
    ) => {
      // 1. Optimistically update staffList
      setStaffList((prev) => {
        const exists = prev.some((s) => s.id === staff.id);
        return exists ? prev.map((s) => (s.id === staff.id ? staff : s)) : [...prev, staff];
      });

      // 2. Filter schedule slots to only those for active assigned classes
      const validSlots = (scheduleSlots || []).filter((slot) =>
        staff.assigned_class_ids.includes(Number(slot.classId))
      );

      // Prepare Staff Assignments (only for active assigned classes)
      const assignmentsToSave: StaffAssignment[] = [];
      const currentAssignments = [...assignments];
      const seenPair = new Set<string>();

      validSlots.forEach((slot) => {
        const pairKey = `${staff.id}_${slot.classId}_${slot.subjectId}`;
        if (!seenPair.has(pairKey)) {
          seenPair.add(pairKey);
          let existingAsgn = currentAssignments.find(
            (a) =>
              Number(a.staff_id) === Number(staff.id) &&
              Number(a.class_id) === Number(slot.classId) &&
              Number(a.subject_id) === Number(slot.subjectId)
          );
          if (!existingAsgn) {
            existingAsgn = {
              id: Date.now() + Math.floor(Math.random() * 10000),
              staff_id: staff.id,
              class_id: slot.classId,
              subject_id: slot.subjectId,
            };
          }
          assignmentsToSave.push(existingAsgn);
        }
      });

      // Find any assignments for this teacher that belong to removed/unselected classes
      const assignmentsToDelete: number[] = [];
      currentAssignments.forEach((a) => {
        if (
          Number(a.staff_id) === Number(staff.id) &&
          !staff.assigned_class_ids.includes(Number(a.class_id))
        ) {
          assignmentsToDelete.push(a.id);
        }
      });

      // Update assignments local state
      setAssignments((prev) => {
        let updated = prev.filter((a) => !assignmentsToDelete.includes(a.id));
        assignmentsToSave.forEach((asgn) => {
          const idx = updated.findIndex((a) => a.id === asgn.id);
          if (idx >= 0) {
            updated[idx] = asgn;
          } else {
            updated.push(asgn);
          }
        });
        return updated;
      });

      // 3. Prepare Timetable Entries with Force-Override Support & Cascading Deletions
      const classMap = new Map(classes.map((c) => [c.id, c]));
      const newEntriesToSave: TimetableEntry[] = [];
      const evictedEntryIds: number[] = [];

      // Include explicit deleted entry IDs from component
      if (explicitDeletedEntryIds && explicitDeletedEntryIds.length > 0) {
        explicitDeletedEntryIds.forEach((id) => {
          if (!evictedEntryIds.includes(id)) {
            evictedEntryIds.push(id);
          }
        });
      }

      validSlots.forEach((slot, index) => {
        const isDock = slot.day === "DOCK" || slot.period === 0;
        const targetClass = classMap.get(slot.classId);
        const entryId =
          slot.id ||
          Date.now() + index * 10 + Math.floor(Math.random() * 1000);

        const newEntry: TimetableEntry = {
          id: entryId,
          class_id: slot.classId,
          subject_id: slot.subjectId,
          staff_id: staff.id,
          day: isDock ? "DOCK" : slot.day,
          period: isDock ? 0 : slot.period,
          room_number: targetClass?.room_number || "",
          is_docked: isDock,
          is_manual: true,
        };

        newEntriesToSave.push(newEntry);
      });

      // Scan all existing entries in the grid for cascading cleanup and collision overrides
      entries.forEach((e) => {
        if (!e) return;

        // A. If this entry belonged to this staff member:
        if (Number(e.staff_id) === Number(staff.id)) {
          // If the entry's class was unselected/removed, OR this slot is no longer retained in newEntriesToSave:
          const isClassStillAssigned = staff.assigned_class_ids.includes(Number(e.class_id));
          const isSlotRetained = newEntriesToSave.some((ne) => Number(ne.id) === Number(e.id));
          if (!isClassStillAssigned || (!isSlotRetained && !e.is_docked && e.day !== "DOCK")) {
            if (!evictedEntryIds.includes(e.id)) {
              evictedEntryIds.push(e.id);
            }
          }
        }

        // B. Check if another entry in the class/period is overwritten by this teacher's new slots
        const isOverwritten = newEntriesToSave.some(
          (ne) =>
            !ne.is_docked &&
            ne.day !== "DOCK" &&
            Number(ne.period) > 0 &&
            Number(ne.class_id) === Number(e.class_id) &&
            String(ne.day).trim().toLowerCase() === String(e.day).trim().toLowerCase() &&
            Number(ne.period) === Number(e.period) &&
            Number(ne.id) !== Number(e.id)
        );

        if (isOverwritten) {
          if (!evictedEntryIds.includes(e.id)) {
            evictedEntryIds.push(e.id);
          }
        }
      });

      // 4. Optimistically update entries in local UI state simultaneously
      setEntries((prev) => {
        // Remove all evicted/unselected entries
        let filtered = prev.filter((e) => !evictedEntryIds.includes(e.id));

        // Upsert newEntriesToSave
        newEntriesToSave.forEach((ne) => {
          const idx = filtered.findIndex((e) => Number(e.id) === Number(ne.id));
          if (idx >= 0) {
            filtered[idx] = ne;
          } else {
            filtered.push(ne);
          }
        });

        return filtered;
      });

      // 5. Persist atomically to Cloud Firestore
      try {
        setSyncStatus("syncing");
        await saveStaffWithSchedulesAtomicCloud(
          staff,
          assignmentsToSave,
          newEntriesToSave,
          evictedEntryIds,
          assignmentsToDelete
        );
        setSyncStatus("connected");
        setSyncError(null);
      } catch (err: any) {
        console.error("Failed to atomic-save staff and schedules to cloud:", err);
        if (err?.code === "permission-denied" || err?.message?.includes("permissions")) {
          setSyncError("permission-denied");
        }
        setSyncStatus(navigator.onLine ? "connected" : "offline");
      }
    },
    [assignments, classes, entries]
  );

  // Global Cascading Erasure: Immediately purge all scheduled periods and assignments
  // for a specific teacher-class pairing across all state locations (Staff Form, Class Timetable, Staff Timetable)
  // and sync to Cloud Firestore atomically
  const handleRemoveStaffClass = useCallback(
    async (staffId: number, classId: number) => {
      // 1. Immediately update global timetable entries state
      setEntries((prev) =>
        prev.filter(
          (e) => !(Number(e.staff_id) === Number(staffId) && Number(e.class_id) === Number(classId))
        )
      );

      // 2. Immediately update staff assignments state
      setAssignments((prev) =>
        prev.filter(
          (a) => !(Number(a.staff_id) === Number(staffId) && Number(a.class_id) === Number(classId))
        )
      );

      // 3. Update staffList assigned_class_ids for this teacher
      let updatedAssignedClassIds: number[] = [];
      setStaffList((prev) =>
        prev.map((s) => {
          if (Number(s.id) === Number(staffId)) {
            const nextClassIds = (s.assigned_class_ids || []).filter(
              (cId) => Number(cId) !== Number(classId)
            );
            updatedAssignedClassIds = nextClassIds;
            return {
              ...s,
              assigned_class_ids: nextClassIds,
            };
          }
          return s;
        })
      );

      // 4. Atomically sync the erasure to Cloud Firestore
      try {
        setSyncStatus("syncing");
        await removeStaffClassCloud(staffId, classId, updatedAssignedClassIds);
        setSyncStatus("connected");
        setSyncError(null);
      } catch (err: any) {
        console.error("Failed to execute global cascading class removal in cloud:", err);
        if (err?.code === "permission-denied" || err?.message?.includes("permissions")) {
          setSyncError("permission-denied");
        }
        setSyncStatus(navigator.onLine ? "connected" : "offline");
      }
    },
    []
  );

  const handleDeleteStaff = useCallback(async (staffId: number) => {
    try {
      setSyncStatus("syncing");
      // Explicitly invoke the asynchronous database command
      await deleteDoc(doc(db, "staff", String(staffId)));
      // Ensure the local React UI state updates only after the database returns a successful promise response
      setStaffList((prev) => prev.filter((s) => s.id !== staffId));
      setAssignments((prev) => prev.filter((a) => a.staff_id !== staffId));
      setEntries((prev) => prev.filter((e) => e.staff_id !== staffId));
      setSyncStatus("connected");
      setSyncError(null);
    } catch (err: any) {
      console.error("Failed to delete staff from cloud:", err);
      setSyncStatus(navigator.onLine ? "connected" : "offline");
      if (err?.code === "permission-denied" || err?.message?.includes("permissions")) {
        setSyncError("permission-denied");
      }
      throw err;
    }
  }, []);

  // Assignment CRUD with Cloud persistence and simultaneous Timetable slot population
  const handleSaveAssignment = useCallback(
    async (
      asgn: StaffAssignment,
      slot?: { day: string; period: number; toDock?: boolean }
    ) => {
      setAssignments((prev) => {
        const exists = prev.some((a) => a.id === asgn.id);
        return exists ? prev.map((a) => (a.id === asgn.id ? asgn : a)) : [...prev, asgn];
      });

      try {
        setSyncStatus("syncing");
        await saveAssignmentCloud(asgn);

        // If direct Target Class, Day, and Period are specified, populate TimetableEntry simultaneously
        if (slot && slot.day && (slot.period > 0 || slot.day === "DOCK" || slot.toDock)) {
          const isDock = slot.day === "DOCK" || slot.toDock || slot.period === 0;
          const targetClass = classes.find((c) => Number(c.id) === Number(asgn.class_id));

          const newEntry: TimetableEntry = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            class_id: asgn.class_id,
            staff_id: asgn.staff_id,
            subject_id: asgn.subject_id,
            day: isDock ? "DOCK" : slot.day,
            period: isDock ? 0 : slot.period,
            room_number: targetClass?.room_number || "",
            is_docked: isDock,
          };

          // Optimistically update entries in both Class Timetable and Staff Timetable
          setEntries((prev) => {
            if (isDock) {
              return [...prev, newEntry];
            }
            // If the slot in that class was already occupied, replace it or push existing to dock
            const filtered = prev.filter(
              (e) =>
                !(
                  Number(e.class_id) === Number(asgn.class_id) &&
                  String(e.day).trim().toLowerCase() === String(slot.day).trim().toLowerCase() &&
                  Number(e.period) === Number(slot.period)
                )
            );
            return [...filtered, newEntry];
          });

          await saveSingleTimetableEntryCloud(newEntry);
        }

        setSyncStatus("connected");
        setSyncError(null);
      } catch (err: any) {
        console.error("Failed to save assignment to cloud:", err);
        if (err?.code === "permission-denied" || err?.message?.includes("permissions")) {
          setSyncError("permission-denied");
        }
        setSyncStatus(navigator.onLine ? "connected" : "offline");
      }
    },
    [classes]
  );

  const handleDeleteAssignment = useCallback(async (asgnId: number) => {
    setAssignments((prev) => prev.filter((a) => a.id !== asgnId));
    try {
      setSyncStatus("syncing");
      await deleteAssignmentCloud(asgnId);
      setSyncStatus("connected");
    } catch (err: any) {
      console.error("Failed to delete assignment from cloud:", err);
      if (err?.code === "permission-denied" || err?.message?.includes("permissions")) {
        setSyncError("permission-denied");
      }
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
      setSyncError(null);
    } catch (err: any) {
      console.error("Failed to save timings to cloud:", err);
      if (err?.code === "permission-denied" || err?.message?.includes("permissions")) {
        setSyncError("permission-denied");
      }
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
                id: Math.floor(Date.now() + Math.random() * 1000),
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
          onOpenRulesModal={() => setShowRulesModal(true)}
        />

        {/* Firestore Security Rules / Cloud Sync Notice Banner */}
        {syncError === "permission-denied" && (
          <div
            id="firestore-permission-banner"
            className="flex items-center justify-between border-b border-amber-300 bg-amber-50 px-6 py-2.5 text-xs text-amber-900 shadow-xs"
          >
            <div className="flex items-center space-x-2.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              <span>
                <strong>Cloud Sync Notice:</strong> To ensure data is permanently saved across browser reloads, publish the Firestore security rules in your Firebase Console. Local data is safely retained on this device.
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                id="btn-open-rules-guide"
                onClick={() => setShowRulesModal(true)}
                className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 transition-colors cursor-pointer"
              >
                View Rules Guide (1 Click)
              </button>
              <button
                id="btn-dismiss-rules-banner"
                onClick={() => setSyncError(null)}
                className="text-amber-700 hover:text-amber-950 px-1 py-0.5 text-sm font-bold cursor-pointer"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}

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
                onDeleteEntry={handleDeleteEntry}
                onAddEntry={(entry) => {
                  setEntries((prev) => [...prev, entry]);
                  saveSingleTimetableEntryCloud(entry);
                }}
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
                entries={entries}
                timings={timings}
                assignments={assignments}
                onSaveStaff={handleSaveStaff}
                onDeleteStaff={handleDeleteStaff}
                onRemoveStaffClass={handleRemoveStaffClass}
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
                timings={timings}
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

      {/* Firestore Rules & Persistence Diagnostic Modal */}
      <FirestoreRulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        syncErrorType={syncError}
      />
    </div>
  );
}
