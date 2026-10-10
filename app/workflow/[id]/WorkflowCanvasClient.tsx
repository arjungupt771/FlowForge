"use client";
import { useEffect, useCallback, useRef } from "react";
import { useWorkflowStore } from "@/store/workflow-store";
import { FlowCanvas } from "@/components/canvas/FlowCanvas";
import { SAMPLE_WORKFLOW } from "@/lib/sample-workflow";
import type { WorkflowCanvas, WorkflowRunResult, NodeRunResult, ValidationError } from "@/types/workflow";

interface Props {
  workflowId: string;
  initialName: string;
  initialCanvas: WorkflowCanvas | null;
  initialRuns: WorkflowRunResult[];
}

const BLANK_CANVAS: WorkflowCanvas = {
  nodes: [
    {
      id: "request-inputs",
      type: "request-inputs",
      position: { x: 80, y: 240 },
      data: {
        label: "Request-Inputs",
        fields: [
          { id: "text_field",  type: "text_field",  label: "text_field",  value: "", connected: false },
          { id: "image_field", type: "image_field", label: "image_field", value: "", connected: false },
        ],
      },
    },
    {
      id: "response",
      type: "response",
      position: { x: 900, y: 240 },
      data: { label: "Response", status: "idle" },
    },
  ],
  edges: [],
};

export function WorkflowCanvasClient({ workflowId, initialName, initialCanvas, initialRuns }: Props) {
  const {
    setWorkflowId, setWorkflowName, loadCanvas, setRuns,
    nodes, edges, workflowName,
    setSaving, setRunning, setRunningNodes, clearRunningNodes,
    setNodeStatus, updateNodeData, addRun, selectedNodes,
    setValidationErrors,
  } = useWorkflowStore();

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  // Initialise store once
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    setWorkflowId(workflowId);
    setWorkflowName(initialName);

    const hasNodes = (initialCanvas?.nodes?.length ?? 0) > 0;
    loadCanvas(hasNodes ? initialCanvas! : BLANK_CANVAS);

    setRuns(initialRuns);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced auto-save
  useEffect(() => {
    if (!initializedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => handleSave(), 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, workflowName]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workflowName, canvas: { nodes, edges } }),
      });
    } finally {
      setSaving(false);
    }
  }, [workflowId, workflowName, nodes, edges, setSaving]);

  const handleRun = useCallback(async (scope: "full" | "partial" | "single") => {
    await handleSave();
    setRunning(true);
    setValidationErrors([]);

    // Mark executable nodes as running immediately for visual feedback
    const executableIds = nodes
      .filter((n) => n.type !== "request-inputs" && n.type !== "response")
      .map((n) => n.id);

    const targetIds =
      scope === "full"
        ? executableIds
        : selectedNodes.filter((id) =>
            nodes.find((n) => n.id === id && n.type !== "request-inputs" && n.type !== "response")
          );

    setRunningNodes(targetIds);
    targetIds.forEach((id) => setNodeStatus(id, "running"));

    try {
      const res = await fetch(`/api/workflows/${workflowId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, nodeIds: selectedNodes }),
      });

      const result = await res.json();

      if (!res.ok) {
        // Validation failures (bad graph) carry structured, per-node errors —
        // surface those instead of a single generic message, and reset the
        // optimistic "running" state without recording a run, since nothing
        // actually executed.
        const errors: ValidationError[] | undefined = result.errors;
        if (errors && errors.length > 0) {
          setValidationErrors(errors);
          targetIds.forEach((id) => setNodeStatus(id, "idle"));
          const perNode = errors.filter((e) => e.nodeId);
          perNode.forEach((e) => setNodeStatus(e.nodeId!, "error", undefined, e.message));
          return;
        }
        throw new Error(result.error ?? "Execution failed");
      }

      // Apply node statuses
      const nodeRuns: NodeRunResult[] = result.nodeRuns ?? [];
      nodeRuns.forEach((nr) => {
        setNodeStatus(nr.nodeId, nr.status === "success" ? "success" : "error", nr.output, nr.error, nr.duration);
      });

      // Apply outputs to canvas nodes
      const nodeOutputs: Record<string, Record<string, string>> = result.nodeOutputs ?? {};
      Object.entries(nodeOutputs).forEach(([nodeId, outputs]) => {
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return;
        if (node.type === "crop-image" && outputs["output-image"])
          updateNodeData(nodeId, { output: outputs["output-image"], status: "success" });
        if (node.type === "gemini" && outputs["response-text"])
          updateNodeData(nodeId, { output: outputs["response-text"], status: "success" });
        if (node.type === "response" && outputs["result"])
          updateNodeData(nodeId, { output: outputs["result"], status: "success" });
      });

      addRun({
        id: result.runId,
        status: result.status,
        scope: result.scope,
        duration: result.duration,
        nodeRuns: result.nodeRuns,
        createdAt: result.createdAt,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      targetIds.forEach((id) => setNodeStatus(id, "error", undefined, msg));
    } finally {
      clearRunningNodes();
      setRunning(false);
    }
  }, [workflowId, nodes, selectedNodes, handleSave, setRunning, setRunningNodes,
      clearRunningNodes, setNodeStatus, updateNodeData, addRun, setValidationErrors]);

  const handleExport = useCallback(() => {
    const blob = new Blob(
      [JSON.stringify({ name: workflowName, canvas: { nodes, edges } }, null, 2)],
      { type: "application/json" }
    );
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `${workflowName.replace(/\s+/g, "-").toLowerCase()}.json`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  }, [workflowName, nodes, edges]);

  const handleImport = useCallback((json: string) => {
    try {
      const data = JSON.parse(json);
      if (data.canvas) {
        loadCanvas(data.canvas);
        if (data.name) setWorkflowName(data.name);
      }
    } catch { /* ignore invalid JSON */ }
  }, [loadCanvas, setWorkflowName]);

  return (
    <FlowCanvas
      workflowId={workflowId}
      onSave={handleSave}
      onRun={handleRun}
      onExport={handleExport}
      onImport={handleImport}
    />
  );
}
