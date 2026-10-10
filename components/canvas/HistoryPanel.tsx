"use client";
import { useState } from "react";
import { Activity, ChevronDown, History as HistoryIcon, Inbox, X } from "lucide-react";
import { useWorkflowStore } from "@/store/workflow-store";
import { formatRelativeTime } from "@/lib/utils";
import type { WorkflowRunResult, NodeRunResult } from "@/types/workflow";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string; label: string }> = {
    success: { bg: "rgba(34,197,94,0.15)", text: "#22c55e", label: "success" },
    failed: { bg: "rgba(239,68,68,0.15)", text: "#ef4444", label: "failed" },
    partial: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b", label: "partial" },
    running: { bg: "rgba(124,58,237,0.15)", text: "#a78bfa", label: "running" },
  };
  const c = colors[status] ?? colors.failed;
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: c.bg, color: c.text }}>
      {c.label}
    </span>
  );
}

function NodeRunRow({ nr }: { nr: NodeRunResult }) {
  return (
    <div className="flex items-start gap-2 pl-4 py-1.5 text-xs" style={{ borderLeft: "1px solid #2a2a3d" }}>
      <div className="flex-shrink-0 mt-0.5">
        {nr.status === "success" ? "✅" : nr.status === "error" ? "❌" : "⏭️"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span style={{ color: "#e2e2f0" }}>{nr.nodeLabel}</span>
          <span style={{ color: "#4a4a6a" }}>{nr.duration.toFixed(1)}s</span>
        </div>
        {nr.output && (
          <div className="mt-0.5 truncate" style={{ color: "#8b8ba7" }}>
            → {nr.output.length > 40 ? nr.output.slice(0, 40) + "..." : nr.output}
          </div>
        )}
        {nr.error && (
          <div className="mt-0.5 truncate" style={{ color: "#ef4444" }}>
            {nr.error}
          </div>
        )}
      </div>
    </div>
  );
}

function RunCard({ run, index }: { run: WorkflowRunResult; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const nodeRuns: NodeRunResult[] = run.nodeRuns ?? [];

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #2a2a3d", background: "rgba(255,255,255,0.02)" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2.5 flex items-start gap-2 text-left transition-colors"
        style={{ background: expanded ? "rgba(124,58,237,0.06)" : "transparent" }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium" style={{ color: "#e2e2f0" }}>Run #{index}</span>
            <StatusBadge status={run.status} />
            <span className="text-xs" style={{ color: "#4a4a6a" }}>
              {run.scope === "full" ? "Full Workflow" : run.scope === "partial" ? "Multi-select" : "Single Node"}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs" style={{ color: "#8b8ba7" }}>
              {formatRelativeTime(run.createdAt)}
            </span>
            {run.duration != null && (
              <span className="text-xs" style={{ color: "#8b8ba7" }}>{run.duration.toFixed(1)}s</span>
            )}
          </div>
        </div>
        <ChevronDown size={14} className={`history-chevron ${expanded ? "expanded" : ""}`} />
      </button>

      {expanded && nodeRuns.length > 0 && (
        <div className="px-3 pb-3 space-y-0.5" style={{ borderTop: "1px solid #2a2a3d" }}>
          <div className="pt-2" />
          {nodeRuns.map((nr) => <NodeRunRow key={nr.nodeId} nr={nr} />)}
        </div>
      )}
    </div>
  );
}

export function HistoryPanel() {
  const { runs, historyPanelOpen, setHistoryPanelOpen } = useWorkflowStore();

  if (!historyPanelOpen) {
    return (
      <button
        onClick={() => setHistoryPanelOpen(true)}
        className="history-open-button"
      >
        <HistoryIcon size={15} /> History {runs.length > 0 && <span className="history-count">{runs.length}</span>}
      </button>
    );
  }

  return (
    <div
      className="history-panel"
    >
      {/* Header */}
      <div className="history-header">
        <div className="history-heading">
          <span className="history-heading-icon"><Activity size={16} /></span>
          <div>
            <div className="history-title">Run history</div>
            <div className="history-subtitle">{runs.length} run{runs.length !== 1 ? "s" : ""}</div>
          </div>
        </div>
        <button
          onClick={() => setHistoryPanelOpen(false)}
          className="editor-icon-button"
          aria-label="Close history panel"
        ><X size={15} /></button>
      </div>

      {/* Runs */}
      <div className="history-runs">
        {runs.length === 0 ? (
          <div className="history-empty">
            <span><Inbox size={22} /></span>
            <strong>No runs yet</strong>
            <div>Execute the workflow to see each run here.</div>
          </div>
        ) : (
          runs.map((run, i) => (
            <RunCard key={run.id} run={run} index={runs.length - i} />
          ))
        )}
      </div>
    </div>
  );
}
