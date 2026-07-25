import React, { useState } from "react";
import toast from "react-hot-toast";
import { HTTP_BACKEND_URL } from "../../config";

interface FigmaImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (dataUrl: string) => void;
}

export const FigmaImportModal: React.FC<FigmaImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [figmaUrl, setFigmaUrl] = useState("");
  const [personalAccessToken, setPersonalAccessToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleFetchFigma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!figmaUrl.trim()) {
      toast.error("Please enter a valid Figma file or frame URL");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${HTTP_BACKEND_URL}/api/figma/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          figmaUrl: figmaUrl.trim(),
          personalAccessToken: personalAccessToken.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to render Figma design");
      }

      toast.success("Figma design fetched successfully!");
      onImportSuccess(data.dataUrl);
      onClose();
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Error connecting to Figma API";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden p-6 space-y-5 text-left">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            🎨 Import from Figma
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleFetchFigma} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Figma File or Node URL
            </label>
            <input
              type="text"
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
              placeholder="https://www.figma.com/design/KEY/Title?node-id=123-456"
              required
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Copy link to frame or design file directly from Figma.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Figma Personal Access Token (PAT)
            </label>
            <input
              type="password"
              value={personalAccessToken}
              onChange={(e) => setPersonalAccessToken(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
              placeholder="figd_..."
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Generate in Figma &gt; Account Settings &gt; Personal Access Tokens.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? "Fetching Figma Node..." : "Fetch & Convert"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
