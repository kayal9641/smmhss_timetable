import React, { useState } from "react";
import { ShieldAlert, Copy, Check, ExternalLink, Database, X, RefreshCw } from "lucide-react";
import { projectId, isAiStudioProject } from "../services/firebase";

interface FirestoreRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncErrorType?: string | null;
}

export const FirestoreRulesModal: React.FC<FirestoreRulesModalProps> = ({
  isOpen,
  onClose,
  syncErrorType,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const rulesCode = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Open access rule for school timetable management
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rulesCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div
      id="firestore-rules-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="firestore-rules-modal-container"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">
                Vercel Firestore Persistence Setup
              </h3>
              <p className="text-xs text-amber-100">
                Connected Project: <span className="font-mono font-bold">{projectId || "Firebase"}</span>
              </p>
            </div>
          </div>
          <button
            id="close-firestore-rules-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4 text-slate-700 text-sm">
          {syncErrorType === "permission-denied" && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-amber-800 text-xs leading-relaxed">
                <strong>Why did data disappear on reload in Vercel?</strong> When deploying to Vercel, Firebase defaults to blocking database writes until you publish rules in your Firebase Console. Your local data is safe, but publishing rules allows Firestore to store and reload your timetable permanently.
              </p>
            </div>
          )}

          <div>
            <h4 className="font-semibold text-slate-800 text-base mb-1">
              Quick 30-Second Fix (One-Time Setup):
            </h4>
            <ol className="list-decimal list-inside space-y-2 text-xs text-slate-600 pl-1">
              <li>
                Open the{" "}
                <a
                  href={`https://console.firebase.google.com/project/${projectId}/firestore/rules`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 font-medium hover:underline inline-flex items-center gap-1"
                >
                  Firebase Console Rules Page <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>Navigate to <strong>Firestore Database</strong> &rarr; <strong>Rules</strong> tab.</li>
              <li>Replace the existing rules with the snippet below and click <strong>Publish</strong>.</li>
            </ol>
          </div>

          {/* Code Snippet Box */}
          <div className="relative">
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 rounded-t-lg border-b border-slate-700">
              <span className="text-xs font-mono text-slate-400">firestore.rules</span>
              <button
                id="copy-firestore-rules-snippet-btn"
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copy Rules
                  </>
                )}
              </button>
            </div>
            <pre className="bg-slate-900 text-emerald-300 font-mono text-xs p-4 rounded-b-lg overflow-x-auto leading-relaxed border border-slate-800">
              {rulesCode}
            </pre>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-600">
            <p className="font-medium text-slate-700">
              ✓ <strong>Automatic IndexedDB Offline Persistence is Active:</strong>
            </p>
            <p>
              The app has been upgraded to automatically persist all classes, teachers, subjects, and timetables in local browser IndexedDB across reloads. Once Firestore rules are published above, all data will also sync to your cloud database automatically!
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            id="close-firestore-rules-modal-bottom-btn"
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-all shadow-sm"
          >
            Close
          </button>
          <a
            href={`https://console.firebase.google.com/project/${projectId}/firestore/rules`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            <span>Open Firebase Rules</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
};
