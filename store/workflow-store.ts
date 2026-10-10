import { create } from "zustand";
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import type { WorkflowNode, WorkflowEdge, NodeData, WorkflowRunResult, ValidationError } from "@/types/workflow";
import { isCompatibleConnection } from "@/types/workflow";
import { nanoid } from "@/lib/nanoid";

interface WorkflowState {
  workflowId: string | null;
  workflowName: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  runs: WorkflowRunResult[];
  isSaving: boolean;
  isRunning: boolean;
  runningNodes: Set<string>;
  selectedNodes: string[];
  historyPanelOpen: boolean;
  validationErrors: ValidationError[];

  setWorkflowId: (id: string) => void;
  setWorkflowName: (name: string) => void;
  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (type: string, position?: { x: number; y: number }) => void;
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
  deleteNode: (nodeId: string) => void;
  setNodeStatus: (nodeId: string, status: NodeData["status"], output?: string, error?: string, time?: number) => void;
  setRunningNodes: (nodeIds: string[]) => void;
  clearRunningNodes: () => void;
  addRun: (run: WorkflowRunResult) => void;
  setRuns: (runs: WorkflowRunResult[]) => void;
  setSaving: (val: boolean) => void;
  setRunning: (val: boolean) => void;
  setSelectedNodes: (ids: string[]) => void;
  setHistoryPanelOpen: (open: boolean) => void;
  setValidationErrors: (errors: ValidationError[]) => void;
  loadCanvas: (canvas: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }) => void;
  undo: () => void;
  redo: () => void;
}

const DEFAULT_NODES: WorkflowNode[] = [
  {
    id: "request-inputs",
    type: "request-inputs",
    position: { x: 80, y: 200 },
    data: {
      label: "Request-Inputs",
      fields: [
        { id: "text_field", type: "text_field", label: "text_field", value: "", connected: false },
        { id: "image_field", type: "image_field", label: "image_field", value: "", connected: false },
      ],
    },
  },
  {
    id: "response",
    type: "response",
    position: { x: 900, y: 200 },
    data: { label: "Response", status: "idle" },
  },
];

// Simple undo/redo stack
const undoStack: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }[] = [];
const redoStack: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }[] = [];

export const useWorkflowStore = create<WorkflowState>()((set, get) => ({
  workflowId: null,
  workflowName: "Untitled Workflow",
  nodes: DEFAULT_NODES,
  edges: [],
  runs: [],
  isSaving: false,
  isRunning: false,
  runningNodes: new Set(),
  selectedNodes: [],
  historyPanelOpen: true,
  validationErrors: [],

  setWorkflowId: (id) => set({ workflowId: id }),
  setWorkflowName: (name) => set({ workflowName: name }),
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) =>
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes as any) as WorkflowNode[],
    })),

  onEdgesChange: (changes) =>
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges as any) as WorkflowEdge[],
    })),

  onConnect: (connection) => {
    if (!connection.sourceHandle || !connection.targetHandle) return;
    if (!isCompatibleConnection(connection.sourceHandle, connection.targetHandle)) {
      console.warn("[FlowForge] Incompatible connection rejected:", connection.sourceHandle, "->", connection.targetHandle);
      return;
    }
    // Save undo snapshot
    const s = get();
    undoStack.push({ nodes: s.nodes, edges: s.edges });
    redoStack.length = 0;

    set((state) => ({
      edges: addEdge(
        {
          ...connection,
          id: `edge-${nanoid()}`,
          animated: true,
          style: { stroke: "#7c3aed", strokeWidth: 2 },
        },
        state.edges as any
      ) as WorkflowEdge[],
    }));

    const { targetHandle, target } = connection;
    if (targetHandle) {
      get().updateNodeData(target, {
        connectedInputs: {
          ...(get().nodes.find(n => n.id === target)?.data.connectedInputs ?? {}),
          [targetHandle]: true,
        },
      });
    }
  },

  addNode: (type, position) => {
    const s = get();
    undoStack.push({ nodes: s.nodes, edges: s.edges });
    redoStack.length = 0;

    const id = `${type}-${nanoid()}`;
    const pos = position ?? { x: 300 + Math.random() * 200, y: 150 + Math.random() * 200 };
    const baseData: NodeData = { label: type, status: "idle" };

    let data: NodeData = { ...baseData };
    if (type === "gemini") {
      data = { ...baseData, label: "Gemini 3.1 Pro", model: "gemini-2.0-flash", prompt: "", systemPrompt: "", settingsOpen: false };
    } else if (type === "crop-image") {
      data = { ...baseData, label: "Crop Image", xPos: 0, yPos: 0, width: 100, height: 100 };
    }

    set((state) => ({
      nodes: [...state.nodes, { id, type: type as WorkflowNode["type"], position: pos, data }],
    }));
  },

  updateNodeData: (nodeId, data) =>
    set((state) => ({
      nodes: state.nodes.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n),
    })),

  deleteNode: (nodeId) => {
    const protected_ = ["request-inputs", "response"];
    if (protected_.includes(nodeId)) return;
    const s = get();
    undoStack.push({ nodes: s.nodes, edges: s.edges });
    redoStack.length = 0;
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    }));
  },

  setNodeStatus: (nodeId, status, output, error, time) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, status, output, error, executionTime: time } } : n
      ),
    })),

  setRunningNodes: (nodeIds) => set({ runningNodes: new Set(nodeIds) }),
  clearRunningNodes: () => set({ runningNodes: new Set() }),
  addRun: (run) => set((state) => ({ runs: [run, ...state.runs] })),
  setRuns: (runs) => set({ runs }),
  setSaving: (val) => set({ isSaving: val }),
  setRunning: (val) => set({ isRunning: val }),
  setSelectedNodes: (ids) => {
    const current = get().selectedNodes;
    if (current.length === ids.length && current.every((id, index) => id === ids[index])) return;
    set({ selectedNodes: ids });
  },
  setHistoryPanelOpen: (open) => set({ historyPanelOpen: open }),
  setValidationErrors: (errors) => set({ validationErrors: errors }),

  loadCanvas: (canvas) => set({ nodes: canvas.nodes, edges: canvas.edges }),

  undo: () => {
    const snapshot = undoStack.pop();
    if (!snapshot) return;
    const s = get();
    redoStack.push({ nodes: s.nodes, edges: s.edges });
    set({ nodes: snapshot.nodes, edges: snapshot.edges });
  },

  redo: () => {
    const snapshot = redoStack.pop();
    if (!snapshot) return;
    const s = get();
    undoStack.push({ nodes: s.nodes, edges: s.edges });
    set({ nodes: snapshot.nodes, edges: snapshot.edges });
  },
}));
