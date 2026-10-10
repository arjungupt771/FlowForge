"use client";
import { useCallback, useRef, useState, useEffect } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  SelectionMode,
  useReactFlow,
  ReactFlowProvider,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  BaseEdge,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useWorkflowStore } from "@/store/workflow-store";
import { RequestInputsNode } from "@/components/nodes/RequestInputsNode";
import { CropImageNode } from "@/components/nodes/CropImageNode";
import { GeminiNode } from "@/components/nodes/GeminiNode";
import { ResponseNode } from "@/components/nodes/ResponseNode";
import { NodePicker } from "./NodePicker";
import { HistoryPanel } from "./HistoryPanel";
import { WorkflowToolbar } from "./WorkflowToolbar";
import { isCompatibleConnection } from "@/types/workflow";
import { Plus } from "lucide-react";

// ── Custom animated purple edge ───────────────────────────────────────────────
function PurpleAnimatedEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, selected,
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const color = selected ? "#a78bfa" : "#7c3aed";
  return (
    <>
      {/* glow */}
      <path d={edgePath} fill="none" stroke={color} strokeWidth={5} strokeOpacity={0.18}
        style={{ filter: "blur(2px)", pointerEvents: "none" }} />
      {/* animated dash */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: color, strokeWidth: selected ? 2.5 : 2,
          strokeDasharray: "8 4",
          animation: "edgeFlow 1.5s linear infinite",
        }}
      />
    </>
  );
}

const nodeTypes = {
  "request-inputs": RequestInputsNode,
  "crop-image":     CropImageNode,
  gemini:           GeminiNode,
  response:         ResponseNode,
} as const;

const edgeTypes = {
  default: PurpleAnimatedEdge,
  animated: PurpleAnimatedEdge,
};

// ── Inner canvas (needs ReactFlowProvider above it) ───────────────────────────
// Structured validation errors returned by the execute API before any node
// runs. Shown as a dismissible banner rather than a silent console warning,
// since a rejected graph gives the person nothing else to go on otherwise.
function ValidationBanner() {
  const { validationErrors, setValidationErrors, setSelectedNodes } = useWorkflowStore();
  if (validationErrors.length === 0) return null;

  return (
    <div style={{
      position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 30,
      maxWidth: 460, width: "calc(100% - 32px)",
      background: "#1a1216", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 10,
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)", padding: "10px 12px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#ef4444" }}>
          Workflow can&apos;t run — {validationErrors.length} issue{validationErrors.length > 1 ? "s" : ""}
        </span>
        <button onClick={() => setValidationErrors([])}
          style={{ background: "transparent", border: "none", color: "#8b8ba7", cursor: "pointer", fontSize: 11 }}>
          ✕
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 160, overflowY: "auto" }}>
        {validationErrors.map((e, i) => (
          <button
            key={i}
            onClick={() => e.nodeId && setSelectedNodes([e.nodeId])}
            style={{
              textAlign: "left", fontSize: 11, color: "#f4b4b4", background: "transparent",
              border: "none", padding: 0, cursor: e.nodeId ? "pointer" : "default",
            }}
          >
            • {e.message}
          </button>
        ))}
      </div>
    </div>
  );
}

function CanvasInner({ onSave, onRun }: {
  onSave: () => void;
  onRun: (scope: "full" | "partial" | "single") => void;
}) {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, setSelectedNodes } = useWorkflowStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const { screenToFlowPosition } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcuts: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z / Ctrl+Y redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && e.key === "z") { e.preventDefault(); useWorkflowStore.getState().undo(); }
      if (mod && (e.key === "y" || (e.shiftKey && e.key === "z"))) { e.preventDefault(); useWorkflowStore.getState().redo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const isValidConnection = useCallback(
    (conn: { sourceHandle?: string | null; targetHandle?: string | null }) => {
      if (!conn.sourceHandle || !conn.targetHandle) return false;
      return isCompatibleConnection(conn.sourceHandle, conn.targetHandle);
    },
    []
  );

  const getCanvasCenter = useCallback(() => {
    if (!containerRef.current) return { x: 400, y: 300 };
    const rect = containerRef.current.getBoundingClientRect();
    return screenToFlowPosition({ x: rect.width / 2, y: rect.height / 2 });
  }, [screenToFlowPosition]);

  const handleSelectionChange = useCallback(
    ({ nodes: selected }: { nodes: { id: string }[] }) => {
      setSelectedNodes(selected.map((node) => node.id));
    },
    [setSelectedNodes]
  );

  return (
    <div ref={containerRef} className="editor-canvas" style={{ flex: 1, position: "relative", overflow: "hidden" }}>
      <ReactFlow
        nodes={nodes as any[]}
        edges={edges as any[]}
        onNodesChange={onNodesChange as OnNodesChange}
        onEdgesChange={onEdgesChange as OnEdgesChange}
        onConnect={onConnect as OnConnect}
        nodeTypes={nodeTypes as any}
        edgeTypes={edgeTypes as any}
        isValidConnection={isValidConnection}
        onSelectionChange={handleSelectionChange}
        onPaneClick={() => setSelectedNodes([])}
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode="Shift"
        deleteKeyCode={["Delete", "Backspace"]}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.1}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: "default",
          animated: true,
          style: { stroke: "#7c3aed", strokeWidth: 2 },
        }}
        connectionLineStyle={{ stroke: "#7c3aed", strokeWidth: 2, strokeDasharray: "6 3" }}
      >
        {/* SVG defs for arrowhead marker */}
        <svg style={{ position: "absolute", width: 0, height: 0 }}>
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#7c3aed" />
            </marker>
          </defs>
        </svg>

        <Background
          variant={BackgroundVariant.Dots}
          gap={24} size={1} color="#1e1e2e"
          style={{ background: "#0b0e14" }}
        />
        <Controls showInteractive={false} style={{ bottom: 16, left: 16, top: "auto" }} />
        <MiniMap
          nodeColor={() => "#7c3aed"}
          maskColor="rgba(10,10,15,0.75)"
          style={{ bottom: 16, right: 12, top: "auto", background: "#11151d", border: "1px solid #293141", borderRadius: 9 }}
        />
      </ReactFlow>

      {/* Bottom-center + button */}
      <div className="canvas-add-wrap">
        <button
          onClick={() => setPickerOpen(true)}
          className="canvas-add-node"
        >
          <Plus size={17} /> Add a step
        </button>
      </div>

      {pickerOpen && (
        <NodePicker onClose={() => setPickerOpen(false)} canvasCenter={getCanvasCenter()} />
      )}

      <ValidationBanner />
    </div>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────
export function FlowCanvas({ workflowId, onSave, onRun, onExport, onImport }: {
  workflowId: string;
  onSave: () => void;
  onRun: (scope: "full" | "partial" | "single") => void;
  onExport: () => void;
  onImport: (json: string) => void;
}) {
  return (
    <ReactFlowProvider>
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0a0a0f" }}>
        <WorkflowToolbar onRun={onRun} onSave={onSave} onExport={onExport} onImport={onImport} />
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <CanvasInner onSave={onSave} onRun={onRun} />
          <HistoryPanel />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
