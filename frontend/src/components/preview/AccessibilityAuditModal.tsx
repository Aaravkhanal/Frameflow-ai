import React from "react";
import { A11yAuditResult } from "../../lib/a11yAuditor";

interface AccessibilityAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditResult: A11yAuditResult;
  onApplyFixes?: (fixedCode: string) => void;
}

export const AccessibilityAuditModal: React.FC<AccessibilityAuditModalProps> = ({
  isOpen,
  onClose,
  auditResult,
}) => {
  if (!isOpen) return null;

  const { score, passedChecks, totalChecks, issues } = auditResult;

  const scoreColor =
    score >= 90
      ? "bg-green-500 text-white"
      : score >= 70
      ? "bg-yellow-500 text-black"
      : "bg-red-500 text-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 text-sm font-bold rounded-full ${scoreColor}`}>
              {score} / 100
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">
                Accessibility (WCAG 2.1) Audit
              </h2>
              <p className="text-xs text-zinc-400">
                {passedChecks} of {totalChecks} checks passed
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 rounded-md hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {issues.length === 0 ? (
            <div className="p-8 text-center bg-zinc-950/50 rounded-lg border border-zinc-800">
              <span className="text-4xl block mb-2">🎉</span>
              <h3 className="text-base font-medium text-emerald-400 mb-1">
                No Accessibility Violations Found!
              </h3>
              <p className="text-xs text-zinc-400">
                Your code complies with standard WCAG 2.1 accessibility guidelines.
              </p>
            </div>
          ) : (
            <>
              {issues.map((issue) => (
                <div
                  key={issue.id}
                  className="p-4 bg-zinc-950/80 rounded-lg border border-zinc-800/80 space-y-2 text-left"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs px-2 py-0.5 font-medium rounded ${
                        issue.type === "error"
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                      }`}
                    >
                      {issue.type.toUpperCase()}
                    </span>
                    <span className="text-xs text-zinc-500 font-mono">{issue.rule}</span>
                  </div>

                  <p className="text-sm font-medium text-zinc-200">{issue.message}</p>

                  {issue.elementSnippet && (
                    <pre className="text-xs bg-zinc-900 p-2 rounded text-zinc-300 font-mono overflow-x-auto border border-zinc-800">
                      {issue.elementSnippet}
                    </pre>
                  )}

                  <div className="text-xs text-emerald-400 bg-emerald-950/30 p-2 rounded border border-emerald-900/40">
                    <span className="font-semibold">💡 Recommendation: </span>
                    {issue.suggestion}
                  </div>
                </div>
              ))}
              
              {onApplyFixes && (
                <div className="pt-4 border-t border-zinc-800 mt-6 flex justify-end">
                  <button
                    onClick={() => {
                      const instructions = issues.map(i => i.suggestion).join(". ");
                      onApplyFixes(`Fix accessibility issues: ${instructions}`);
                      onClose();
                    }}
                    className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                  >
                    <span>✨ Auto-Fix with AI</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
