import { DesignDecodeResult } from "../../types";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../ui/accordion";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { useState } from "react";
import { LuCopy, LuSearch, LuMousePointer2 } from "react-icons/lu";
import toast from "react-hot-toast";

interface DesignDecodeDashboardProps {
  data: DesignDecodeResult;
  onHoverComponent: (selector: string | null) => void;
}

export function DesignDecodeDashboard({ data, onHoverComponent }: DesignDecodeDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied: ${text}`);
  };

  const ColorSwatch = ({ color }: { color: string }) => (
    <div
      className="flex flex-col items-center gap-1 cursor-pointer group"
      onClick={() => copyToClipboard(color)}
    >
      <div
        className="w-12 h-12 rounded-full border border-white/10 shadow-sm group-hover:scale-110 transition-transform"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-slate-400 font-mono">{color}</span>
    </div>
  );

  const filteredComponents = data.components.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.purpose.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ScrollArea className="h-full w-full bg-slate-950 text-slate-200">
      <div className="p-6 max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <LuMousePointer2 className="text-indigo-400" />
            Design Decode Analysis
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            {data.ai_explanation}
          </p>
        </div>

        {/* Visual Design */}
        <div className="space-y-4 bg-slate-900/50 p-6 rounded-xl border border-white/5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Visual Design</h2>
            <Badge variant="secondary">{data.visual_design.theme} Theme</Badge>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Primary</h3>
              <div className="flex flex-wrap gap-4">
                {data.visual_design.primary.map((c, i) => <ColorSwatch key={i} color={c} />)}
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Secondary</h3>
              <div className="flex flex-wrap gap-4">
                {data.visual_design.secondary.map((c, i) => <ColorSwatch key={i} color={c} />)}
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Background</h3>
              <div className="flex flex-wrap gap-4">
                {data.visual_design.background.map((c, i) => <ColorSwatch key={i} color={c} />)}
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Text</h3>
              <div className="flex flex-wrap gap-4">
                {data.visual_design.text.map((c, i) => <ColorSwatch key={i} color={c} />)}
              </div>
            </div>
          </div>
        </div>

        {/* Accordions for remaining sections */}
        <Accordion type="multiple" className="w-full space-y-4" defaultValue={["typography", "layout", "ux"]}>
          
          {/* Typography */}
          <AccordionItem value="typography" className="border border-white/5 bg-slate-900/50 rounded-xl px-6">
            <AccordionTrigger className="hover:no-underline text-lg font-semibold py-4">Typography</AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div className="flex flex-wrap gap-2">
                {data.typography.font_families.map((f, i) => <Badge key={i} className="bg-slate-800">{f}</Badge>)}
              </div>
              <p className="text-sm text-slate-400">{data.typography.hierarchy_explanation}</p>
              <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                <div className="p-4 bg-slate-950 rounded-lg border border-white/5">
                  <span className="block text-slate-500 mb-2">Headings</span>
                  {data.typography.heading_sizes.join(", ")}
                </div>
                <div className="p-4 bg-slate-950 rounded-lg border border-white/5">
                  <span className="block text-slate-500 mb-2">Paragraphs</span>
                  {data.typography.paragraph_sizes.join(", ")}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Layout */}
          <AccordionItem value="layout" className="border border-white/5 bg-slate-900/50 rounded-xl px-6">
            <AccordionTrigger className="hover:no-underline text-lg font-semibold py-4">Layout & Grid</AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-slate-500">System</span>
                  <p className="text-sm">{data.layout.grid_system}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-slate-500">Spacing Scale</span>
                  <p className="text-sm">{data.layout.spacing_scale}</p>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-500">Responsive Logic</span>
                <p className="text-sm">{data.layout.responsive_behavior}</p>
              </div>
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg mt-2">
                <p className="text-sm text-indigo-300">💡 {data.layout.explanation}</p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* UX & Accessibility */}
          <AccordionItem value="ux" className="border border-white/5 bg-slate-900/50 rounded-xl px-6">
            <AccordionTrigger className="hover:no-underline text-lg font-semibold py-4">UX & Interactions</AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-500">Accessibility</span>
                <p className="text-sm">{data.ux_analysis.accessibility}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-500">Micro-Interactions</span>
                <p className="text-sm">{data.ux_analysis.interactions}</p>
              </div>
            </AccordionContent>
          </AccordionItem>
          
        </Accordion>

        {/* Component Dictionary */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Component Dictionary</h2>
            <div className="relative w-64">
              <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="Search components..."
                className="pl-9 bg-slate-900/50 border-white/10 text-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredComponents.map((comp, i) => (
              <div
                key={i}
                className="p-4 bg-slate-900/50 border border-white/5 rounded-xl hover:bg-slate-800/80 hover:border-indigo-500/50 transition-all cursor-pointer group"
                onMouseEnter={() => onHoverComponent(comp.css_selector)}
                onMouseLeave={() => onHoverComponent(null)}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors">{comp.name}</h3>
                  <Badge variant="outline" className="text-[10px] font-mono bg-slate-950 text-slate-400">{comp.css_selector}</Badge>
                </div>
                <p className="text-sm text-slate-400 mb-2 line-clamp-2">{comp.purpose}</p>
                <p className="text-xs text-slate-500 font-mono bg-slate-950 p-2 rounded">{comp.styling}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
