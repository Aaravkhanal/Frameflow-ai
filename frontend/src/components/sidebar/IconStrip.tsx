import { LuClock, LuCode, LuSettings, LuPlus, LuUser, LuLogOut } from "react-icons/lu";
import { useAuthStore } from "../../store/authStore";
import { FrameFlowLogo } from "../ui/FrameFlowLogo";

interface IconStripProps {
  isHistoryOpen: boolean;
  isEditorOpen: boolean;
  isSettingsOpen: boolean;
  showHistory: boolean;
  showEditor: boolean;
  onToggleHistory: () => void;
  onToggleEditor: () => void;
  onLogoClick: () => void;
  onNewProject: () => void;
  onOpenSettings: () => void;
}

function IconStrip({
  isHistoryOpen,
  isEditorOpen,
  isSettingsOpen,
  showHistory,
  showEditor,
  onToggleHistory,
  onToggleEditor,
  onLogoClick,
  onNewProject,
  onOpenSettings,
}: IconStripProps) {
  const { user, isAuthenticated, setAuthModalOpen, logout } = useAuthStore();

  return (
    <div className="flex w-full items-center justify-between border-b border-white/10 bg-slate-950/80 backdrop-blur-xl px-3 py-2 dark:border-zinc-800/80 lg:h-full lg:w-16 lg:flex-col lg:items-center lg:gap-y-3 lg:border-b-0 lg:border-r lg:px-0 lg:py-4">
      {/* Brand Logo */}
      <button
        onClick={onLogoClick}
        className="group relative flex items-center justify-center rounded-xl p-0.5 transition-all hover:bg-white/10 lg:mb-2"
        title="FrameFlow AI Home"
      >
        <FrameFlowLogo size={44} className="group-hover:scale-105 transition-transform" />
      </button>

      <div className="flex items-center gap-1.5 lg:flex-col lg:gap-1.5 lg:contents">
        {/* Editor */}
        {showEditor && (
          <button
            onClick={onToggleEditor}
            className={`flex items-center justify-center rounded-xl p-2 transition-all lg:flex-col lg:gap-1 lg:px-2 lg:py-2 ${
              isEditorOpen
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
            title="Editor"
          >
            <LuCode className="w-5 h-5" />
            <span className="hidden text-[10px] font-medium leading-none lg:block">Editor</span>
          </button>
        )}

        {/* Versions */}
        {showHistory && (
          <button
            onClick={onToggleHistory}
            className={`flex items-center justify-center rounded-xl p-2 transition-all lg:flex-col lg:gap-1 lg:px-2 lg:py-2 ${
              isHistoryOpen
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
            title="Versions"
          >
            <LuClock className="w-5 h-5" />
            <span className="hidden text-[10px] font-medium leading-none lg:block">Versions</span>
          </button>
        )}

        <button
          onClick={onNewProject}
          className="flex items-center justify-center rounded-xl p-2 transition-all bg-gradient-to-br from-cyan-500 to-teal-600 text-white hover:opacity-90 shadow-md shadow-cyan-500/20 lg:flex-col lg:gap-1 lg:px-2 lg:py-2"
          title="Start a new project"
        >
          <LuPlus className="w-5 h-5" />
          <span className="hidden text-[10px] leading-none lg:block font-bold">New</span>
        </button>
      </div>

      {/* Spacer pushes settings to bottom */}
      <div className="hidden flex-1 lg:block" />

      {/* Account / User Auth */}
      <button
        onClick={() => (isAuthenticated ? logout() : setAuthModalOpen(true, "login"))}
        className="flex items-center justify-center rounded-xl p-2 text-zinc-400 hover:text-white hover:bg-white/5 transition-all lg:flex-col lg:gap-1 lg:px-2 lg:py-2"
        title={isAuthenticated ? `Logged in as ${user?.name}. Click to log out.` : "Sign In / Sign Up"}
      >
        {isAuthenticated ? <LuLogOut className="w-5 h-5 text-cyan-400" /> : <LuUser className="w-5 h-5" />}
        <span className="hidden text-[10px] font-medium leading-none lg:block">
          {isAuthenticated ? "Logout" : "Account"}
        </span>
      </button>

      {/* Settings */}
      <button
        onClick={onOpenSettings}
        className={`flex items-center justify-center rounded-xl p-2 transition-all lg:flex-col lg:gap-1 lg:px-2 lg:py-2 ${
          isSettingsOpen
            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
            : "text-zinc-400 hover:text-white hover:bg-white/5"
        }`}
        title="Settings"
      >
        <LuSettings className="w-5 h-5" />
        <span className="hidden text-[10px] font-medium leading-none lg:block">Settings</span>
      </button>
    </div>
  );
}

export default IconStrip;
