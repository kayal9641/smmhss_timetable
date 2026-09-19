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
import { auth, db } from "./firebase";
import {
  SchoolClass,
  Subject,
  Staff,
  StaffAssignment,
  TimetableEntry,
  SchoolTimings,
  UserProfile,
} from "../types";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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
    (err) => {
      onError?.(err);
      try {
        handleFirestoreError(err, OperationType.GET, TIMINGS_DOC);
      } catch {
        // logged via handleFirestoreError
      }
    }
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
    (err) => {
      onError?.(err);
      try {
        handleFirestoreError(err, OperationType.LIST, CLASSES_COL);
      } catch {
        // logged via handleFirestoreError
      }
    }
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
    (err) => {
      onError?.(err);
      try {
        handleFirestoreError(err, OperationType.LIST, SUBJECTS_COL);
      } catch {
        // logged via handleFirestoreError
      }
    }
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
    (err) => {
      onError?.(err);
      try {
        handleFirestoreError(err, OperationType.LIST, STAFF_COL);
      } catch {
        // logged via handleFirestoreError
      }
    }
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
    (err) => {
      onError?.(err);
      try {
        handleFirestoreError(err, OperationType.LIST, ASSIGNMENTS_COL);
      } catch {
        // logged via handleFirestoreError
      }
    }
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
    (err) => {
      onError?.(err);
      try {
        handleFirestoreError(err, OperationType.LIST, ENTRIES_COL);
      } catch {
        // logged via handleFirestoreError
      }
    }
  );
}

// -------------------------------------------------------------
// Data Sanitizers to prevent "Unsupported field value: undefined"
// -------------------------------------------------------------

/**
 * Deep sanitization function that cleans any object or array before writing to Firestore:
 * 1. Recursively traverses objects and arrays.
 * 2. Omits any key whose value is undefined.
 * 3. Never allows `undefined` to reach Firestore.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }

  if (typeof data === "object") {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value === undefined) {
        continue; // omit undefined keys completely
      } else if (value !== null && typeof value === "object") {
        cleaned[key] = sanitizeForFirestore(value);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned as T;
  }

  return data;
}

/**
 * Sanitizes a Staff object ensuring all optional fields default to safe empty strings
 * or empty arrays instead of undefined.
 */
export function sanitizeStaff(staff: Staff): Record<string, any> {
  const cleaned: Record<string, any> = {
    id: Number(staff.id),
    name: staff.name?.trim() || "",
    employee_id: staff.employee_id?.trim() || "",
    email: staff.email?.trim() || "",
    phone: staff.phone?.trim() || "",
    max_periods_per_day: Number(staff.max_periods_per_day ?? 6),
    max_periods_per_week: Number(staff.max_periods_per_week ?? 26),
    qualified_subject_ids: Array.isArray(staff.qualified_subject_ids)
      ? staff.qualified_subject_ids.map(Number)
      : [],
    assigned_class_ids: Array.isArray(staff.assigned_class_ids)
      ? staff.assigned_class_ids.map(Number)
      : [],
    unavailabilities: (staff.unavailabilities || []).map((u) => ({
      day: u.day || "",
      period: Number(u.period),
      reason: u.reason?.trim() || "",
    })),
  };
  return sanitizeForFirestore(cleaned);
}

/**
 * Sanitizes a SchoolClass object ensuring optional fields default to safe values.
 */
export function sanitizeClass(schoolClass: SchoolClass): Record<string, any> {
  const cleaned: Record<string, any> = {
    id: Number(schoolClass.id),
    name: schoolClass.name?.trim() || "",
    grade: schoolClass.grade?.trim() || "",
    section: schoolClass.section?.trim() || "",
    room_number: schoolClass.room_number?.trim() || "",
    subjects: (schoolClass.subjects || []).map((s) => ({
      subject_id: Number(s.subject_id),
      periods_per_week: Number(s.periods_per_week),
    })),
  };
  return sanitizeForFirestore(cleaned);
}

/**
 * Sanitizes a Subject object.
 */
export function sanitizeSubject(subject: Subject): Record<string, any> {
  const cleaned: Record<string, any> = {
    id: Number(subject.id),
    name: subject.name?.trim() || "",
    code: subject.code?.trim() || "",
    color: subject.color || "#0d9488",
    icon: subject.icon || "BookOpen",
    category: subject.category || "STEM",
    requires_consecutive: Boolean(subject.requires_consecutive),
    default_periods_per_week: Number(subject.default_periods_per_week ?? 5),
  };
  return sanitizeForFirestore(cleaned);
}

/**
 * Sanitizes a StaffAssignment object.
 */
export function sanitizeAssignment(assignment: StaffAssignment): Record<string, any> {
  const cleaned: Record<string, any> = {
    id: Number(assignment.id),
    staff_id: Number(assignment.staff_id),
    subject_id: Number(assignment.subject_id),
    class_id: Number(assignment.class_id),
  };
  return sanitizeForFirestore(cleaned);
}

/**
 * Sanitizes a TimetableEntry object.
 */
