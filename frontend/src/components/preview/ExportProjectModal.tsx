import React, { useState } from "react";
import toast from "react-hot-toast";
import { HTTP_BACKEND_URL } from "../../config";

interface ExportProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
}

export const ExportProjectModal: React.FC<ExportProjectModalProps> = ({
  isOpen,
  onClose,
  code,
}) => {
  const [projectName, setProjectName] = useState("my-frameflow-app");
  const [template, setTemplate] = useState<"react-tailwind" | "html-css">("react-tailwind");
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    if (!code) {
      toast.error("No code available to export");
      return;
    }

    setIsExporting(true);
    try {
      const response = await fetch(`${HTTP_BACKEND_URL}/api/export-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          projectName,
          template,
        }),
      });

      if (!response.ok) {
        throw new Error(`Export failed with status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName || "project"}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Project ZIP generated successfully!");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to export project ZIP.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden p-6 space-y-5 text-left">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            📦 Export Full Project ZIP
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
              placeholder="my-awesome-app"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Project Structure Template
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTemplate("react-tailwind")}
                className={`p-3 rounded-lg border text-left transition-all ${
                  template === "react-tailwind"
                    ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <div className="text-sm font-semibold text-zinc-100">Vite + React</div>
                <div className="text-xs text-zinc-400 mt-1">
                  Full TSX, Vite config, Tailwind & package.json
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTemplate("html-css")}
                className={`p-3 rounded-lg border text-left transition-all ${
                  template === "html-css"
                    ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <div className="text-sm font-semibold text-zinc-100">Standalone HTML</div>
                <div className="text-xs text-zinc-400 mt-1">
                  Simple index.html with README documentation
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isExporting ? "Generating ZIP..." : "Download Project ZIP"}
          </button>
        </div>
      </div>
    </div>
  );
};
