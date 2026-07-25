import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { Search, Code2, LayoutTemplate, Settings, Download, History as HistoryIcon } from "lucide-react";
import { useAppStore } from "../../store/app-store";
import { AppState } from "../../types";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const { setAppState } = useAppStore();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pt-[15vh]">
      <div 
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="relative z-[101] w-full max-w-[600px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/95 shadow-2xl shadow-cyan-900/20 backdrop-blur-xl">
        <Command 
          className="flex h-full w-full flex-col overflow-hidden bg-transparent"
          shouldFilter={true}
        >
          <div className="flex items-center border-b border-slate-700/50 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
            <Command.Input 
              autoFocus
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Type a command or search..."
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false);
              }}
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden p-2">
            <Command.Empty className="py-6 text-center text-sm text-slate-500">
              No results found.
            </Command.Empty>

            <Command.Group heading="Actions" className="px-2 py-1.5 text-xs font-medium text-slate-400">
              <Command.Item 
                className="relative flex cursor-default select-none items-center rounded-md px-2 py-2 text-sm text-slate-200 outline-none hover:bg-cyan-900/30 hover:text-cyan-100 aria-selected:bg-cyan-900/30 aria-selected:text-cyan-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 transition-colors"
                onSelect={() => {
                  setAppState(AppState.INITIAL);
                  setOpen(false);
                }}
              >
                <Code2 className="mr-2 h-4 w-4" />
                Generate new code
              </Command.Item>
              
              <Command.Item 
                className="relative flex cursor-default select-none items-center rounded-md px-2 py-2 text-sm text-slate-200 outline-none hover:bg-cyan-900/30 hover:text-cyan-100 aria-selected:bg-cyan-900/30 aria-selected:text-cyan-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 transition-colors"
                onSelect={() => {
                  setOpen(false);
                }}
              >
                <LayoutTemplate className="mr-2 h-4 w-4" />
                Inspect components
              </Command.Item>
              
              <Command.Item 
                className="relative flex cursor-default select-none items-center rounded-md px-2 py-2 text-sm text-slate-200 outline-none hover:bg-cyan-900/30 hover:text-cyan-100 aria-selected:bg-cyan-900/30 aria-selected:text-cyan-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 transition-colors"
                onSelect={() => {
                  setOpen(false);
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Export Project
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Navigate" className="px-2 py-1.5 text-xs font-medium text-slate-400 mt-2">
              <Command.Item 
                className="relative flex cursor-default select-none items-center rounded-md px-2 py-2 text-sm text-slate-200 outline-none hover:bg-cyan-900/30 hover:text-cyan-100 aria-selected:bg-cyan-900/30 aria-selected:text-cyan-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 transition-colors"
                onSelect={() => setOpen(false)}
              >
                <HistoryIcon className="mr-2 h-4 w-4" />
                <span>View History</span>
              </Command.Item>
              
              <Command.Item 
                className="relative flex cursor-default select-none items-center rounded-md px-2 py-2 text-sm text-slate-200 outline-none hover:bg-cyan-900/30 hover:text-cyan-100 aria-selected:bg-cyan-900/30 aria-selected:text-cyan-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 transition-colors"
                onSelect={() => {
                  setOpen(false);
                }}
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Command.Item>
            </Command.Group>
            
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
