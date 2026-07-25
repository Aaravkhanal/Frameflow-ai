import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { OrchestrationEventData } from "../../types";
import { CheckCircle2, Circle, Loader2, BrainCircuit, Activity, Clock, Box, Layout, Cpu } from "lucide-react";

interface AgentOrchestrationPanelProps {
  events: OrchestrationEventData[];
  isActive: boolean;
}

const PIPELINE_STAGES = [
  { id: "routing", label: "Upload & Routing" },
  { id: "vision", label: "Vision Analysis" },
  { id: "layout", label: "Layout Detection" },
  { id: "extraction", label: "Component Extraction" },
  { id: "coding", label: "Code Generation" },
  { id: "debate", label: "Expert Debate & Critique" },
  { id: "refining", label: "Refining & Optimization" },
  { id: "review", label: "Senior Review" },
  { id: "consensus", label: "Export & Finalize" },
];

export const AgentOrchestrationPanel: React.FC<AgentOrchestrationPanelProps> = ({
  events,
  isActive,
}) => {
  const stageEvents = events.filter((e) => e.pipelineStage);
  const currentStage = stageEvents.length > 0 
    ? stageEvents[stageEvents.length - 1].pipelineStage?.stage 
    : "routing";

  const agentStartEvents = events.filter((e) => e.agentStart);
  const activeAgent = agentStartEvents.length > 0 
    ? agentStartEvents[agentStartEvents.length - 1].agentStart 
    : null;

  // Find the index of the current stage in our predefined list (mapping slightly to logic)
  const mappedCurrentStage = 
    currentStage === "routing" ? "routing" :
    currentStage === "vision" ? "vision" :
    currentStage === "coding" ? "coding" :
    currentStage === "debate" ? "debate" :
    currentStage === "refining" ? "refining" :
    currentStage === "review" ? "review" :
    currentStage === "consensus" ? "consensus" : "routing";

  const currentStageIndex = PIPELINE_STAGES.findIndex(s => s.id === mappedCurrentStage);

  return (
    <div className="flex flex-col gap-6 w-full h-full text-slate-200">
      
      {/* Pipeline Visualization */}
      <div className="flex flex-col gap-3 rounded-2xl bg-slate-900/50 p-5 border border-white/5 shadow-xl">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-2">Orchestration Pipeline</h3>
        <div className="flex flex-col gap-4">
          {PIPELINE_STAGES.map((stage, idx) => {
            const isCompleted = idx < currentStageIndex || (mappedCurrentStage === "consensus" && !isActive);
            const isCurrent = idx === currentStageIndex && isActive;

            return (
              <div key={stage.id} className="flex items-center gap-3">
                <div className="relative flex items-center justify-center">
                  {/* The Line */}
                  {idx !== PIPELINE_STAGES.length - 1 && (
                    <div className={`absolute top-6 w-0.5 h-4 -z-10 ${isCompleted ? "bg-cyan-500/50" : "bg-slate-700/50"}`} />
                  )}
                  {/* The Icon */}
                  {isCompleted ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-cyan-400">
                      <CheckCircle2 size={18} />
                    </motion.div>
                  ) : isCurrent ? (
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }} 
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="text-cyan-300 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                    >
                      <Loader2 size={18} className="animate-spin" />
                    </motion.div>
                  ) : (
                    <Circle size={18} className="text-slate-600" />
                  )}
                </div>
                <span className={`text-sm font-medium ${isCurrent ? "text-cyan-100" : isCompleted ? "text-slate-300" : "text-slate-600"}`}>
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Agent Card */}
      <AnimatePresence mode="wait">
        {activeAgent && isActive && mappedCurrentStage !== "consensus" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-5 border border-cyan-500/20 shadow-[0_10px_30px_-10px_rgba(6,182,212,0.15)]"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-950 text-2xl border border-cyan-800/50">
                  {activeAgent.icon || "🤖"}
                </div>
                <div>
                  <h4 className="font-semibold text-cyan-100">{activeAgent.agentName}</h4>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <BrainCircuit size={12} />
                    {activeAgent.model || "Gemini 2.5"}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs uppercase tracking-wider text-slate-500">Status</span>
                <span className="text-sm font-medium text-cyan-400 flex items-center gap-1">
                  <Activity size={12} className="animate-pulse" />
                  Analyzing...
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex flex-col gap-1 rounded-xl bg-slate-950/50 p-2 border border-white/5">
                <span className="text-slate-500 flex items-center gap-1"><Cpu size={12}/> Confidence</span>
                <span className="text-sm font-semibold text-emerald-400">98%</span>
              </div>
              <div className="flex flex-col gap-1 rounded-xl bg-slate-950/50 p-2 border border-white/5">
                <span className="text-slate-500 flex items-center gap-1"><Clock size={12}/> ETA</span>
                <span className="text-sm font-semibold text-amber-400">~9 sec</span>
              </div>
              <div className="flex flex-col gap-1 rounded-xl bg-slate-950/50 p-2 border border-white/5">
                <span className="text-slate-500 flex items-center gap-1"><Box size={12}/> Objects</span>
                <span className="text-sm font-semibold text-slate-200">84</span>
              </div>
              <div className="flex flex-col gap-1 rounded-xl bg-slate-950/50 p-2 border border-white/5">
                <span className="text-slate-500 flex items-center gap-1"><Layout size={12}/> Components</span>
                <span className="text-sm font-semibold text-slate-200">43</span>
              </div>
            </div>
            
            {/* Live Streaming Log underneath Agent Card */}
            <div className="mt-2 flex flex-col gap-1 rounded-xl bg-slate-950 p-3 font-mono text-[11px] text-slate-300 shadow-inner border border-white/5 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-950 pointer-events-none z-10" />
              {[...events].reverse().slice(0, 5).map((e, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1 - i * 0.2, x: 0 }}
                  className="flex items-center gap-2 truncate"
                >
                  <span className="text-cyan-500">✓</span>
                  {e.content || (e.agentStart ? `Initializing ${e.agentStart.agentName}...` : "Processing...")}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
