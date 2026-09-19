import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { auth } from "../services/firebase";
import { getUserProfile, saveUserProfile, checkIfFirstUser } from "../services/firebaseService";
import { UserProfile, UserRole } from "../types";
import { ShieldCheck, LogIn, UserPlus, LogOut, AlertCircle, CheckCircle2, X } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  userProfile: UserProfile | null;
  onProfileUpdated: (profile: UserProfile | null) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  userProfile,
  onProfileUpdated,
}) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [requestedRole, setRequestedRole] = useState<UserRole>("admin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (isRegistering) {
        if (!email.trim() || !password.trim()) {
          throw new Error("Please enter both email and password.");
        }
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }

        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const isFirst = await checkIfFirstUser();
        // First user is automatically Admin
        const role: UserRole = isFirst ? "admin" : requestedRole;

        const profile: UserProfile = {
          uid: cred.user.uid,
          email: cred.user.email || email.trim(),
          displayName: displayName.trim() || (email.split("@")[0] || "User"),
          role: role,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        };

        await saveUserProfile(profile);
        onProfileUpdated(profile);
        setSuccessMessage(`Account created successfully as ${role.toUpperCase()}!`);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        let profile = await getUserProfile(cred.user.uid);
        if (!profile) {
          // If no profile document yet, create one
          profile = {
            uid: cred.user.uid,
            email: cred.user.email || email.trim(),
            displayName: cred.user.email?.split("@")[0] || "User",
            role: "admin", // Default to admin for initial school setup
            lastLogin: new Date().toISOString(),
          };
          await saveUserProfile(profile);
        } else {
          await saveUserProfile({ ...profile, lastLogin: new Date().toISOString() });
        }
        onProfileUpdated(profile);
        setSuccessMessage(`Logged in successfully!`);
        setTimeout(() => {
          onClose();
        }, 800);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let msg = err.message || "Authentication failed.";
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        msg = "Invalid email or password. Please try again.";
      } else if (err.code === "auth/email-already-in-use") {
        msg = "This email is already registered. Please switch to Sign In.";
      } else if (err.code === "auth/weak-password") {
        msg = "Password should be at least 6 characters.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      onProfileUpdated(null);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to log out.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          title="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {currentUser ? "Account Profile" : isRegistering ? "Create School Account" : "Sign In"}
            </h2>
            <p className="text-xs text-slate-500">
              Firebase Authentication • Sri Mahalakshmi Matric Hr.Sec.School
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center space-x-2 rounded-xl bg-rose-50 p-3 border border-rose-200 text-rose-700 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 flex items-center space-x-2 rounded-xl bg-emerald-50 p-3 border border-emerald-200 text-emerald-700 text-xs">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {currentUser ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Email:</span>
                <span className="font-semibold text-slate-900">{currentUser.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Role:</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-100 text-emerald-800">
                  {userProfile?.role || "Admin"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Cloud Sync:</span>
                <span className="text-emerald-600 font-semibold">Active & Real-Time</span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Log Out</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleAuth} className="space-y-4">
            {isRegistering && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Full Name / Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Principal / Staff Coordinator"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@srimahalakshmi.edu"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {isRegistering && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Access Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRequestedRole("admin")}
                    className={`rounded-xl border p-2.5 text-xs text-left transition-all ${
                      requestedRole === "admin"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="font-bold">Administrator</div>
                    <div className="text-[10px] text-slate-500">Full management & generator rights</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestedRole("staff")}
                    className={`rounded-xl border p-2.5 text-xs text-left transition-all ${
                      requestedRole === "staff"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="font-bold">Staff / Faculty</div>
                    <div className="text-[10px] text-slate-500">View schedules & availability</div>
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <span>Processing...</span>
              ) : isRegistering ? (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>Create Account</span>
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  <span>Sign In to School Portal</span>
                </>
              )}
            </button>

            <div className="pt-2 text-center text-xs text-slate-500">
              {isRegistering ? (
                <span>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegistering(false);
                      setError(null);
                    }}
                    className="font-semibold text-emerald-700 hover:underline"
                  >
                    Sign In
                  </button>
                </span>
              ) : (
                <span>
                  Need an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegistering(true);
                      setError(null);
                    }}
                    className="font-semibold text-emerald-700 hover:underline"
                  >
                    Register New Account
                  </button>
                </span>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
