"use client";
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { useWorkflowStore } from "@/store/workflow-store";

interface Props { id: string; data: any; }

export const ResponseNode = memo(function ResponseNode({ id, data }: Props) {
  const { runningNodes } = useWorkflowStore();
  const isRunning = runningNodes.has(id);
  const status    = data.status as string | undefined;
  const output    = data.output as string | undefined;

  const borderColor = isRunning ? "#7c3aed"
    : status === "success" && output ? "#22c55e"
    : "#2a2a3d";

  return (
    <div
      className={isRunning ? "node-running" : ""}
      style={{
        position: "relative", borderRadius: 12, minWidth: 220, maxWidth: 280,
        background: "#1a1a27", border: `1.5px solid ${borderColor}`,
        boxShadow: "0 4px 24px rgba(0,0,0,0.45)",
        transition: "border-color 0.2s",
      }}
    >
      {/* Input handle */}
      <Handle type="target" position={Position.Left} id="result"
        title="Result (text)"
        style={{ left: -5, top: "50%", background: "#7c3aed", border: "2px solid #1a1a27", width: 10, height: 10, zIndex: 10 }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px", background: "#13131e",
        borderBottom: "1px solid #2a2a3d", borderRadius: "12px 12px 0 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>📤</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: "#e2e2f0" }}>Response</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4,
            background: "rgba(124,58,237,0.15)", color: "#a78bfa" }}>pre-placed</div>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: isRunning ? "#a78bfa" : output ? "#22c55e" : "#4a4a6a",
            animation: isRunning ? "pulse 1s infinite" : "none",
          }} />
        </div>
      </div>

      <div style={{ padding: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#8b8ba7", marginBottom: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7c3aed", display: "inline-block" }} />
          result
          <span style={{ color: "#4a4a6a", fontSize: 10 }}>(final workflow output)</span>
        </label>

        {output ? (
          <div>
            <div className="node-input" style={{
              fontSize: 11, maxHeight: 120, overflowY: "auto",
              whiteSpace: "pre-wrap", color: "#e2e2f0", marginBottom: 8,
            }}>
              {output}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => navigator.clipboard.writeText(output)}
                style={{ flex: 1, padding: "5px 0", fontSize: 10, borderRadius: 6, cursor: "pointer",
                  background: "rgba(124,58,237,0.12)", color: "#a78bfa",
                  border: "1px solid rgba(124,58,237,0.25)" }}>
                📋 Copy
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([output], { type: "text/plain" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = "result.txt";
                  a.click();
                }}
                style={{ flex: 1, padding: "5px 0", fontSize: 10, borderRadius: 6, cursor: "pointer",
                  background: "rgba(34,197,94,0.08)", color: "#22c55e",
                  border: "1px solid rgba(34,197,94,0.2)" }}>
                ⬇ Export
              </button>
            </div>
          </div>
        ) : (
          <div style={{ height: 64, borderRadius: 6, border: "1px dashed #2a2a3d",
            background: "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 4 }}>
            <span style={{ fontSize: 18 }}>⏳</span>
            <span style={{ fontSize: 10, color: "#4a4a6a" }}>Awaiting workflow result...</span>
          </div>
        )}
      </div>
    </div>
  );
});
