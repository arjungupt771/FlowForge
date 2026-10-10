import type { WorkflowNode, WorkflowEdge, ValidationError } from "@/types/workflow";
import { isCompatibleConnection, MULTI_VALUE_TARGET_HANDLES } from "@/types/workflow";

export interface ExecutionContext {
  nodeOutputs: Record<string, Record<string, string>>;
  resolvedValues: Record<string, string>;
}

// Build adjacency for DAG
export function buildDAG(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  const deps: Record<string, Set<string>> = {};
  const dependents: Record<string, Set<string>> = {};
  const edgeMap: Record<string, { source: string; sourceHandle: string; targetHandle: string }[]> = {};

  for (const n of nodes) {
    deps[n.id] = new Set();
    dependents[n.id] = new Set();
    edgeMap[n.id] = [];
  }

  for (const e of edges) {
    deps[e.target].add(e.source);
    dependents[e.source].add(e.target);
    edgeMap[e.target].push({ source: e.source, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle });
  }

  return { deps, dependents, edgeMap };
}

// Resolve inputs for a node from completed outputs.
//
// Most target handles are single-value: if more than one edge somehow feeds
// one, validateWorkflow() rejects the graph before execution ever gets here,
// so "last edge wins" cannot silently happen in practice. Handles listed in
// MULTI_VALUE_TARGET_HANDLES (e.g. Gemini's "vision" input) are explicitly
// designed to fan multiple sources into one input — those are aggregated
// into an array in edge order rather than overwritten.
export function resolveNodeInputs(
  nodeId: string,
  edgeMap: Record<string, { source: string; sourceHandle: string; targetHandle: string }[]>,
  nodeOutputs: Record<string, Record<string, string>>
): Record<string, string | string[]> {
  const inputs: Record<string, string | string[]> = {};
  for (const e of edgeMap[nodeId] ?? []) {
    const sourceOutputs = nodeOutputs[e.source] ?? {};
    const val = sourceOutputs[e.sourceHandle];
    if (val === undefined) continue;

    if (MULTI_VALUE_TARGET_HANDLES.has(e.targetHandle)) {
      const existing = inputs[e.targetHandle];
      inputs[e.targetHandle] = Array.isArray(existing) ? [...existing, val] : [val];
    } else {
      inputs[e.targetHandle] = val;
    }
  }
  return inputs;
}

// Transitive closure of upstream dependencies for a set of target nodes,
// including the targets themselves. Used to give single/partial execution
// deterministic semantics: running node B always re-runs exactly the
// upstream chain required to produce B's inputs — never more (unrelated
// downstream nodes) and never less (stale/missing inputs).
export function getRequiredUpstreamNodes(
  targetIds: string[],
  deps: Record<string, Set<string>>
): Set<string> {
  const required = new Set<string>();
  const stack = [...targetIds];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (required.has(id)) continue;
    required.add(id);
    for (const dep of deps[id] ?? []) {
      if (!required.has(dep)) stack.push(dep);
    }
  }
  return required;
}

// Topological sort for DAG levels (parallel batches)
export function getExecutionLevels(
  nodeIds: string[],
  deps: Record<string, Set<string>>
): string[][] {
  const inDegree: Record<string, number> = {};
  for (const id of nodeIds) inDegree[id] = 0;
  for (const id of nodeIds) {
    for (const dep of deps[id]) {
      if (nodeIds.includes(dep)) inDegree[id]++;
    }
  }

  const levels: string[][] = [];
  let remaining = [...nodeIds];

  while (remaining.length > 0) {
    const ready = remaining.filter(id => inDegree[id] === 0);
    if (ready.length === 0) {
      console.error("[FlowForge] Cycle detected in workflow DAG");
      break;
    }
    levels.push(ready);
    for (const id of ready) {
      remaining = remaining.filter(r => r !== id);
      for (const r of remaining) {
        if (deps[r].has(id)) inDegree[r]--;
      }
    }
  }

  return levels;
}

// Check if workflow has cycles
export function hasCycle(nodes: WorkflowNode[], edges: WorkflowEdge[]): boolean {
  const { deps } = buildDAG(nodes, edges);
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(id: string): boolean {
    visited.add(id);
    inStack.add(id);
    for (const dep of deps[id]) {
      if (!visited.has(dep) && dfs(dep)) return true;
      if (inStack.has(dep)) return true;
    }
    inStack.delete(id);
    return false;
  }

  for (const n of nodes) {
    if (!visited.has(n.id) && dfs(n.id)) return true;
  }
  return false;
}

