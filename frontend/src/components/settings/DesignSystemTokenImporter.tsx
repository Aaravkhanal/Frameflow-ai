import React, { useState } from "react";
import toast from "react-hot-toast";
import { HTTP_BACKEND_URL } from "../../config";

interface DesignSystemTokenImporterProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
}

export const DesignSystemTokenImporter: React.FC<DesignSystemTokenImporterProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [name, setName] = useState("My Custom Brand Tokens");
  const [tokenJson, setTokenJson] = useState(`{
  "colors": {
    "primary": "#6366f1",
    "secondary": "#ec4899",
    "background": "#09090b",
    "surface": "#18181b"
  },
  "typography": {
    "fontFamily": "Inter, sans-serif"
  },
  "borderRadius": {
    "lg": "0.75rem"
  }
}`);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSaveTokenSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !tokenJson.trim()) {
      toast.error("Please enter a name and token JSON/CSS.");
      return;
    }

    try {
      JSON.parse(tokenJson); // Validate JSON format
    } catch {
      toast.error("Invalid JSON format for design tokens.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${HTTP_BACKEND_URL}/api/design-systems`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          content: `Design System Tokens:\n${tokenJson.trim()}`,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save design system tokens");
      }

      toast.success("Design system tokens saved as active prompt preset!");
      onImportSuccess?.();
      onClose();
    } catch (err: unknown) {
      console.error(err);
      toast.error("Error saving design tokens.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden p-6 space-y-5 text-left">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            🎨 Import Design System Tokens
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSaveTokenSystem} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Design System Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
              placeholder="e.g. Acme Corporate Palette"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Design Tokens (JSON Format)
            </label>
            <textarea
              value={tokenJson}
              onChange={(e) => setTokenJson(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
              required
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Paste colors, typography, or Tailwind config values.
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
              disabled={isSaving}
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Token System"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
