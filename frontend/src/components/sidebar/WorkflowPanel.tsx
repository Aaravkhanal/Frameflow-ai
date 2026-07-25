import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AgentOrchestrationPanel } from "../agent/AgentOrchestrationPanel";
import { useProjectStore } from "../../store/project-store";
import { Layers, Activity, AlertTriangle, ListTodo } from "lucide-react";

export function WorkflowPanel() {
  const [activeTab, setActiveTab] = useState<"progress" | "logs" | "components" | "warnings">("progress");
  const { orchestrationEvents } = useProjectStore();

  const tabs = [
    { id: "progress", label: "Progress", icon: <ListTodo size={14} /> },
    { id: "logs", label: "Logs", icon: <Activity size={14} /> },
    { id: "components", label: "Components", icon: <Layers size={14} /> },
    { id: "warnings", label: "Warnings", icon: <AlertTriangle size={14} /> },
  ] as const;

  return (
    <div className="flex h-full flex-col bg-slate-950/80 backdrop-blur-2xl">
      {/* Tabs Header */}
      <div className="flex items-center gap-1 border-b border-white/10 p-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.id ? "text-cyan-400" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute inset-0 rounded-lg border border-cyan-500/30 bg-cyan-500/10"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 h-full overflow-y-auto p-4 sidebar-scrollbar-stable"
          >
            {activeTab === "progress" && (
              <AgentOrchestrationPanel events={orchestrationEvents} isActive={true} />
            )}
            {activeTab === "logs" && (
              <div className="flex flex-col gap-3 font-mono text-xs text-slate-300">
                {orchestrationEvents.length === 0 ? (
                  <div className="text-slate-500 text-center mt-10">No logs available.</div>
                ) : (
                  [...orchestrationEvents].reverse().map((event, idx) => (
                    <div key={idx} className="flex gap-3 items-start border-b border-white/5 pb-2">
                      <span className="text-slate-500 shrink-0 mt-0.5">
                        {new Date().toLocaleTimeString([], { hour12: false })}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-cyan-400 font-semibold">{event.agentType || 'System'}</span>
                        <span className="text-slate-300 whitespace-pre-wrap">{event.content || '...'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {activeTab === "components" && (
              <div className="flex flex-col gap-2">
                <div className="text-slate-500 text-center mt-10">Detecting components...</div>
              </div>
            )}
            {activeTab === "warnings" && (
              <div className="flex flex-col gap-2">
                <div className="text-slate-500 text-center mt-10">No warnings detected.</div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
