export type NodeType = "request-inputs" | "crop-image" | "gemini" | "response";

export type FieldType = "text_field" | "image_field";

export interface InputField {
  id: string;
  type: FieldType;
  label: string;
  value: string;
  connected?: boolean;
}

export interface NodeData {
  // Request-Inputs specific
  fields?: InputField[];
  // Gemini specific
  prompt?: string;
  systemPrompt?: string;
  model?: string;
  settingsOpen?: boolean;
  // Crop Image specific
  xPos?: number;
  yPos?: number;
  width?: number;
  height?: number;
  // Runtime
  status?: "idle" | "running" | "success" | "error";
  output?: string;
  error?: string;
  executionTime?: number;
  // Connected input states
  connectedInputs?: Record<string, boolean>;
  // Label
  label?: string;
  [key: string]: unknown;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
  animated: boolean;
  style?: Record<string, unknown>;
}

export interface WorkflowCanvas {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface NodeRunResult {
  nodeId: string;
  nodeType: NodeType;
  nodeLabel: string;
  status: "success" | "error" | "skipped";
  duration: number;
  inputs?: Record<string, unknown>;
  output?: string;
  error?: string;
}

export interface WorkflowRunResult {
  id: string;
  status: "success" | "failed" | "partial";
  scope: "full" | "partial" | "single";
  duration: number;
  nodeRuns: NodeRunResult[];
  createdAt: string;
}

// Structured validation error returned by validateWorkflow(). `nodeId` is
// present when the error is attributable to a specific node so the UI can
// highlight it; graph-level errors (e.g. a bad edge) omit it.
export interface ValidationError {
  nodeId?: string;
  message: string;
}

// Target handles that are explicitly allowed to receive more than one
// incoming edge (values are aggregated, in edge order, into an array).
// Any other target handle is single-value: a second incoming edge on it
// is a validation error rather than a silent overwrite.
export const MULTI_VALUE_TARGET_HANDLES = new Set<string>(["vision"]);

// Handle type mappings for type-safe connections
export const HANDLE_TYPES: Record<string, string> = {
  // Output handles
  "text_field": "text",
  "image_field": "image",
  "output-image": "image",
  "response-text": "text",
  // Input handles
  "input-image": "image",
  "prompt": "text",
  "system-prompt": "text",
  "vision": "image",
  "result": "text",
};

export function getHandleType(handleId: string): string {
  return HANDLE_TYPES[handleId] ?? "any";
}

export function isCompatibleConnection(
  sourceHandleId: string,
  targetHandleId: string
): boolean {
  const sourceType = getHandleType(sourceHandleId);
  const targetType = getHandleType(targetHandleId);
  if (sourceType === "any" || targetType === "any") return true;
  return sourceType === targetType;
}
