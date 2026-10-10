"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronRight, Download, FileUp, History, LoaderCircle, Play, Redo2, Save, Sparkles, Undo2 } from "lucide-react";
import { useWorkflowStore } from "@/store/workflow-store";

interface Props {
  onRun: (scope: "full" | "partial" | "single") => void;
  onSave: () => void;
  onExport: () => void;
  onImport: (json: string) => void;
}

export function WorkflowToolbar({ onRun, onSave, onExport, onImport }: Props) {
  const { workflowName, setWorkflowName, isSaving, isRunning, selectedNodes, undo, redo, setHistoryPanelOpen } = useWorkflowStore();
  const [editingName, setEditingName] = useState(false);
  const runScope = selectedNodes.length > 1 ? "partial" : selectedNodes.length === 1 ? "single" : "full";

  return (
    <header className="editor-toolbar">
      <div className="editor-toolbar-main">
        <Link href="/dashboard" className="editor-back" aria-label="Back to workflows"><ArrowLeft size={16} /></Link>
        <Link href="/dashboard" className="editor-brand"><span className="editor-brand-mark"><Sparkles size={15} /></span><span>FlowForge</span></Link>
        <ChevronRight className="editor-crumb" size={14} />
        <div className="editor-title-wrap">
          {editingName ? <input autoFocus className="editor-name-input" aria-label="Workflow name" value={workflowName}
            onChange={(event) => setWorkflowName(event.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={(event) => { if (event.key === "Enter") setEditingName(false); if (event.key === "Escape") setEditingName(false); }} /> :
            <button className="editor-workflow-name" onClick={() => setEditingName(true)} title="Rename workflow">{workflowName}</button>}
          <span className="editor-save-state">{isSaving ? <><LoaderCircle size={12} className="spin-icon" />Saving</> : <><Check size={12} />Saved</>}</span>
        </div>
      </div>

      <div className="editor-toolbar-actions">
        <div className="editor-action-group" aria-label="History actions">
          <button className="editor-icon-button" onClick={undo} title="Undo" aria-label="Undo"><Undo2 size={16} /></button>
          <button className="editor-icon-button" onClick={redo} title="Redo" aria-label="Redo"><Redo2 size={16} /></button>
        </div>
        <span className="editor-toolbar-divider" />
        <button className="editor-secondary-action" onClick={() => setHistoryPanelOpen(true)}><History size={15} /><span>History</span></button>
        <button className="editor-secondary-action" onClick={onExport}><Download size={15} /><span>Export</span></button>
        <label className="editor-secondary-action editor-import-action"><FileUp size={15} /><span>Import</span>
          <input type="file" accept=".json" className="hidden" aria-label="Import workflow JSON" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) { const reader = new FileReader(); reader.onload = () => onImport(reader.result as string); reader.readAsText(file); }
            event.currentTarget.value = "";
          }} />
        </label>
        <button className="editor-save-button" onClick={onSave}><Save size={15} /><span>Save</span></button>
        <button className="editor-run-button" onClick={() => onRun(runScope)} disabled={isRunning}>
          {isRunning ? <LoaderCircle size={15} className="spin-icon" /> : <Play size={14} fill="currentColor" />}
          <span>{isRunning ? "Running…" : selectedNodes.length ? `Run ${selectedNodes.length} selected` : "Run workflow"}</span>
        </button>
      </div>
    </header>
  );
}
