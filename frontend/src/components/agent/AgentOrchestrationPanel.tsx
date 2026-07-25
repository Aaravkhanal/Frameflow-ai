import React from "react";
import classNames from "classnames";
import { AgentCritique, OrchestrationEventData } from "../../types";
import { AgentBadge } from "./AgentBadge";

interface AgentOrchestrationPanelProps {
  events: OrchestrationEventData[];
  isActive: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  routing: "Routing Request",
  vision: "Vision Analysis",
  coding: "Initial Code Generation",
  debate: "Expert Debate & Critique",
  refining: "Refining Code",
  review: "Senior Review",
  consensus: "Consensus Reached",
};

export const AgentOrchestrationPanel: React.FC<AgentOrchestrationPanelProps> = ({
  events,
  isActive,
}) => {
  // Find current stage
  const stageEvents = events.filter((e) => e.pipelineStage);
  const currentStage = stageEvents.length > 0 
    ? stageEvents[stageEvents.length - 1].pipelineStage?.stage 
    : "routing";

  // Find active agent
  const agentStartEvents = events.filter((e) => e.agentStart);
  const activeAgent = agentStartEvents.length > 0 
    ? agentStartEvents[agentStartEvents.length - 1].agentStart 
    : null;

  // Find all critiques
  const critiques = events.filter((e) => e.agentCritique).map((e) => e.agentCritique!);

  // Find debate rounds
  const debateRounds = events.filter((e) => e.debateRound).map((e) => e.debateRound!);
  const currentRound = debateRounds.length > 0 ? debateRounds[debateRounds.length - 1] : null;

  if (events.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 w-full h-full overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 shadow-inner">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <span className="text-2xl">🧠</span> AI Orchestration Engine
        </h3>
        <div className="flex items-center gap-2">
          {isActive ? (
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
          ) : (
            <span className="h-3 w-3 rounded-full bg-gray-400"></span>
          )}
          <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            {isActive ? "Pipeline Active" : "Pipeline Idle"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex-1">
          <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Current Stage</div>
          <div className="text-base font-semibold text-blue-600 dark:text-blue-400">
            {currentStage ? STAGE_LABELS[currentStage] || currentStage : "Initializing..."}
          </div>
        </div>
        
        {activeAgent && (isActive || currentStage !== "consensus") && (
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mr-2 text-right">Active Agent</div>
            <AgentBadge 
              name={activeAgent.agentName} 
              role={activeAgent.agentRole} 
              icon={activeAgent.icon} 
              color={activeAgent.color}
              model={activeAgent.model}
              size="lg"
            />
          </div>
        )}
      </div>

      {currentRound && (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-indigo-100 dark:border-indigo-900">
          <div className="flex justify-between items-end mb-2">
            <div>
              <div className="text-xs text-indigo-500 uppercase font-bold tracking-wider mb-1">Debate Round {currentRound.round}</div>
              <div className="text-sm font-medium">Consensus Threshold: {currentRound.threshold.toFixed(1)}/10</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold" style={{ color: currentRound.passed ? '#10B981' : '#F59E0B' }}>
                {currentRound.averageScore.toFixed(1)}
              </div>
              <div className="text-xs text-gray-500 uppercase font-bold">Current Score</div>
            </div>
          </div>
          
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-1 overflow-hidden relative">
            <div 
              className={classNames("h-2.5 rounded-full transition-all duration-500", currentRound.passed ? "bg-green-500" : "bg-yellow-500")}
              style={{ width: `${Math.min(100, (currentRound.averageScore / 10) * 100)}%` }}
            ></div>
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10" 
              style={{ left: `${(currentRound.threshold / 10) * 100}%` }}
              title="Threshold"
            ></div>
          </div>
        </div>
      )}

      {critiques.length > 0 && (
        <div className="mt-2 space-y-3">
          <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">Agent Critiques</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {critiques.map((critique, idx) => (
              <CritiqueCard key={idx} critique={critique} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const CritiqueCard: React.FC<{ critique: AgentCritique }> = ({ critique }) => {
  // Try to find a matching badge color based on role, fallback to gray
  const getIconAndColor = (role: string) => {
    switch (role) {
      case "accessibility": return { icon: "♿", color: "#10B981" };
      case "performance": return { icon: "⚡", color: "#F59E0B" };
      case "ux": return { icon: "🎨", color: "#EC4899" };
      case "animation": return { icon: "✨", color: "#6366F1" };
      case "security": return { icon: "🔒", color: "#EF4444" };
      case "reviewer": return { icon: "🏛️", color: "#8B5CF6" };
      default: return { icon: "🤖", color: "#6B7280" };
    }
  };

  const { icon, color } = getIconAndColor(critique.role);
  
  // Format the name
  const name = critique.role.charAt(0).toUpperCase() + critique.role.slice(1);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex justify-between items-start mb-2">
        <AgentBadge name={name} role={critique.role} icon={icon} color={color} size="sm" />
        <div 
          className={classNames(
            "text-lg font-bold px-2 py-0.5 rounded",
            critique.score >= 8 ? "text-green-600 bg-green-50" : 
            critique.score >= 6 ? "text-yellow-600 bg-yellow-50" : 
            "text-red-600 bg-red-50"
          )}
        >
          {critique.score}/10
        </div>
      </div>
      
      <p className="text-sm text-gray-700 dark:text-gray-300 italic mb-3 flex-grow line-clamp-3">
        "{critique.summary}"
      </p>
      
      <div className="flex gap-2 text-xs font-medium">
        {critique.issues && critique.issues.length > 0 && (
          <span className="bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded border border-red-100 dark:border-red-800/50">
            {critique.issues.length} Issues
          </span>
        )}
        {critique.suggestions && critique.suggestions.length > 0 && (
          <span className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-1 rounded border border-blue-100 dark:border-blue-800/50">
            {critique.suggestions.length} Suggestions
          </span>
        )}
        {critique.approved && (
          <span className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded border border-green-100 dark:border-green-800/50 ml-auto">
            Approved
          </span>
        )}
      </div>
    </div>
  );
};
