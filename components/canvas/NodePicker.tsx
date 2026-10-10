"use client";
import { useState, useEffect, useRef } from "react";
import { FileImage, Search, Sparkles, Workflow, X } from "lucide-react";
import { useWorkflowStore } from "@/store/workflow-store";

const ALL_NODES = [
  { type: "crop-image", label: "Crop Image", icon: FileImage, category: "Image", description: "Crop and position an image for your workflow.", badge: "Trigger.dev", tint: "amber" },
  { type: "gemini", label: "Gemini 3.1 Pro", icon: Sparkles, category: "Others", description: "Generate text or analyze images with Gemini.", badge: "Trigger.dev", tint: "violet" },
];
const CATEGORIES = ["Recent", "Image", "Video", "Audio", "Others"];

interface Props { onClose: () => void; canvasCenter: { x: number; y: number }; }

export function NodePicker({ onClose, canvasCenter }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Recent");
  const { addNode } = useWorkflowStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const esc = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const filtered = ALL_NODES.filter((node) => {
    const matchesQuery = !query || node.label.toLowerCase().includes(query.toLowerCase()) || node.description.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (category === "Recent" || node.category === category);
  });

  return <div className="node-picker-backdrop" onClick={onClose}>
    <section className="node-picker" role="dialog" aria-modal="true" aria-label="Add a node" onClick={(event) => event.stopPropagation()}>
      <header className="node-picker-header"><span className="node-picker-heading-icon"><Workflow size={17} /></span><div><strong>Add to workflow</strong><span>Choose a step to add to your canvas</span></div><button className="editor-icon-button" onClick={onClose} aria-label="Close node picker"><X size={16} /></button></header>
      <label className="node-picker-search"><Search size={16} /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search available nodes…" /><kbd>ESC</kbd></label>
      <nav className="node-picker-categories" aria-label="Node categories">{CATEGORIES.map((item) => <button key={item} className={category === item ? "selected" : ""} onClick={() => setCategory(item)}>{item}</button>)}</nav>
      <div className="node-picker-results">
        <div className="node-picker-section-label">{category === "Recent" ? "AVAILABLE NODES" : category.toUpperCase()}<span>{filtered.length}</span></div>
        {filtered.length ? filtered.map((node) => {
          const Icon = node.icon;
          return <button className="node-picker-option" key={node.type} onClick={() => { addNode(node.type, canvasCenter); onClose(); }}>
            <span className={`node-option-icon ${node.tint}`}><Icon size={19} /></span>
            <span className="node-option-copy"><strong>{node.label}</strong><span>{node.description}</span></span>
            <span className="node-option-badge">{node.badge}</span>
          </button>;
        }) : <div className="node-picker-empty">No nodes match “{query}”.</div>}
      </div>
      <footer className="node-picker-footer"><span>Click a node to place it at the canvas center</span><span>Esc to close</span></footer>
    </section>
  </div>;
}
