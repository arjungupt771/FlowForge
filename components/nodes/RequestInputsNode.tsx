"use client";
import { memo, useCallback, useRef } from "react";
import { Handle, Position } from "@xyflow/react";
import { useWorkflowStore } from "@/store/workflow-store";
import type { InputField } from "@/types/workflow";

interface Props { id: string; data: any; }

export const RequestInputsNode = memo(function RequestInputsNode({ id, data }: Props) {
  const { updateNodeData, runningNodes } = useWorkflowStore();
  const isRunning = runningNodes.has(id);
  const fields: InputField[] = (data.fields ?? []) as InputField[];
  const fileRefs  = useRef<Record<string, HTMLInputElement | null>>({});

  const addField = useCallback((type: "text_field" | "image_field") => {
    const sameType   = fields.filter((f) => f.type === type);
    const suffix     = sameType.length > 0 ? `_${sameType.length + 1}` : "";
    const newField: InputField = {
      id:       `${type}${suffix}`,
      type,
      label:    `${type}${suffix}`,
      value:    "",
      connected: false,
    };
    updateNodeData(id, { fields: [...fields, newField] });
  }, [fields, id, updateNodeData]);

  const updateField = useCallback((fieldId: string, value: string) => {
    updateNodeData(id, { fields: fields.map((f) => f.id === fieldId ? { ...f, value } : f) });
  }, [fields, id, updateNodeData]);

  const handleFileUpload = useCallback((fieldId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => updateField(fieldId, e.target?.result as string ?? "");
    reader.readAsDataURL(file);
  }, [updateField]);

  return (
    <div style={{
      position: "relative", borderRadius: 12, minWidth: 248, maxWidth: 300,
      background: "#1a1a27", border: "1.5px solid #2a2a3d",
      boxShadow: "0 4px 24px rgba(0,0,0,0.45)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px", background: "#13131e",
        borderBottom: "1px solid #2a2a3d", borderRadius: "12px 12px 0 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>📥</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: "#e2e2f0" }}>Request-Inputs</span>
        </div>
        <div style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4,
          background: "rgba(124,58,237,0.15)", color: "#a78bfa" }}>pre-placed</div>
      </div>

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {fields.map((field, idx) => {
          // Calculate handle vertical position
          const topPct = fields.length === 1
            ? 50
            : 20 + (idx / (fields.length - 1)) * 60;

          return (
            <div key={field.id} style={{ position: "relative" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 4,
                fontSize: 11, color: "#8b8ba7", marginBottom: 4, fontFamily: "monospace" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", display: "inline-block",
                  background: field.type === "image_field" ? "#f59e0b" : "#7c3aed" }} />
                {field.label}
              </label>

              {field.type === "text_field" ? (
                <textarea
                  className="node-input"
                  rows={2}
                  placeholder="Enter text..."
                  value={field.value}
                  disabled={field.connected || isRunning}
                  onChange={(e) => updateField(field.id, e.target.value)}
                  style={{ resize: "none" }}
                />
              ) : (
                field.value ? (
                  <div style={{ position: "relative" }}>
                    <img src={field.value} alt="Uploaded"
                      style={{ width: "100%", height: 72, objectFit: "cover", borderRadius: 6,
                        border: "1px solid #2a2a3d" }} />
                    <button
                      onClick={() => updateField(field.id, "")}
                      style={{ position: "absolute", top: 4, right: 4, width: 18, height: 18,
                        borderRadius: "50%", background: "rgba(239,68,68,0.85)", border: "none",
                        color: "white", fontSize: 10, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                  </div>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileRefs.current[field.id]?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file && file.type.startsWith("image/")) handleFileUpload(field.id, file);
                    }}
                    style={{ width: "100%", height: 64, borderRadius: 6,
                      border: "1px dashed #2a2a3d", background: "rgba(255,255,255,0.02)",
                      display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", cursor: "pointer", gap: 4 }}>
                    <input
                      ref={(el) => { fileRefs.current[field.id] = el; }}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(field.id, file);
                      }}
                    />
                    <span style={{ fontSize: 18 }}>🖼️</span>
                    <span style={{ fontSize: 10, color: "#8b8ba7" }}>Click or drag image</span>
                    <span style={{ fontSize: 9, color: "#4a4a6a" }}>jpg • png • webp • gif</span>
                  </div>
                )
              )}

              {/* Output handle per field */}
              <Handle
                type="source"
                position={Position.Right}
                id={field.id}
                title={`${field.label} output`}
                style={{
                  position: "absolute",
                  right: -17,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: field.type === "image_field" ? "#f59e0b" : "#7c3aed",
                  border: "2px solid #1a1a27",
                  width: 10, height: 10, zIndex: 10,
                }}
              />
            </div>
          );
        })}

        {/* Add field row */}
        <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
          <button onClick={() => addField("text_field")}
            style={{ flex: 1, padding: "6px 0", fontSize: 11, borderRadius: 6, cursor: "pointer",
              background: "rgba(124,58,237,0.1)", color: "#a78bfa",
              border: "1px solid rgba(124,58,237,0.2)" }}>
            + text
          </button>
          <button onClick={() => addField("image_field")}
            style={{ flex: 1, padding: "6px 0", fontSize: 11, borderRadius: 6, cursor: "pointer",
              background: "rgba(245,158,11,0.1)", color: "#fbbf24",
              border: "1px solid rgba(245,158,11,0.2)" }}>
            + image
          </button>
        </div>
      </div>
    </div>
  );
});
