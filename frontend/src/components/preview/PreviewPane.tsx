import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import {
  FaDesktop,
  FaMobile,
  FaCode,
} from "react-icons/fa";
import {
  LuChevronLeft,
  LuChevronRight,
  LuExternalLink,
  LuRefreshCw,
  LuDownload,
  LuSparkles,
  LuArchive,
  LuTarget,
} from "react-icons/lu";
import { useMemo, useRef, useState } from "react";
import { AppState, Settings } from "../../types";
import CodeTab from "./CodeTab";
import { Button } from "../ui/button";
import { useAppStore } from "../../store/app-store";
import { useProjectStore } from "../../store/project-store";
import { extractHtml } from "./extractHtml";
import PreviewComponent from "./PreviewComponent";
import { downloadCode } from "./download";
import { SelectAndEditToolbarButton } from "../select-and-edit/SelectAndEditControls";
import { normalizeBabelCdn } from "../../lib/babelCdn";
import ImageScanningPreview from "./ImageScanningPreview";
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
  const [desktopScale, setDesktopScale] = useState(1);
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
  const sourceImage = currentCommit ? currentCommit.inputs?.images[0] : undefined;
  const showImageScanningPreview =
    appState === AppState.CODING &&
    currentCommit !== "" &&
    currentCommit.type === "ai_create" &&
    inputMode === "image" &&
    !previewCode.trim() &&
    !!sourceImage;

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
        <div className="relative flex items-center justify-between px-4 py-2 shrink-0 border-b border-white/10 bg-slate-900/80 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <TabsList className="bg-slate-950/60 p-1 border border-white/10 rounded-xl">
              <TabsTrigger value="desktop" title="Desktop" data-testid="tab-desktop" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
                <FaDesktop />
              </TabsTrigger>
              <TabsTrigger value="mobile" title="Mobile" data-testid="tab-mobile" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
                <FaMobile />
              </TabsTrigger>
              <TabsTrigger value="code" title="Code" data-testid="tab-code" className="gap-2 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
                <FaCode />
                Code
              </TabsTrigger>
            </TabsList>

            {(activeTab === "desktop" || activeTab === "mobile") && (
              <div className="hidden sm:inline-flex items-center gap-2">
                {activeTab === "desktop" && (
                  <div className="inline-flex items-center rounded-lg bg-slate-950/60 p-1 border border-white/10">
                    <button
                      type="button"
                      onClick={() => setDesktopViewMode("fit")}
                      title="Scale down to fit the screen"
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                        desktopViewMode === "fit"
                          ? "bg-cyan-500/20 text-cyan-300 font-semibold"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Scale
                      {desktopScale < 1 && (
                        <span className="ml-1 text-cyan-400 font-bold">
                          ({Math.round(desktopScale * 100)}%)
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDesktopViewMode("actual")}
                      title="View at original size (100%)"
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                        desktopViewMode === "actual"
                          ? "bg-cyan-500/20 text-cyan-300 font-semibold"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      100%
                    </button>
                  </div>
                )}
                <Button
                  onClick={() => openInNewTab(previewCode)}
                  variant="ghost"
                  size="icon"
                  title="Open in New Tab"
                  className="h-8 w-8 text-zinc-400 hover:text-white"
                >
                  <LuExternalLink />
                </Button>
              </div>
            )}
          </div>

          {/* Version navigation */}
          {totalVersions > 0 && (
            <div className="hidden md:flex shrink-0 items-center justify-center gap-1 bg-slate-950/60 rounded-full p-1 border border-white/10 backdrop-blur-sm">
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
                className="flex items-center justify-center gap-2 px-1 cursor-pointer hover:opacity-70 transition-opacity w-32"
                title="View all versions"
              >
                <span className="text-xs font-semibold text-zinc-200 leading-none">
                  Version {currentVersionIndex + 1}
                </span>
                {currentVersionIndex === totalVersions - 1 && (
                  <span className="rounded-full bg-cyan-500/20 text-cyan-300 px-2 py-0.5 text-[10px] font-medium leading-none flex items-center h-4 border border-cyan-500/30">
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

          <div className="flex items-center gap-1.5">
            {/* Accessibility Audit Score Badge */}
            {previewCode.trim().length > 0 && (
              <button
                onClick={() => setIsA11yModalOpen(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  a11yResult.score >= 90
                    ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/60"
                    : a11yResult.score >= 70
                    ? "bg-yellow-950/40 border-yellow-500/40 text-yellow-400 hover:bg-yellow-900/60"
                    : "bg-red-950/40 border-red-500/40 text-red-400 hover:bg-red-900/60"
                }`}
                title="View WCAG Accessibility Audit Details"
              >
                <LuSparkles className="w-3.5 h-3.5" />
                <span>{a11yResult.score}% A11y</span>
              </button>
            )}

            {/* Inspect Element Toggle */}
            {canSelectAndEdit && (activeTab === "desktop" || activeTab === "mobile") && (
              <Button
                onClick={() => setIsInspectorActive(!isInspectorActive)}
                variant="ghost"
                size="sm"
                title="Inspect Canvas Element"
                className={`h-8 gap-1.5 text-xs text-zinc-300 hover:text-white border border-white/10 ${
                  isInspectorActive ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" : ""
                }`}
              >
                <LuTarget className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Inspect</span>
              </Button>
            )}

            {canSelectAndEdit &&
              (activeTab === "desktop" || activeTab === "mobile") && (
                <SelectAndEditToolbarButton />
              )}

            {/* Export Project ZIP Modal Trigger */}
            {previewCode.trim().length > 0 && (
              <Button
                onClick={() => setIsExportModalOpen(true)}
                variant="ghost"
                size="sm"
                title="Export Project ZIP"
                className="h-8 gap-1.5 text-xs bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40"
              >
                <LuArchive className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export ZIP</span>
              </Button>
            )}

            {(appState === AppState.CODE_READY || isSelectedVariantComplete) && (
              <Button
                onClick={() => downloadCode(previewCode)}
                variant="ghost"
                size="icon"
                title="Download HTML"
                className="h-8 w-8 text-zinc-400 hover:text-white"
                data-testid="download-code"
              >
                <LuDownload />
              </Button>
            )}
            <Button
              onClick={() => {
                const iframes = document.querySelectorAll("iframe");
                iframes.forEach((iframe) => {
                  if (iframe.srcdoc) {
                    const content = iframe.srcdoc;
                    iframe.srcdoc = "";
                    iframe.srcdoc = content;
                  }
                });
              }}
              variant="ghost"
              size="icon"
              title="Refresh Preview"
              className="h-8 w-8 text-zinc-400 hover:text-white"
            >
              <LuRefreshCw />
            </Button>
          </div>
        </div>

        <TabsContent value="desktop" className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col relative">
          {showImageScanningPreview ? (
            <ImageScanningPreview imageUrl={sourceImage} />
          ) : (
            <PreviewComponent
              code={previewCode}
              device="desktop"
              onScaleChange={setDesktopScale}
              viewMode={desktopViewMode}
            />
          )}
        </TabsContent>
        <TabsContent value="mobile" className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col relative">
          {showImageScanningPreview ? (
            <ImageScanningPreview imageUrl={sourceImage} />
          ) : (
            <PreviewComponent
              code={previewCode}
              device="mobile"
              viewMode="actual"
            />
          )}
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
