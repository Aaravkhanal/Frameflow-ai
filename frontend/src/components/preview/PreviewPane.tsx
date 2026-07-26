import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import {
  FaDesktop,
  FaMobile,
  FaCode,
} from "react-icons/fa";
import { LuChevronLeft, LuChevronRight, LuExternalLink, LuSparkles, LuTarget, LuDownload } from "react-icons/lu";
import { useMemo, useRef, useState } from "react";
import { AppState, Settings } from "../../types";
import CodeTab from "./CodeTab";
import { Button } from "../ui/button";
import { useAppStore } from "../../store/app-store";
import { useProjectStore } from "../../store/project-store";
import { extractHtml } from "./extractHtml";
import PreviewComponent from "./PreviewComponent";
import { SelectAndEditToolbarButton } from "../select-and-edit/SelectAndEditControls";
import { normalizeBabelCdn } from "../../lib/babelCdn";
import { auditAccessibility } from "../../lib/a11yAuditor";
import { AccessibilityAuditModal } from "./AccessibilityAuditModal";
import { ExportProjectModal } from "./ExportProjectModal";
import { ElementInspectorOverlay } from "./ElementInspectorOverlay";
import toast from "react-hot-toast";

function prepareHtmlForNewTab(code: string) {
  const html = normalizeBabelCdn(code);
  if (/<base\s/i.test(html)) return html;

  const baseTag = `<base href="${window.location.origin}/">`;
  return html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}${baseTag}`);
}

function openInNewTab(code: string) {
  const blob = new Blob([prepareHtmlForNewTab(code)], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

interface Props {
  settings: Settings;
  onOpenVersions: () => void;
}

function PreviewPane({ settings, onOpenVersions }: Props) {
  const { appState } = useAppStore();
  const { inputMode, head, commits, setHead } = useProjectStore();
  const [activeTab, setActiveTab] = useState("desktop");
  const [desktopViewMode, setDesktopViewMode] = useState<"fit" | "actual">("fit");
  const [isA11yModalOpen, setIsA11yModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isInspectorActive, setIsInspectorActive] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sorted commit list for version navigation
  const sortedCommits = useMemo(() =>
    Object.values(commits).sort(
      (a, b) => new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
    ), [commits]);

  const currentVersionIndex = sortedCommits.findIndex(c => c.hash === head);
  const totalVersions = sortedCommits.length;
  const canGoPrev = currentVersionIndex > 0;
  const canGoNext = currentVersionIndex < totalVersions - 1;

  const currentCommit = head && commits[head] ? commits[head] : "";
  const currentCode = currentCommit
    ? currentCommit.variants[currentCommit.selectedVariantIndex].code
    : "";

  const isSelectedVariantComplete =
    head &&
    commits[head] &&
    commits[head].variants[commits[head].selectedVariantIndex].status ===
      "complete";

  const previewCode =
    inputMode === "video" && appState === AppState.CODING
      ? extractHtml(currentCode)
      : currentCode;
  const canSelectAndEdit =
    appState === AppState.CODE_READY || !!isSelectedVariantComplete;

  const a11yResult = useMemo(() => {
    return auditAccessibility(previewCode);
  }, [previewCode]);

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-white/5 bg-slate-900/60 backdrop-blur-xl">
            {/* Left: Viewport Controls */}
            <div className="flex items-center gap-2">
              {canSelectAndEdit && (activeTab === "desktop" || activeTab === "mobile") && (
                <div className="mr-2 border-r border-white/10 pr-2">
                  <SelectAndEditToolbarButton />
                </div>
              )}
              
              <TabsList className="bg-slate-950/60 border border-white/10 p-0.5 rounded-lg shadow-inner">
                <TabsTrigger
                  value="desktop"
                  className="rounded-md px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 data-[state=active]:shadow-sm data-[state=active]:border-cyan-500/40"
                >
                  <FaDesktop className="mr-1.5" /> Desktop
                </TabsTrigger>
                <TabsTrigger
                  value="mobile"
                  className="rounded-md px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 data-[state=active]:shadow-sm data-[state=active]:border-cyan-500/40"
                >
                  <FaMobile className="mr-1.5" /> Mobile
                </TabsTrigger>
                <TabsTrigger
                  value="code"
                  className="rounded-md px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 data-[state=active]:shadow-sm data-[state=active]:border-cyan-500/40"
                >
                  <FaCode className="mr-1.5" /> Code
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Middle: Zoom Controls */}
            {activeTab === "desktop" && (
              <div className="flex items-center gap-1 bg-slate-950/60 rounded-lg p-0.5 border border-white/10 shadow-inner">
                <button
                  type="button"
                  onClick={() => setDesktopViewMode("fit")}
                  title="Fit to screen"
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    desktopViewMode === "fit"
                      ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Fit
                </button>
                <button
                  type="button"
                  onClick={() => setDesktopViewMode("actual")}
                  title="View at original size (100%)"
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    desktopViewMode === "actual"
                      ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  100%
                </button>
              </div>
            )}

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {/* Version Selector */}
              {totalVersions > 0 && (
                <div className="flex items-center justify-center gap-1 bg-slate-950/60 rounded-full p-1 border border-white/10 backdrop-blur-sm mr-2">
                  <Button
                    onClick={() => canGoPrev && setHead(sortedCommits[currentVersionIndex - 1].hash)}
                    variant="ghost"
                    size="icon"
                    title="Previous version"
                    className={`h-6 w-6 rounded-full hover:bg-white/10 ${!canGoPrev ? "opacity-30 cursor-not-allowed" : ""}`}
                    disabled={!canGoPrev}
                  >
                    <LuChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <div
                    onClick={onOpenVersions}
                    className="flex items-center justify-center gap-2 px-2 cursor-pointer hover:opacity-70 transition-opacity min-w-[80px]"
                    title="View all versions"
                  >
                    <span className="text-xs font-semibold text-zinc-200 leading-none">
                      v{currentVersionIndex + 1}
                    </span>
                    {currentVersionIndex === totalVersions - 1 && (
                      <span className="rounded-full bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 text-[10px] font-medium leading-none flex items-center border border-cyan-500/30">
                        Latest
                      </span>
                    )}
                  </div>
                  <Button
                    onClick={() => canGoNext && setHead(sortedCommits[currentVersionIndex + 1].hash)}
                    variant="ghost"
                    size="icon"
                    title="Next version"
                    className={`h-6 w-6 rounded-full hover:bg-white/10 ${!canGoNext ? "opacity-30 cursor-not-allowed" : ""}`}
                    disabled={!canGoNext}
                  >
                    <LuChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}

              {/* Toolbar Buttons */}
              <div className="flex items-center gap-1">
                <Button
                  onClick={() => setIsA11yModalOpen(true)}
                  variant="ghost"
                  size="icon"
                  title="Accessibility Audit"
                  className={`h-8 w-8 text-zinc-400 hover:text-cyan-400`}
                >
                  <LuSparkles className="w-4 h-4" />
                </Button>

                {canSelectAndEdit && (activeTab === "desktop" || activeTab === "mobile") && (
                  <Button
                    onClick={() => setIsInspectorActive(!isInspectorActive)}
                    variant="ghost"
                    size="icon"
                    title="Inspect Canvas Element"
                    className={`h-8 w-8 text-zinc-400 hover:text-cyan-400 ${
                      isInspectorActive ? "bg-cyan-500/20 text-cyan-300" : ""
                    }`}
                  >
                    <LuTarget className="w-4 h-4" />
                  </Button>
                )}

                <Button
                  onClick={() => setIsExportModalOpen(true)}
                  variant="ghost"
                  size="icon"
                  title="Export Project"
                  className="h-8 w-8 text-zinc-400 hover:text-cyan-400"
                >
                  <LuDownload className="w-4 h-4" />
                </Button>

                <Button
                  onClick={() => openInNewTab(previewCode)}
                  variant="ghost"
                  size="icon"
                  title="Open in New Tab"
                  className="h-8 w-8 text-zinc-400 hover:text-cyan-400"
                >
                  <LuExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <TabsContent value="desktop" className="flex-1 overflow-hidden m-0 p-4">
            <div className="h-full flex items-center justify-center p-4 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')]">
              <div 
                className={`relative overflow-hidden rounded-[20px] shadow-[0_0_50px_rgba(6,182,212,0.1)] border-8 border-slate-900 bg-white ring-1 ring-white/10 transition-all duration-300 ${
                  desktopViewMode === "actual" 
                    ? "w-full h-full overflow-auto border-0 rounded-lg" 
                    : "w-full h-full max-w-[1200px]"
                }`}
              >
                {/* Macbook camera notch */}
                {desktopViewMode === "fit" && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-4 bg-slate-900 rounded-b-xl z-50 flex justify-center items-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-900/50 flex items-center justify-center">
                      <div className="w-0.5 h-0.5 rounded-full bg-blue-400"></div>
                    </div>
                  </div>
                )}
                
                {appState === AppState.CODING && !previewCode.trim() ? (
                  <div className="flex h-full w-full flex-col items-center justify-center p-10 bg-slate-50 text-slate-400">
                    <LuSparkles className="h-12 w-12 text-cyan-400 mb-4 animate-pulse" />
                    <div className="text-xl font-medium text-slate-700">AI is crafting your UI</div>
                    <div className="mt-2 text-sm max-w-sm text-center">Parsing components, matching styles, and building the layout tree...</div>
                  </div>
                ) : (
                  <>
                    <PreviewComponent
                      code={previewCode}
                      device="desktop"
                      viewMode={desktopViewMode}
                    />
                    {isInspectorActive && <ElementInspectorOverlay iframeRef={iframeRef} isActive={isInspectorActive} onClose={() => setIsInspectorActive(false)} onElementSelect={() => {}} />}
                  </>
                )}
              </div>
            </div>
            {/* Processing Stats Row */}
            <div className="h-10 mt-2 rounded-lg bg-slate-900/60 border border-white/5 backdrop-blur-xl flex items-center justify-between px-4 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1"><span className="text-cyan-400">Objects:</span> 24</span>
                <span className="flex items-center gap-1"><span className="text-cyan-400">Components:</span> 12</span>
                <span className="flex items-center gap-1"><span className="text-cyan-400">Time:</span> 1.2s</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">✓ Ready</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="mobile" className="flex-1 overflow-hidden m-0 p-4">
            <div className="h-full flex items-center justify-center p-4 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')]">
              <div className="relative h-[844px] w-[390px] max-h-full shrink-0 overflow-hidden rounded-[3rem] border-[12px] border-slate-900 bg-white ring-1 ring-white/10 shadow-[0_0_50px_rgba(6,182,212,0.15)]">
                {/* Dynamic Island */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[120px] h-7 bg-black rounded-full z-50"></div>
                {appState === AppState.CODING && !previewCode.trim() ? (
                  <div className="flex h-full w-full items-center justify-center bg-slate-50">
                    <LuSparkles className="h-8 w-8 text-cyan-400 animate-pulse" />
                  </div>
                ) : (
                  <>
                    <PreviewComponent
                      code={previewCode}
                      device="mobile"
                      viewMode="actual"
                    />
                    {isInspectorActive && <ElementInspectorOverlay iframeRef={iframeRef} isActive={isInspectorActive} onClose={() => setIsInspectorActive(false)} onElementSelect={() => {}} />}
                  </>
                )}
              </div>
            </div>
          </TabsContent>

        <TabsContent value="code" className="flex-1 min-h-0 mt-0 overflow-auto">
          <CodeTab
            code={previewCode}
            setCode={() => {}}
            settings={settings}
          />
        </TabsContent>
      </Tabs>

      {/* Modals & Overlays */}
      <AccessibilityAuditModal
        isOpen={isA11yModalOpen}
        onClose={() => setIsA11yModalOpen(false)}
        auditResult={a11yResult}
        onApplyFixes={(fixedCode) => {
          useAppStore.getState().setUpdateInstruction(fixedCode);
          toast.success("Accessibility fixes loaded into the prompt box. Click 'Update' to apply them.");
        }}
      />

      <ExportProjectModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        code={previewCode}
      />

      <ElementInspectorOverlay
        iframeRef={iframeRef}
        isActive={isInspectorActive}
        onClose={() => setIsInspectorActive(false)}
        onElementSelect={(snippet) => {
          toast.success("Element snippet selected for refactoring!");
          console.log("Selected element for refactoring:", snippet);
        }}
      />
    </div>
  );
}

export default PreviewPane;