export function sanitizeTimetableEntry(entry: TimetableEntry): Record<string, any> {
  const cleaned: Record<string, any> = {
    id: Number(entry.id),
    day: entry.day || "",
    period: Number(entry.period),
    class_id: Number(entry.class_id),
    subject_id: Number(entry.subject_id),
    staff_id: Number(entry.staff_id),
    room_number: entry.room_number?.trim() || "",
  };
  return sanitizeForFirestore(cleaned);
}

/**
 * Sanitizes SchoolTimings object.
 */
export function sanitizeSchoolTimings(timings: SchoolTimings): Record<string, any> {
  const cleaned: Record<string, any> = {
    school_name: timings.school_name?.trim() || "Sri Mahalakshmi Higher Secondary School",
    academic_year: timings.academic_year?.trim() || "2025-2026",
    start_time: timings.start_time || "09:10",
    end_time: timings.end_time || "16:00",
    period_duration_minutes: Number(timings.period_duration_minutes ?? 40),
    total_periods: Number(timings.total_periods ?? 8),
    lunch_start: timings.lunch_start || "12:20",
    lunch_end: timings.lunch_end || "13:00",
    break1_start: timings.break1_start || "10:50",
    break1_end: timings.break1_end || "11:00",
    break2_start: timings.break2_start || "14:50",
    break2_end: timings.break2_end || "15:00",
    active_days: Array.isArray(timings.active_days)
      ? timings.active_days
      : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  };
  return sanitizeForFirestore(cleaned);
}

/**
 * Sanitizes UserProfile object.
 */
export function sanitizeUserProfile(profile: UserProfile): Record<string, any> {
  const cleaned: Record<string, any> = {
    uid: profile.uid || "",
    email: profile.email?.trim() || "",
    displayName: profile.displayName?.trim() || "",
    role: profile.role || "staff",
    createdAt: profile.createdAt || new Date().toISOString(),
    lastLogin: profile.lastLogin || new Date().toISOString(),
  };
  return sanitizeForFirestore(cleaned);
}

// -------------------------------------------------------------
// CRUD Operations with Firestore Cloud Persistence
// -------------------------------------------------------------

export async function saveSchoolTimingsCloud(timings: SchoolTimings): Promise<void> {
  const docRef = doc(db, TIMINGS_DOC);
  const data = sanitizeSchoolTimings(timings);
  try {
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, TIMINGS_DOC);
  }
}

export async function saveClassCloud(schoolClass: SchoolClass): Promise<void> {
  const docRef = doc(db, CLASSES_COL, String(schoolClass.id));
  const data = sanitizeClass(schoolClass);
  try {
    await setDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${CLASSES_COL}/${schoolClass.id}`);
  }
}

export async function deleteClassCloud(classId: number): Promise<void> {
  const docRef = doc(db, CLASSES_COL, String(classId));
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${CLASSES_COL}/${classId}`);
  }
}

export async function saveSubjectCloud(subject: Subject): Promise<void> {
  const docRef = doc(db, SUBJECTS_COL, String(subject.id));
  const data = sanitizeSubject(subject);
  try {
    await setDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${SUBJECTS_COL}/${subject.id}`);
  }
}

export async function deleteSubjectCloud(subjectId: number): Promise<void> {
  const docRef = doc(db, SUBJECTS_COL, String(subjectId));
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${SUBJECTS_COL}/${subjectId}`);
  }
}

export async function saveStaffCloud(staff: Staff): Promise<void> {
  const docRef = doc(db, STAFF_COL, String(staff.id));
  const data = sanitizeStaff(staff);
  try {
    await setDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${STAFF_COL}/${staff.id}`);
  }
}

export async function deleteStaffCloud(staffId: number): Promise<void> {
  const docRef = doc(db, STAFF_COL, String(staffId));
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${STAFF_COL}/${staffId}`);
  }
}

export async function saveAssignmentCloud(assignment: StaffAssignment): Promise<void> {
  const docRef = doc(db, ASSIGNMENTS_COL, String(assignment.id));
  const data = sanitizeAssignment(assignment);
  try {
    await setDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${ASSIGNMENTS_COL}/${assignment.id}`);
  }
}

export async function deleteAssignmentCloud(assignmentId: number): Promise<void> {
  const docRef = doc(db, ASSIGNMENTS_COL, String(assignmentId));
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${ASSIGNMENTS_COL}/${assignmentId}`);
  }
}

export async function saveBatchAssignmentsCloud(assignments: StaffAssignment[]): Promise<void> {
  try {
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
      currentBatch.set(docRef, sanitizeAssignment(asgn));
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
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, ASSIGNMENTS_COL);
  }
}

/**
 * Saves generated timetable entries to Firestore in batches
 */
export async function saveTimetableEntriesCloud(entries: TimetableEntry[]): Promise<void> {
  try {
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
      currentBatch.set(docRef, sanitizeTimetableEntry(entry));
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
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, ENTRIES_COL);
  }
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
  const data = sanitizeUserProfile(profile);
  try {
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${USERS_COL}/${profile.uid}`);
  }
}

export async function checkIfFirstUser(): Promise<boolean> {
  const snap = await getDocs(collection(db, USERS_COL));
  return snap.empty;
}
