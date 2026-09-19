import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  writeBatch,
  query,
  getDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  SchoolClass,
  Subject,
  Staff,
  StaffAssignment,
  TimetableEntry,
  SchoolTimings,
  UserProfile,
} from "../types";

// Collection references
const TIMINGS_DOC = "school_timings/main";
const CLASSES_COL = "classes";
const SUBJECTS_COL = "subjects";
const STAFF_COL = "staff";
const ASSIGNMENTS_COL = "assignments";
const ENTRIES_COL = "timetable_entries";
const USERS_COL = "users";

/**
 * Real-time listener for School Timings
 */
export function subscribeToTimings(
  onUpdate: (timings: SchoolTimings | null) => void,
  onError?: (err: Error) => void
) {
  const docRef = doc(db, TIMINGS_DOC);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as SchoolTimings);
      } else {
        onUpdate(null);
      }
    },
    (err) => onError?.(err)
  );
}

/**
 * Real-time listener for Classes
 */
export function subscribeToClasses(
  onUpdate: (classes: SchoolClass[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, CLASSES_COL);
  return onSnapshot(
    colRef,
    (snap) => {
      const list: SchoolClass[] = [];
      snap.forEach((d) => list.push(d.data() as SchoolClass));
      list.sort((a, b) => a.id - b.id);
      onUpdate(list);
    },
    (err) => onError?.(err)
  );
}

/**
 * Real-time listener for Subjects
 */
export function subscribeToSubjects(
  onUpdate: (subjects: Subject[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, SUBJECTS_COL);
  return onSnapshot(
    colRef,
    (snap) => {
      const list: Subject[] = [];
      snap.forEach((d) => list.push(d.data() as Subject));
      list.sort((a, b) => a.id - b.id);
      onUpdate(list);
    },
    (err) => onError?.(err)
  );
}

/**
 * Real-time listener for Staff Members
 */
export function subscribeToStaff(
  onUpdate: (staff: Staff[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, STAFF_COL);
  return onSnapshot(
    colRef,
    (snap) => {
      const list: Staff[] = [];
      snap.forEach((d) => list.push(d.data() as Staff));
      list.sort((a, b) => a.id - b.id);
      onUpdate(list);
    },
    (err) => onError?.(err)
  );
}

/**
 * Real-time listener for Staff Assignments
 */
export function subscribeToAssignments(
  onUpdate: (assignments: StaffAssignment[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, ASSIGNMENTS_COL);
  return onSnapshot(
    colRef,
    (snap) => {
      const list: StaffAssignment[] = [];
      snap.forEach((d) => list.push(d.data() as StaffAssignment));
      list.sort((a, b) => a.id - b.id);
      onUpdate(list);
    },
    (err) => onError?.(err)
  );
}

/**
 * Real-time listener for Timetable Entries
 */
export function subscribeToTimetableEntries(
  onUpdate: (entries: TimetableEntry[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, ENTRIES_COL);
  return onSnapshot(
    colRef,
    (snap) => {
      const list: TimetableEntry[] = [];
      snap.forEach((d) => list.push(d.data() as TimetableEntry));
      list.sort((a, b) => a.id - b.id);
      onUpdate(list);
    },
    (err) => onError?.(err)
  );
}

// -------------------------------------------------------------
// CRUD Operations with Firestore Cloud Persistence
// -------------------------------------------------------------

export async function saveSchoolTimingsCloud(timings: SchoolTimings): Promise<void> {
  const docRef = doc(db, TIMINGS_DOC);
  await setDoc(docRef, timings, { merge: true });
}

export async function saveClassCloud(schoolClass: SchoolClass): Promise<void> {
  const docRef = doc(db, CLASSES_COL, String(schoolClass.id));
  await setDoc(docRef, schoolClass);
}

export async function deleteClassCloud(classId: number): Promise<void> {
  const docRef = doc(db, CLASSES_COL, String(classId));
  await deleteDoc(docRef);
}

export async function saveSubjectCloud(subject: Subject): Promise<void> {
  const docRef = doc(db, SUBJECTS_COL, String(subject.id));
  await setDoc(docRef, subject);
}

export async function deleteSubjectCloud(subjectId: number): Promise<void> {
  const docRef = doc(db, SUBJECTS_COL, String(subjectId));
  await deleteDoc(docRef);
}

export async function saveStaffCloud(staff: Staff): Promise<void> {
  const docRef = doc(db, STAFF_COL, String(staff.id));
  await setDoc(docRef, staff);
}

export async function deleteStaffCloud(staffId: number): Promise<void> {
  const docRef = doc(db, STAFF_COL, String(staffId));
  await deleteDoc(docRef);
}

export async function saveAssignmentCloud(assignment: StaffAssignment): Promise<void> {
  const docRef = doc(db, ASSIGNMENTS_COL, String(assignment.id));
  await setDoc(docRef, assignment);
}

export async function deleteAssignmentCloud(assignmentId: number): Promise<void> {
  const docRef = doc(db, ASSIGNMENTS_COL, String(assignmentId));
  await deleteDoc(docRef);
}

export async function saveBatchAssignmentsCloud(assignments: StaffAssignment[]): Promise<void> {
  // Clear old assignments then write in batches
  const snap = await getDocs(collection(db, ASSIGNMENTS_COL));
  const batchSize = 400;
  
  // Delete existing
  const deleteBatches: Promise<void>[] = [];
  let currentBatch = writeBatch(db);
  let count = 0;
  snap.forEach((d) => {
    currentBatch.delete(d.ref);
    count++;
    if (count % batchSize === 0) {
      deleteBatches.push(currentBatch.commit());
      currentBatch = writeBatch(db);
    }
  });
  if (count % batchSize !== 0) {
    deleteBatches.push(currentBatch.commit());
  }
  await Promise.all(deleteBatches);

  // Write new
  const writeBatches: Promise<void>[] = [];
  currentBatch = writeBatch(db);
  count = 0;
  assignments.forEach((asgn) => {
    const docRef = doc(db, ASSIGNMENTS_COL, String(asgn.id));
    currentBatch.set(docRef, asgn);
    count++;
    if (count % batchSize === 0) {
      writeBatches.push(currentBatch.commit());
      currentBatch = writeBatch(db);
    }
  });
  if (count % batchSize !== 0) {
    writeBatches.push(currentBatch.commit());
  }
  await Promise.all(writeBatches);
}

/**
 * Saves generated timetable entries to Firestore in batches
 */
export async function saveTimetableEntriesCloud(entries: TimetableEntry[]): Promise<void> {
  // Delete existing entries
  const snap = await getDocs(collection(db, ENTRIES_COL));
  const batchSize = 400;

  const deleteBatches: Promise<void>[] = [];
  let currentBatch = writeBatch(db);
  let count = 0;
  snap.forEach((d) => {
    currentBatch.delete(d.ref);
    count++;
    if (count % batchSize === 0) {
      deleteBatches.push(currentBatch.commit());
      currentBatch = writeBatch(db);
    }
  });
  if (count % batchSize !== 0) {
    deleteBatches.push(currentBatch.commit());
  }
  await Promise.all(deleteBatches);

  // Write new entries
  const writeBatches: Promise<void>[] = [];
  currentBatch = writeBatch(db);
  count = 0;
  entries.forEach((entry) => {
    const docRef = doc(db, ENTRIES_COL, String(entry.id));
    currentBatch.set(docRef, entry);
    count++;
    if (count % batchSize === 0) {
      writeBatches.push(currentBatch.commit());
      currentBatch = writeBatch(db);
    }
  });
  if (count % batchSize !== 0) {
    writeBatches.push(currentBatch.commit());
  }
  await Promise.all(writeBatches);
}

/**
 * Clears all timetable entries from Firestore
 */
export async function clearTimetableEntriesCloud(): Promise<void> {
  const snap = await getDocs(collection(db, ENTRIES_COL));
  const batchSize = 400;
  const deleteBatches: Promise<void>[] = [];
  let currentBatch = writeBatch(db);
  let count = 0;
  snap.forEach((d) => {
    currentBatch.delete(d.ref);
    count++;
    if (count % batchSize === 0) {
      deleteBatches.push(currentBatch.commit());
      currentBatch = writeBatch(db);
    }
  });
  if (count % batchSize !== 0) {
    deleteBatches.push(currentBatch.commit());
  }
  await Promise.all(deleteBatches);
}

/**
 * Real-time conflict protection transaction for moving/updating a timetable slot:
 * Atomically checks latest timetable_entries in Firestore to guarantee:
 * 1. Target slot has no class conflict
 * 2. Target slot has no teacher conflict
 * 3. Commits the moved slot safely preventing race conditions
 */
export async function moveTimetableSlotTransactionCloud(
  entryId: number,
  targetDay: string,
  targetPeriod: number,
  classMap: Map<number, SchoolClass>,
  staffMap: Map<number, Staff>
): Promise<{ success: boolean; error?: string }> {
  try {
    await runTransaction(db, async (transaction) => {
      const entriesSnap = await getDocs(collection(db, ENTRIES_COL));
      const targetDocRef = doc(db, ENTRIES_COL, String(entryId));
      const targetDocSnap = await transaction.get(targetDocRef);

      if (!targetDocSnap.exists()) {
        throw new Error("This timetable entry no longer exists in the cloud database.");
      }

      const currentEntry = targetDocSnap.data() as TimetableEntry;

      // Check all entries for collision on target Day & Period
      let classCollision: TimetableEntry | null = null;
      let teacherCollision: TimetableEntry | null = null;

      entriesSnap.forEach((d) => {
        const entry = d.data() as TimetableEntry;
        if (entry.id === entryId) return; // ignore self
        if (entry.day === targetDay && entry.period === targetPeriod) {
          if (entry.class_id === currentEntry.class_id) {
            classCollision = entry;
          }
          if (entry.staff_id === currentEntry.staff_id) {
            teacherCollision = entry;
          }
        }
      });

      if (classCollision) {
        const clsName = classMap.get(currentEntry.class_id)?.name || `Class #${currentEntry.class_id}`;
        throw new Error(
          `Conflict: ${clsName} already has a lesson scheduled on ${targetDay} Period ${targetPeriod} by another user.`
        );
      }

      if (teacherCollision) {
        const staffName = staffMap.get(currentEntry.staff_id)?.name || `Teacher #${currentEntry.staff_id}`;
        throw new Error(
          `Conflict: ${staffName} is already assigned to teach another class on ${targetDay} Period ${targetPeriod}.`
        );
      }

      // Check teacher unavailability
      const staff = staffMap.get(currentEntry.staff_id);
      if (staff?.unavailabilities) {
        const isUnavail = staff.unavailabilities.some(
          (u) => u.day === targetDay && u.period === targetPeriod
        );
        if (isUnavail) {
          throw new Error(
            `Conflict: ${staff.name} is marked as unavailable on ${targetDay} Period ${targetPeriod}.`
          );
        }
      }

      // Safe to commit
      transaction.update(targetDocRef, {
        day: targetDay,
        period: targetPeriod,
      });
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to move timetable slot." };
  }
}

// -------------------------------------------------------------
// User Profile & Roles in Firestore
// -------------------------------------------------------------

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const docRef = doc(db, USERS_COL, uid);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return snap.data() as UserProfile;
  }
  return null;
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const docRef = doc(db, USERS_COL, profile.uid);
  await setDoc(docRef, profile, { merge: true });
}

export async function checkIfFirstUser(): Promise<boolean> {
  const snap = await getDocs(collection(db, USERS_COL));
  return snap.empty;
}
