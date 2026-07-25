import React, { useEffect, useState } from "react";

interface ElementInspectorOverlayProps {
  iframeRef: React.RefObject<HTMLIFrameElement>;
  isActive: boolean;
  onElementSelect: (snippet: string, selector: string) => void;
  onClose: () => void;
}

export const ElementInspectorOverlay: React.FC<ElementInspectorOverlayProps> = ({
  iframeRef,
  isActive,
  onElementSelect,
  onClose,
}) => {
  const [hoveredElementInfo, setHoveredElementInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!isActive || !iframeRef.current) return;

    const iframe = iframeRef.current;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    let currentHighlight: HTMLElement | null = null;
    let originalOutline = "";

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || target === doc.body || target === doc.documentElement) return;

      if (currentHighlight && currentHighlight !== target) {
        currentHighlight.style.outline = originalOutline;
      }

      currentHighlight = target;
      originalOutline = target.style.outline;
      target.style.outline = "2px dashed #6366f1";
      target.style.outlineOffset = "-2px";

      const tagName = target.tagName.toLowerCase();
      const className = target.className ? `.${target.className.trim().split(/\s+/).join(".")}` : "";
      setHoveredElementInfo(`<${tagName}${className}>`);
    };

    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const target = e.target as HTMLElement;
      if (!target) return;

      if (currentHighlight) {
        currentHighlight.style.outline = originalOutline;
      }

      const outerHTML = target.outerHTML.slice(0, 300);
      const tagName = target.tagName.toLowerCase();
      const idStr = target.id ? `#${target.id}` : "";
      const classStr = target.className ? `.${target.className.trim().split(/\s+/)[0]}` : "";
      const selector = `${tagName}${idStr}${classStr}`;

      onElementSelect(outerHTML, selector);
      onClose();
    };

    doc.addEventListener("mousemove", handleMouseMove, true);
    doc.addEventListener("click", handleClick, true);

    return () => {
      doc.removeEventListener("mousemove", handleMouseMove, true);
      doc.removeEventListener("click", handleClick, true);
      if (currentHighlight) {
        currentHighlight.style.outline = originalOutline;
      }
    };
  }, [isActive, iframeRef, onElementSelect, onClose]);

  if (!isActive) return null;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-indigo-950/90 border border-indigo-500/50 text-indigo-200 text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 backdrop-blur-sm pointer-events-auto">
      <span className="inline-block w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
      <span>
        Click any element on canvas to select for refactoring:{" "}
        <strong className="font-mono text-zinc-100">{hoveredElementInfo || "hovering..."}</strong>
      </span>
      <button
        onClick={onClose}
        className="ml-2 text-indigo-400 hover:text-zinc-100 transition-colors font-bold"
      >
        ✕
      </button>
    </div>
  );
};
