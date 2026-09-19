import React, { useState } from "react";
import { Sparkles, X, Check, ArrowRight, Bot, AlertCircle, CheckCircle2 } from "lucide-react";
import { GroqService, ParsedAIData } from "../services/groqService";

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyParsedData: (data: ParsedAIData) => { success: boolean; logs: string[] };
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  onApplyParsedData,
}) => {
  const [prompt, setPrompt] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [parsedData, setParsedData] = useState<ParsedAIData | null>(null);
  const [applyLogs, setApplyLogs] = useState<string[] | null>(null);

  if (!isOpen) return null;

  const handleParse = async () => {
    if (!prompt.trim()) return;
    setIsProcessing(true);
    setParsedData(null);
    setApplyLogs(null);
    try {
      const result = await GroqService.parsePrompt(prompt, apiKey);
      if (result.success) {
        setParsedData(result.data);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    if (!parsedData) return;
    const res = onApplyParsedData(parsedData);
    if (res.success) {
      setApplyLogs(res.logs);
      setParsedData(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Natural Language Setup Assistant
              </h3>
              <p className="text-xs text-slate-500">
                Powered by Groq API with deterministic Pydantic schema validation & offline fallback
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Prompt Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Enter schedule setup instruction in plain English:
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Enter teacher name, subject, classes taught, and any unavailable day/period slots in plain text."
              className="w-full rounded-xl border border-slate-300 p-3 text-xs leading-relaxed focus:border-purple-500 focus:outline-hidden"
            />
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-[11px] text-slate-400">
              Deterministic fallback automatically operates offline if no Groq key is provided.
            </div>
            <button
              id="btn-ai-parse"
              onClick={handleParse}
              disabled={isProcessing || !prompt.trim()}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-purple-700 disabled:opacity-50"
            >
              <Bot className="h-4 w-4" />
              <span>{isProcessing ? "Parsing..." : "Parse Instruction"}</span>
            </button>
          </div>

          {/* Parsed JSON Preview & Validation */}
          {parsedData && (
            <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-950 flex items-center space-x-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Validated Pydantic Structured Output:</span>
                </span>
                <button
                  id="btn-ai-apply"
                  onClick={handleApply}
                  className="inline-flex items-center space-x-1 rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-800 shadow-xs"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Apply to Database</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-white p-2 border border-purple-100">
                  <span className="text-slate-500 font-medium">Teacher:</span>{" "}
                  <span className="font-bold text-slate-900">{parsedData.staff_name || "N/A"}</span>
                </div>
                <div className="rounded-lg bg-white p-2 border border-purple-100">
                  <span className="text-slate-500 font-medium">Subject:</span>{" "}
                  <span className="font-bold text-slate-900">{parsedData.subject_name || "N/A"}</span>
                </div>
                <div className="rounded-lg bg-white p-2 border border-purple-100">
                  <span className="text-slate-500 font-medium">Classes:</span>{" "}
                  <span className="font-bold text-slate-900">
                    {parsedData.class_names?.join(", ") || "N/A"}
                  </span>
                </div>
                <div className="rounded-lg bg-white p-2 border border-purple-100">
                  <span className="text-slate-500 font-medium">Blocked Slots:</span>{" "}
                  <span className="font-bold text-slate-900">
                    {parsedData.unavailable?.map((u) => `${u.day} P${u.period}`).join(", ") || "None"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Logs */}
          {applyLogs && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900 space-y-1">
              <div className="font-bold flex items-center space-x-1.5">
                <Check className="h-4 w-4 text-emerald-600" />
                <span>Applied Changes Successfully:</span>
              </div>
              <ul className="list-disc pl-5 text-[11px] space-y-0.5">
                {applyLogs.map((log, i) => (
                  <li key={i}>{log}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
