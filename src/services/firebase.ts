import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  doc,
  getDocFromServer,
} from "firebase/firestore";
import appletConfig from "../../firebase-applet-config.json";

// In Google AI Studio, the application is provisioned with appletConfig.
// The authoritative project is appletConfig.projectId ("vibrant-calling-x8chg")
// and the Firestore database is appletConfig.firestoreDatabaseId ("ai-studio-srimahalakshmima-c1531da8-a003-4311-bcb3-7153b99a3c9b").
export const firebaseConfig = {
  apiKey: appletConfig.apiKey,
  authDomain: appletConfig.authDomain,
  projectId: appletConfig.projectId,
  storageBucket: appletConfig.storageBucket,
  messagingSenderId: appletConfig.messagingSenderId,
  appId: appletConfig.appId,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const projectId = appletConfig.projectId;
const databaseId = appletConfig.firestoreDatabaseId;

// Initialize Firestore with persistent IndexedDB local cache for seamless reload persistence
let db: ReturnType<typeof getFirestore>;
try {
  if (databaseId && databaseId !== "(default)" && databaseId.trim() !== "") {
    db = initializeFirestore(
      app,
      { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) },
      databaseId
    );
  } else {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  }
} catch {
  db =
    databaseId && databaseId !== "(default)" && databaseId.trim() !== ""
      ? getFirestore(app, databaseId)
      : getFirestore(app);
}

// Validate connection to Firestore on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, "school_timings", "main"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("Firestore client is offline, relying on IndexedDB persistent cache.");
    }
  }
}

const isAiStudioProject = true;

testConnection();

export { app, auth, db, projectId, databaseId, isAiStudioProject };

