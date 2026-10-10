"use client";
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { useWorkflowStore } from "@/store/workflow-store";

interface Props { id: string; data: any; }

export const CropImageNode = memo(function CropImageNode({ id, data }: Props) {
  const { updateNodeData, deleteNode, runningNodes } = useWorkflowStore();
  const isRunning  = runningNodes.has(id);

  const status      = data.status as string | undefined;
  const borderColor = isRunning ? "#7c3aed"
    : status === "success" ? "#22c55e"
    : status === "error"   ? "#ef4444"
    : "#2a2a3d";

  const params = [
    { label: "X Position (%)", key: "xPos",   min: 0, max: 100 },
    { label: "Y Position (%)", key: "yPos",   min: 0, max: 100 },
    { label: "Width (%)",      key: "width",  min: 1, max: 100 },
    { label: "Height (%)",     key: "height", min: 1, max: 100 },
  ];

  return (
    <div
      className={isRunning ? "node-running" : ""}
      style={{
        position: "relative", borderRadius: 12, minWidth: 228,
        background: "#1a1a27", border: `1.5px solid ${borderColor}`,
        boxShadow: "0 4px 24px rgba(0,0,0,0.45)",
        transition: "border-color 0.2s",
      }}
    >
      {/* Input handle */}
      <Handle type="target" position={Position.Left} id="input-image"
        title="Input Image"
        style={{ left: -5, top: "50%", background: "#f59e0b", border: "2px solid #1a1a27", width: 10, height: 10, zIndex: 10 }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px", background: "#13131e",
        borderBottom: "1px solid #2a2a3d", borderRadius: "12px 12px 0 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>✂️</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: "#e2e2f0" }}>
            {(data.label as string) || "Crop Image"}
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

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Running state */}
        {isRunning && (
          <div style={{ fontSize: 11, padding: "6px 10px", borderRadius: 6,
            background: "rgba(124,58,237,0.12)", color: "#a78bfa",
            animation: "pulse 1.5s ease-in-out infinite", textAlign: "center" }}>
            ⏳ Cropping image...
          </div>
        )}

        {/* Crop params */}
        {params.map(({ label, key, min, max }) => (
          <div key={key}>
            <label style={{ display: "block", fontSize: 11, color: "#8b8ba7", marginBottom: 3 }}>
              {label}
              <span style={{ color: "#4a4a6a", marginLeft: 4 }}>
                {(data[key] as number) ?? (key === "width" || key === "height" ? 100 : 0)}
              </span>
            </label>
            <input type="range" min={min} max={max}
              value={(data[key] as number) ?? (key === "width" || key === "height" ? 100 : 0)}
              onChange={(e) => updateNodeData(id, { [key]: parseInt(e.target.value) })}
              disabled={isRunning}
              style={{ width: "100%", accentColor: "#f59e0b" }}
            />
          </div>
        ))}

        {/* Output preview */}
        {!isRunning && data.output && (
          <div>
            <label style={{ display: "block", fontSize: 11, color: "#8b8ba7", marginBottom: 4 }}>Output Image</label>
            <img src={data.output as string} alt="Cropped output"
              style={{ width: "100%", height: 72, objectFit: "cover", borderRadius: 6,
                border: "1px solid #2a2a3d" }} />
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
      <Handle type="source" position={Position.Right} id="output-image"
        title="Output Image"
        style={{ right: -5, top: "50%", background: "#f59e0b", border: "2px solid #1a1a27", width: 10, height: 10, zIndex: 10 }} />
    </div>
  );
});
