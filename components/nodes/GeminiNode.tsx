"use client";
import { memo, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { useWorkflowStore } from "@/store/workflow-store";

interface Props { id: string; data: any; }

const MODELS = [
  { value: "gemini-2.0-flash",      label: "Gemini 2.0 Flash" },
  { value: "gemini-1.5-pro",        label: "Gemini 1.5 Pro" },
  { value: "gemini-1.5-flash",      label: "Gemini 1.5 Flash" },
  { value: "gemini-2.0-pro-exp",    label: "Gemini 2.0 Pro (exp)" },
];

export const GeminiNode = memo(function GeminiNode({ id, data }: Props) {
  const { updateNodeData, deleteNode, runningNodes } = useWorkflowStore();
  const isRunning  = runningNodes.has(id);
  const [settingsOpen, setSettingsOpen] = useState(data.settingsOpen ?? false);
  const connected  = (data.connectedInputs ?? {}) as Record<string, boolean>;

  const status      = data.status as string | undefined;
  const borderColor = isRunning ? "#7c3aed"
    : status === "success" ? "#22c55e"
    : status === "error"   ? "#ef4444"
    : "#2a2a3d";

  return (
    <div
      className={isRunning ? "node-running" : ""}
      style={{
        position: "relative", borderRadius: 12, minWidth: 264, maxWidth: 320,
        background: "#1a1a27", border: `1.5px solid ${borderColor}`,
        boxShadow: "0 4px 24px rgba(0,0,0,0.45)",
        transition: "border-color 0.2s",
      }}
    >
      {/* Input handles — positioned absolutely on left edge */}
      <Handle type="target" position={Position.Left} id="prompt"
        title="Prompt (text)"
        style={{ left: -5, top: 80, background: "#7c3aed", border: "2px solid #1a1a27", width: 10, height: 10, zIndex: 10 }} />
      <Handle type="target" position={Position.Left} id="system-prompt"
        title="System Prompt (text)"
        style={{ left: -5, top: 130, background: "#6366f1", border: "2px solid #1a1a27", width: 10, height: 10, zIndex: 10 }} />
      <Handle type="target" position={Position.Left} id="vision"
        title="Image / Vision"
        style={{ left: -5, top: 180, background: "#f59e0b", border: "2px solid #1a1a27", width: 10, height: 10, zIndex: 10 }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px", background: "#13131e",
        borderBottom: "1px solid #2a2a3d", borderRadius: "12px 12px 0 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>✨</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: "#e2e2f0" }}>
            {(data.label as string) || "Gemini 3.1 Pro"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: isRunning ? "#a78bfa" : status === "success" ? "#22c55e" : status === "error" ? "#ef4444" : "#4a4a6a",
            animation: isRunning ? "pulse 1s infinite" : "none",
          }} />
          <button onClick={() => deleteNode(id)}
            style={{ width: 16, height: 16, background: "transparent", border: "none",
              cursor: "pointer", color: "#8b8ba7", display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 4, fontSize: 10 }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.2)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >✕</button>
        </div>
      </div>

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Model selector */}
        <div>
          <label style={{ display: "block", fontSize: 11, color: "#8b8ba7", marginBottom: 4 }}>Model</label>
          <select className="node-input" value={data.model ?? "gemini-2.0-flash"}
            onChange={(e) => updateNodeData(id, { model: e.target.value })}>
            {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        {/* Prompt */}
        <div>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#8b8ba7", marginBottom: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7c3aed", display: "inline-block" }} />
            Prompt {connected["prompt"] && <span style={{ color: "#a78bfa", fontSize: 10 }}>(wired)</span>}
          </label>
          <textarea className="node-input" rows={2}
            placeholder="Enter your prompt..."
            value={(data.prompt as string) ?? ""}
            disabled={!!connected["prompt"]}
            onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
            style={{ resize: "none" }}
          />
        </div>

        {/* System Prompt */}
        <div>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#8b8ba7", marginBottom: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1", display: "inline-block" }} />
            System Prompt {connected["system-prompt"] && <span style={{ color: "#a78bfa", fontSize: 10 }}>(wired)</span>}
          </label>
          <textarea className="node-input" rows={2}
            placeholder="Optional system instructions..."
            value={(data.systemPrompt as string) ?? ""}
            disabled={!!connected["system-prompt"]}
            onChange={(e) => updateNodeData(id, { systemPrompt: e.target.value })}
            style={{ resize: "none" }}
          />
        </div>

        {/* Vision indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#8b8ba7" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
          Image (Vision) {connected["vision"]
            ? <span style={{ color: "#fbbf24" }}>(connected — accepts multiple)</span>
            : <span style={{ color: "#4a4a6a" }}>(optional)</span>}
        </div>

        {/* Settings collapsible */}
        <button onClick={() => setSettingsOpen(!settingsOpen)}
          style={{ width: "100%", textAlign: "left", padding: "6px 8px", fontSize: 11,
            background: "rgba(255,255,255,0.04)", border: "1px solid #2a2a3d",
            borderRadius: 6, color: "#8b8ba7", cursor: "pointer" }}>
          ⚙ Settings {settingsOpen ? "▲" : "▼"}
        </button>

        {settingsOpen && (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #2a2a3d",
            borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "#8b8ba7", marginBottom: 4 }}>
                Temperature ({(data.temperature as number) ?? 0.7})
              </label>
              <input type="range" min={0} max={2} step={0.05}
                value={(data.temperature as number) ?? 0.7}
                onChange={(e) => updateNodeData(id, { temperature: parseFloat(e.target.value) })}
                style={{ width: "100%", accentColor: "#7c3aed" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "#8b8ba7", marginBottom: 4 }}>Max Tokens</label>
              <input type="number" min={64} max={8192} className="node-input"
                value={(data.maxTokens as number) ?? 1024}
                onChange={(e) => updateNodeData(id, { maxTokens: parseInt(e.target.value) })} />
            </div>
          </div>
        )}

        {/* Running state */}
        {isRunning && (
          <div style={{ fontSize: 11, padding: "6px 10px", borderRadius: 6,
            background: "rgba(124,58,237,0.12)", color: "#a78bfa",
            animation: "pulse 1.5s ease-in-out infinite", textAlign: "center" }}>
            ⏳ Running via Trigger.dev...
          </div>
        )}

        {/* Output */}
        {!isRunning && data.output && (
          <div>
            <label style={{ display: "block", fontSize: 11, color: "#8b8ba7", marginBottom: 4 }}>Response</label>
            <div className="node-input" style={{ fontSize: 11, maxHeight: 80, overflowY: "auto",
              whiteSpace: "pre-wrap", color: "#e2e2f0" }}>
              {data.output as string}
            </div>
          </div>
        )}
        {!isRunning && data.error && (
          <div style={{ fontSize: 11, padding: "6px 8px", borderRadius: 6,
            background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
            {data.error as string}
          </div>
        )}
        {data.executionTime && (
          <div style={{ fontSize: 10, color: "#4a4a6a" }}>⏱ {(data.executionTime as number).toFixed(1)}s</div>
        )}
      </div>

      {/* Output handle */}
      <Handle type="source" position={Position.Right} id="response-text"
        title="Response (text)"
        style={{ right: -5, top: "50%", background: "#7c3aed", border: "2px solid #1a1a27", width: 10, height: 10, zIndex: 10 }} />
    </div>
  );
});
