import { useState } from "react";
import { Terminal, ChevronUp, ChevronDown, XCircle, CheckCircle, AlertCircle } from "lucide-react";
import { useProjectStore } from "../../store/project-store";
import { motion, AnimatePresence } from "framer-motion";

export function BottomLogPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { executionConsoles, head, commits } = useProjectStore();

  const currentCommit = head && commits[head] ? commits[head] : null;
  const currentVariantIndex = currentCommit ? currentCommit.selectedVariantIndex : 0;
  
  const logs = executionConsoles[currentVariantIndex] || [];
  
  if (logs.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col border-t border-slate-800 bg-slate-950/90 font-mono text-xs backdrop-blur-xl transition-all duration-300 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)]">
      {/* Header / Toggle */}
      <div 
        className="flex h-8 cursor-pointer items-center justify-between border-b border-slate-800/50 bg-slate-900/50 px-4 text-slate-400 hover:text-slate-200"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-cyan-500" />
          <span>Execution Logs ({logs.length})</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-emerald-400">
            <CheckCircle size={12} /> 0
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <AlertCircle size={12} /> 0
          </span>
          <span className="flex items-center gap-1 text-red-400">
            <XCircle size={12} /> 0
          </span>
          {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </div>
      </div>

      {/* Expandable Log Area */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: 200 }}
            exit={{ height: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className="overflow-y-auto p-4 text-slate-300"
          >
            <div className="flex flex-col gap-1">
              {logs.map((log, i) => {
                const isError = log.toLowerCase().includes("error") || log.toLowerCase().includes("fail");
                const isWarning = log.toLowerCase().includes("warn");
                const isSuccess = log.toLowerCase().includes("success") || log.toLowerCase().includes("done");
                
                return (
                  <div key={i} className="flex items-start gap-4 hover:bg-slate-800/30 px-2 py-0.5 rounded">
                    <span className="shrink-0 text-slate-600">
                      {new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className={`flex-1 break-all ${isError ? "text-red-400" : isWarning ? "text-amber-400" : isSuccess ? "text-emerald-400" : ""}`}>
                      {log}
                    </span>
                  </div>
                );
              })}
              {logs.length === 0 && (
                <div className="text-slate-500 italic">Waiting for execution logs...</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