// Validate the complete workflow graph before execution. Cycle detection
// (hasCycle) is intentionally kept separate and unchanged — this covers the
// remaining structural checks:
//
//   A. Missing required node configuration (e.g. an unwired, empty prompt)
//   B. Invalid connections (dangling edges, type-incompatible handles)
//   C. Orphan nodes (fully disconnected — can never run meaningfully)
//   D. Multiple values feeding a single-value input
//   E. Missing dependencies (a required input has no way to be populated)
//
// Every check appends a structured ValidationError rather than throwing, so
// callers can report the full set of problems in one response instead of
// failing on the first one found.
export function validateWorkflow(nodes: WorkflowNode[], edges: WorkflowEdge[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const label = (n: WorkflowNode) => (n.data.label as string) || n.type;

  // ── B. Invalid connections ────────────────────────────────────────────
  for (const e of edges) {
    const source = nodeById.get(e.source);
    const target = nodeById.get(e.target);
    if (!source || !target) {
      errors.push({ message: `Edge "${e.id}" references a node that no longer exists on the canvas.` });
      continue;
    }
    if (!isCompatibleConnection(e.sourceHandle, e.targetHandle)) {
      errors.push({
        nodeId: target.id,
        message: `Incompatible connection: "${label(source)}.${e.sourceHandle}" cannot feed "${label(target)}.${e.targetHandle}" (type mismatch).`,
      });
    }
  }

  // Only reason about edges whose endpoints actually exist for the rest of
  // the checks below, so one dangling edge doesn't cascade into noise.
  const validEdges = edges.filter((e) => nodeById.has(e.source) && nodeById.has(e.target));

  // ── D. Multiple values into a single-value input ──────────────────────
  const incomingByTargetHandle = new Map<string, WorkflowEdge[]>();
  for (const e of validEdges) {
    const key = `${e.target}::${e.targetHandle}`;
    incomingByTargetHandle.set(key, [...(incomingByTargetHandle.get(key) ?? []), e]);
  }
  for (const [key, es] of incomingByTargetHandle) {
    const targetHandle = key.split("::")[1];
    if (es.length > 1 && !MULTI_VALUE_TARGET_HANDLES.has(targetHandle)) {
      const target = nodeById.get(es[0].target)!;
      errors.push({
        nodeId: target.id,
        message: `"${label(target)}.${targetHandle}" only accepts one value but has ${es.length} incoming connections.`,
      });
    }
  }

  const hasIncoming = (nodeId: string, targetHandle?: string) =>
    validEdges.some((e) => e.target === nodeId && (targetHandle === undefined || e.targetHandle === targetHandle));

  for (const node of nodes) {
    if (node.type === "request-inputs" || node.type === "response") continue;

    const hasAnyIncoming = validEdges.some((e) => e.target === node.id);
    const hasAnyOutgoing = validEdges.some((e) => e.source === node.id);

    // ── C. Orphan nodes ──────────────────────────────────────────────────
    if (!hasAnyIncoming && !hasAnyOutgoing) {
      errors.push({
        nodeId: node.id,
        message: `"${label(node)}" is not connected to the rest of the workflow and will never run meaningfully.`,
      });
      continue; // further per-type checks would be redundant noise for a fully orphaned node
    }

    // ── A / E. Missing required configuration or upstream dependency ─────
    if (node.type === "gemini") {
      const promptWired = hasIncoming(node.id, "prompt");
      const promptStatic = ((node.data.prompt as string) ?? "").trim().length > 0;
      if (!promptWired && !promptStatic) {
        errors.push({ nodeId: node.id, message: `Gemini node "${label(node)}" requires a prompt.` });
      }
    }

    if (node.type === "crop-image") {
      if (!hasIncoming(node.id, "input-image")) {
        errors.push({
          nodeId: node.id,
          message: `Crop Image node "${label(node)}" has no input image connected — connect an upstream image source.`,
        });
      }
      const width = (node.data.width as number) ?? 100;
      const height = (node.data.height as number) ?? 100;
      if (!(width > 0) || !(height > 0)) {
        errors.push({ nodeId: node.id, message: `Crop Image node "${label(node)}" needs a width and height greater than 0.` });
      }
    }
  }

  return errors;
}
