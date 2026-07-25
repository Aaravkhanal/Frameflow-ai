import { useRef, useState } from "react";
import { LuGlobe2 } from "react-icons/lu";
import { HTTP_BACKEND_URL } from "../../../config";
import { Input } from "../../ui/input";
import { toast } from "react-hot-toast";
import { DesignSystemSelectorProps } from "../../settings/DesignSystemSelector";
import { Stack } from "../../../lib/stacks";
import ScreenshotToCodeControls from "../ScreenshotToCodeControls";

interface Props {
  screenshotOneApiKey: string | null;
  doCreate: (
    urls: string[],
    inputMode: "image" | "video",
    textPrompt?: string,
    isAssetExtractionEnabled?: boolean,
  ) => void;
  stack: Stack;
  setStack: (stack: Stack) => void;
  designSystem: DesignSystemSelectorProps;
}

function isFigmaUrl(url: string): boolean {
  return /^https?:\/\/([\w.-]*\.)?figma\.com\//i.test(url.trim());
}

function UrlTab({
  doCreate,
  screenshotOneApiKey,
  stack,
  setStack,
  designSystem,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [textPrompt, setTextPrompt] = useState("");
  const [figmaToken, setFigmaToken] = useState("");
  const [isAssetExtractionEnabled, setIsAssetExtractionEnabled] = useState(true);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  async function takeScreenshot() {
    const trimmedReferenceUrl = referenceUrl.trim();

    if (!trimmedReferenceUrl) {
      toast.error("Please enter a URL");
      return;
    }

    if (trimmedReferenceUrl.toLowerCase().startsWith("file://")) {
      toast.error(
        "file:// URLs can't be screenshot. If you're trying to import a local file, please use the Import tab.",
      );
      return;
    }

    // Handle Direct Figma URLs
    if (isFigmaUrl(trimmedReferenceUrl)) {
      try {
        setIsLoading(true);
        const response = await fetch(`${HTTP_BACKEND_URL}/api/figma/render`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            figmaUrl: trimmedReferenceUrl,
            personalAccessToken: figmaToken.trim() || undefined,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.detail || "Failed to render Figma design");
        }

        toast.success("Figma frame rendered successfully!");
        doCreate([data.dataUrl], "image", textPrompt, isAssetExtractionEnabled);
      } catch (err: unknown) {
        console.error(err);
        const message = err instanceof Error ? err.message : "Error fetching Figma frame";
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // We allow it to pass through to backend, which might have SCREENSHOTONE_API_KEY in its env.
    // If not, the backend will return a 400.
    const apiKey = screenshotOneApiKey || "";

    try {
      setIsLoading(true);
      const response = await fetch(`${HTTP_BACKEND_URL}/api/screenshot`, {
        method: "POST",
        body: JSON.stringify({
          url: trimmedReferenceUrl,
          apiKey: apiKey,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to capture screenshot");
      }

      const res = await response.json();
      doCreate(
        [res.url],
        "image",
        textPrompt,
        isAssetExtractionEnabled,
      );
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to capture screenshot";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  const handleTextKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key === "Enter" && !event.shiftKey && !isLoading) {
      event.preventDefault();
      takeScreenshot();
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-xl">
        <div className="flex items-start gap-3 border-b border-white/10 px-4 py-4 sm:px-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <LuGlobe2 className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              Screenshot from URL or Figma Link
            </h3>
            <p className="mt-0.5 text-xs leading-5 text-zinc-400">
              Enter a public webpage or Figma frame URL to generate pixel-perfect code.
            </p>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4 sm:px-5">
          <div>
            <label
              htmlFor="reference-url"
              className="block text-xs font-medium text-zinc-300 mb-1"
            >
              Website or Figma URL
            </label>
            <Input
              id="reference-url"
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder="https://example.com or figma.com/design/..."
              onChange={(event) => setReferenceUrl(event.target.value)}
              value={referenceUrl}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !isLoading) {
                  event.preventDefault();
                  takeScreenshot();
                }
              }}
              className="h-11 w-full bg-slate-950/60 border-white/10 focus:border-cyan-500"
              data-testid="url-input"
            />
          </div>

          {isFigmaUrl(referenceUrl) && (
            <div className="space-y-1 animate-in fade-in duration-200">
              <label className="block text-xs font-medium text-cyan-400">
                Figma Personal Access Token (Optional if set in backend)
              </label>
              <Input
                type="password"
                placeholder="figd_..."
                value={figmaToken}
                onChange={(e) => setFigmaToken(e.target.value)}
                className="h-9 w-full bg-slate-950/60 border-cyan-500/30 text-xs"
              />
              <p className="text-[11px] text-cyan-300/80">
                Figma link detected! FrameFlow AI will render this frame directly.
              </p>
            </div>
          )}

          {!isFigmaUrl(referenceUrl) && (
            <p className="text-[11px] text-zinc-500">
              Requires ScreenshotOne API key in Settings (or paste a Figma URL).
            </p>
          )}
        </div>
      </div>

      <ScreenshotToCodeControls
        textPrompt={textPrompt}
        onTextPromptChange={setTextPrompt}
        textInputRef={textInputRef}
        onTextInputKeyDown={handleTextKeyDown}
        stack={stack}
        setStack={setStack}
        designSystem={designSystem}
        showAssetExtraction
        isAssetExtractionEnabled={isAssetExtractionEnabled}
        onAssetExtractionChange={setIsAssetExtractionEnabled}
        onGenerate={takeScreenshot}
        actionLabel={isFigmaUrl(referenceUrl) ? "Fetch Figma & Generate" : "Capture & Generate"}
        loadingActionLabel="Capturing…"
        isActionLoading={isLoading}
        actionTestId="url-capture"
      />
    </div>
  );
}

export default UrlTab;
