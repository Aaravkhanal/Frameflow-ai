import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wrench, MessageSquare, Search, Layout, RefreshCw, Zap, Lightbulb } from "lucide-react";
import { useAppStore } from "../../store/app-store";
import { AppState } from "../../types";

const tools = [
  { id: "ask", icon: <MessageSquare size={16} />, label: "Ask AI" },
  { id: "inspect", icon: <Search size={16} />, label: "Inspect Elements" },
  { id: "layout", icon: <Layout size={16} />, label: "Fix Layout" },
  { id: "regenerate", icon: <RefreshCw size={16} />, label: "Regenerate" },
  { id: "optimize", icon: <Zap size={16} />, label: "Optimize Performance" },
  { id: "explain", icon: <Lightbulb size={16} />, label: "Explain Code" },
];

export function FloatingToolbox() {
  const [isOpen, setIsOpen] = useState(false);
  const { appState } = useAppStore();

  if (appState === AppState.INITIAL) return null;

  return (
    <div className="fixed bottom-12 right-6 z-40 flex flex-col-reverse items-end gap-2">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-600 text-white shadow-lg shadow-cyan-900/50 transition-colors hover:bg-cyan-500"
      >
        <Wrench size={20} className={isOpen ? "rotate-45 transition-transform" : "transition-transform"} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="flex flex-col gap-2 rounded-2xl border border-slate-700/50 bg-slate-900/90 p-2 shadow-2xl backdrop-blur-xl"
          >
            {tools.map((tool, idx) => (
              <motion.button
                key={tool.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group relative flex items-center justify-center rounded-xl p-3 text-slate-400 hover:bg-slate-800 hover:text-cyan-400"
              >
                {tool.icon}
                
                {/* Tooltip */}
                <div className="pointer-events-none absolute right-full mr-2 hidden origin-right rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 opacity-0 transition-opacity group-hover:block group-hover:opacity-100">
                  {tool.label}
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
