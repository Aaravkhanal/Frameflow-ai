import { LuCode, LuSettings, LuPlus, LuUser, LuLogOut, LuListTree, LuImage, LuHistory } from "react-icons/lu";
import { useAuthStore } from "../../store/authStore";
import { FrameFlowLogo } from "../ui/FrameFlowLogo";
import { motion } from "framer-motion";

interface IconStripProps {
  isHistoryOpen: boolean;
  isEditorOpen: boolean;
  isSettingsOpen: boolean;
  isWorkflowOpen?: boolean;
  isAssetsOpen?: boolean;
  showHistory: boolean;
  showEditor: boolean;
  onToggleHistory: () => void;
  onToggleEditor: () => void;
  onToggleWorkflow?: () => void;
  onToggleAssets?: () => void;
  onLogoClick: () => void;
  onNewProject: () => void;
  onOpenSettings: () => void;
}

function IconStrip({
  isHistoryOpen,
  isEditorOpen,
  isSettingsOpen,
  isWorkflowOpen,
  isAssetsOpen,
  showHistory,
  showEditor,
  onToggleHistory,
  onToggleEditor,
  onToggleWorkflow,
  onToggleAssets,
  onLogoClick,
  onNewProject,
  onOpenSettings,
}: IconStripProps) {
  const { user, isAuthenticated, setAuthModalOpen, logout } = useAuthStore();

  return (
    <div className="flex w-full items-center justify-between border-b border-white/10 bg-slate-950/80 backdrop-blur-2xl px-3 py-2 dark:border-zinc-800/80 lg:h-full lg:w-16 lg:flex-col lg:items-center lg:gap-y-3 lg:border-b-0 lg:border-r lg:px-0 lg:py-4 shadow-2xl">
      {/* Brand Logo */}
      <button
        onClick={onLogoClick}
        className="group relative flex items-center justify-center rounded-xl p-0.5 transition-all hover:bg-white/5 lg:mb-1"
        title="FrameFlow AI Home"
      >
        <FrameFlowLogo size={44} className="group-hover:scale-105 transition-transform drop-shadow-[0_0_15px_rgba(6,182,212,0.3)]" />
      </button>

      {/* New Project Button - directly under logo */}
      <button
        onClick={onNewProject}
        className="flex items-center justify-center rounded-xl p-2 transition-all bg-gradient-to-br from-cyan-600 to-teal-700 text-white hover:brightness-110 shadow-[0_0_15px_rgba(6,182,212,0.4)] lg:flex-col lg:gap-1 lg:px-2 lg:py-2 lg:mb-2"
        title="Start a new project"
      >
        <LuPlus className="w-5 h-5" />
        <span className="hidden text-[10px] leading-none lg:block font-bold">New</span>
      </button>

      <div className="flex items-center gap-1.5 lg:flex-col lg:gap-3 lg:contents">
        {/* Editor */}
        {showEditor && (
          <button
            onClick={onToggleEditor}
            className={`relative flex items-center justify-center rounded-xl p-2 transition-all lg:flex-col lg:gap-1 lg:px-2 lg:py-2 ${
              isEditorOpen
                ? "text-cyan-300"
                : "text-zinc-500 hover:text-slate-300 hover:bg-white/5"
            }`}
            title="Editor"
          >
            {isEditorOpen && (
              <motion.div layoutId="sidebar-active" className="absolute inset-0 rounded-xl border border-cyan-500/50 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.2)]" />
            )}
            <LuCode className="w-5 h-5 relative z-10" />
            <span className="hidden text-[10px] font-medium leading-none lg:block relative z-10">Editor</span>
          </button>
        )}

        {/* Workflow */}
        {showEditor && onToggleWorkflow && (
          <button
            onClick={onToggleWorkflow}
            className={`relative flex items-center justify-center rounded-xl p-2 transition-all lg:flex-col lg:gap-1 lg:px-2 lg:py-2 ${
              isWorkflowOpen
                ? "text-cyan-300"
                : "text-zinc-500 hover:text-slate-300 hover:bg-white/5"
            }`}
            title="Workflow"
          >
            {isWorkflowOpen && (
              <motion.div layoutId="sidebar-active" className="absolute inset-0 rounded-xl border border-cyan-500/50 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.2)]" />
            )}
            <LuListTree className="w-5 h-5 relative z-10" />
            <span className="hidden text-[10px] font-medium leading-none lg:block relative z-10">Workflow</span>
          </button>
        )}

        {/* Assets */}
        {showEditor && onToggleAssets && (
          <button
            onClick={onToggleAssets}
            className={`relative flex items-center justify-center rounded-xl p-2 transition-all lg:flex-col lg:gap-1 lg:px-2 lg:py-2 ${
              isAssetsOpen
                ? "text-cyan-300"
                : "text-zinc-500 hover:text-slate-300 hover:bg-white/5"
            }`}
            title="Assets"
          >
            {isAssetsOpen && (
              <motion.div layoutId="sidebar-active" className="absolute inset-0 rounded-xl border border-cyan-500/50 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.2)]" />
            )}
            <LuImage className="w-5 h-5 relative z-10" />
            <span className="hidden text-[10px] font-medium leading-none lg:block relative z-10">Assets</span>
          </button>
        )}

        {/* History */}
        {showHistory && (
          <button
            onClick={onToggleHistory}
            className={`relative flex items-center justify-center rounded-xl p-2 transition-all lg:flex-col lg:gap-1 lg:px-2 lg:py-2 ${
              isHistoryOpen
                ? "text-cyan-300"
                : "text-zinc-500 hover:text-slate-300 hover:bg-white/5"
            }`}
            title="History"
          >
            {isHistoryOpen && (
              <motion.div layoutId="sidebar-active" className="absolute inset-0 rounded-xl border border-cyan-500/50 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.2)]" />
            )}
            <LuHistory className="w-5 h-5 relative z-10" />
            <span className="hidden text-[10px] font-medium leading-none lg:block relative z-10">History</span>
          </button>
        )}
      </div>

      {/* Spacer pushes settings to bottom */}
      <div className="hidden flex-1 lg:block" />

      {/* Bottom Nav */}
      <div className="flex items-center gap-1.5 lg:flex-col lg:gap-3 lg:contents">
        
        {/* Account / User Auth */}
        <button
          onClick={() => (isAuthenticated ? logout() : setAuthModalOpen(true, "login"))}
          className="relative flex items-center justify-center rounded-xl p-2 text-zinc-500 hover:text-slate-300 hover:bg-white/5 transition-all lg:flex-col lg:gap-1 lg:px-2 lg:py-2"
          title={isAuthenticated ? `Logged in as ${user?.name}. Click to log out.` : "Sign In / Sign Up"}
        >
          {isAuthenticated ? <LuLogOut className="w-5 h-5 text-cyan-500" /> : <LuUser className="w-5 h-5" />}
          <span className="hidden text-[10px] font-medium leading-none lg:block">
            {isAuthenticated ? "Logout" : "Account"}
          </span>
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className={`relative flex items-center justify-center rounded-xl p-2 transition-all lg:flex-col lg:gap-1 lg:px-2 lg:py-2 ${
            isSettingsOpen
              ? "text-cyan-300"
              : "text-zinc-500 hover:text-slate-300 hover:bg-white/5"
          }`}
          title="Settings"
        >
          {isSettingsOpen && (
            <motion.div layoutId="sidebar-active" className="absolute inset-0 rounded-xl border border-cyan-500/50 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.2)]" />
          )}
          <LuSettings className="w-5 h-5 relative z-10" />
          <span className="hidden text-[10px] font-medium leading-none lg:block relative z-10">Settings</span>
        </button>

      </div>
    </div>
  );
}

export default IconStrip;
