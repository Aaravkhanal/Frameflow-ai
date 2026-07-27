import React from "react";
import { DesignSystem, Settings } from "../../types";
import { Stack } from "../../lib/stacks";
import UnifiedInputPane from "../unified-input/UnifiedInputPane";

interface Props {
  doCreate: (
    images: string[],
    inputMode: "image" | "video",
    textPrompt?: string,
    isAssetExtractionEnabled?: boolean
  ) => void;
  doCreateFromText: (text: string) => void;
  importFromCode: (code: string, stack: Stack) => void;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  designSystems: DesignSystem[];
  onAddNewDesignSystem: () => void;
  onManageDesignSystems: () => void;
}

import { useAuthStore } from "../../store/authStore";
import { Button } from "../ui/button";

const StartPane: React.FC<Props> = ({
  doCreate,
  doCreateFromText,
  importFromCode,
  settings,
  setSettings,
  designSystems,
  onAddNewDesignSystem,
  onManageDesignSystems,
}) => {
  const { user, isAuthenticated, setAuthModalOpen, logout } = useAuthStore();

  return (
    <div className="relative flex flex-col justify-center items-center py-8 min-h-screen">
      {/* Top right auth strip */}
      <div className="absolute top-4 right-6 z-50">
        {!isAuthenticated ? (
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              onClick={() => setAuthModalOpen(true, "login")}
              className="text-zinc-400 hover:text-white"
            >
              Sign In
            </Button>
            <Button 
              onClick={() => setAuthModalOpen(true, "signup")}
              className="bg-cyan-600 hover:bg-cyan-500 text-white border-0 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
            >
              Get Started
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-4 bg-slate-900/80 px-4 py-2 rounded-full border border-white/5 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shadow-lg">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <span className="text-sm font-medium text-slate-300">{user?.name}</span>
            </div>
            <div className="w-px h-4 bg-white/10"></div>
            <button 
              onClick={() => logout()}
              className="text-xs text-zinc-500 hover:text-red-400 transition-colors font-medium"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>

      <UnifiedInputPane
        doCreate={doCreate}
        doCreateFromText={doCreateFromText}
        importFromCode={importFromCode}
        settings={settings}
        setSettings={setSettings}
        designSystems={designSystems}
        onAddNewDesignSystem={onAddNewDesignSystem}
        onManageDesignSystems={onManageDesignSystems}
      />
    </div>
  );
};

export default StartPane;
