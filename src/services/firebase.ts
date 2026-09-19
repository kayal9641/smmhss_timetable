import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import appletConfig from "../../firebase-applet-config.json";

const getEnv = (key: string): string | undefined => {
  try {
    return (typeof import.meta !== "undefined" && (import.meta as any).env?.[key]) || undefined;
  } catch {
    return undefined;
  }
};

const firebaseConfig = {
  apiKey: getEnv("VITE_FIREBASE_API_KEY") || appletConfig.apiKey,
  authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN") || appletConfig.authDomain,
  projectId: getEnv("VITE_FIREBASE_PROJECT_ID") || appletConfig.projectId,
  storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET") || appletConfig.storageBucket,
  messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID") || appletConfig.messagingSenderId,
  appId: getEnv("VITE_FIREBASE_APP_ID") || appletConfig.appId,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
// Use the database ID from firebase-applet-config.json if provisioned by the platform,
// otherwise automatically default to the standard default Firestore database without requiring an environment variable.
const databaseId = appletConfig.firestoreDatabaseId;

const db =
  databaseId && databaseId !== "(default)" && databaseId.trim() !== ""
    ? getFirestore(app, databaseId)
    : getFirestore(app);

export { app, auth, db };
