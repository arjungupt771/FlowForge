import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  buildDAG, getExecutionLevels, resolveNodeInputs, hasCycle,
  validateWorkflow, getRequiredUpstreamNodes,
} from "@/lib/execution-engine";
import { cropImage } from "@/lib/image-processing";
import type { WorkflowNode, WorkflowEdge, NodeRunResult, ValidationError } from "@/types/workflow";

// ── Execution mode ────────────────────────────────────────────────────────────
//
// EXECUTION_MODE is read once and drives which backend runs every task in
// this request. It is never inferred from whether an unrelated env var
// (like TRIGGER_SECRET_KEY) happens to be set.
//
//   EXECUTION_MODE=direct   -> always run tasks in this process.
//   EXECUTION_MODE=trigger  -> always submit to Trigger.dev. If submission
//                              or execution fails, that failure is reported
//                              as the node's result — it is NOT silently
//                              retried through the direct executor.
//   (unset)                 -> defaults to "direct" outside production, as
//                              an explicit, documented development
//                              convenience. In production an unset mode is
//                              a configuration error, not a guess.
type ExecutionMode = "direct" | "trigger";

function resolveExecutionMode(): ExecutionMode {
  const mode = process.env.EXECUTION_MODE;
  if (mode === "direct" || mode === "trigger") return mode;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "EXECUTION_MODE is not set. Set EXECUTION_MODE=direct or EXECUTION_MODE=trigger explicitly in production."
    );
  }
  return "direct";
}

// ── Trigger.dev-backed task runners ───────────────────────────────────────────

async function runGemini(payload: {
  model: string; prompt: string; systemPrompt?: string;
  visionUrls?: string[]; temperature?: number; maxTokens?: number;
}): Promise<string> {
  const mode = resolveExecutionMode();

  if (mode === "trigger") {
    const { tasks } = await import("@trigger.dev/sdk/v3");
    const result = await tasks.triggerAndWait("gemini-inference", payload);
    if (!result.ok) {
      throw new Error(`Gemini Trigger.dev task failed: ${(result as { error?: string }).error ?? "unknown error"}`);
    }
    const output = (result as unknown as { ok: true; output: { output: string } }).output;
    return output.output;
  }

  return runGeminiDirect(payload);
}

async function runCropImageViaBackend(payload: {
  imageUrl: string; xPos: number; yPos: number;
  width: number; height: number; nodeId: string;
}): Promise<string> {
  const mode = resolveExecutionMode();

  if (mode === "trigger") {
    const { tasks } = await import("@trigger.dev/sdk/v3");
    const result = await tasks.triggerAndWait("crop-image", payload);
    if (!result.ok) {
      throw new Error(`Crop Image Trigger.dev task failed: ${(result as { error?: string }).error ?? "unknown error"}`);
    }
    const output = (result as unknown as { ok: true; output: { outputUrl: string } }).output;
    return output.outputUrl;
  }

  return cropImage(payload.imageUrl, {
    xPos: payload.xPos, yPos: payload.yPos, width: payload.width, height: payload.height,
  });
}

// ── Direct executor (used in dev, or on request when EXECUTION_MODE=direct) ──

async function runGeminiDirect(payload: {
  model: string; prompt: string; systemPrompt?: string;
  visionUrls?: string[]; temperature?: number; maxTokens?: number;
}): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const { fetchImageBuffer } = await import("@/lib/image-processing");

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: payload.model ?? "gemini-2.0-flash",
    generationConfig: { temperature: payload.temperature ?? 0.7, maxOutputTokens: payload.maxTokens ?? 1024 },
  });

  type Part = { text: string } | { inlineData: { data: string; mimeType: string } };
  const parts: Part[] = [];
  if (payload.systemPrompt) parts.push({ text: `System: ${payload.systemPrompt}\n\n` });

  for (const url of payload.visionUrls ?? []) {
    try {
      const buf = await fetchImageBuffer(url);
      const mimeType = url.startsWith("data:") ? (/^data:([^;,]+)/.exec(url)?.[1] ?? "image/png") : "image/jpeg";
      parts.push({ inlineData: { data: buf.toString("base64"), mimeType } });
    } catch (err) {
      console.warn("[FlowForge] Failed to fetch vision image:", url, (err as Error).message);
    }
  }

  parts.push({ text: payload.prompt || "Describe the input." });
  const result = await model.generateContent(parts);
  return result.response.text();
}

// ── Main execution handler ────────────────────────────────────────────────────

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const workflow = await db.getWorkflow(id, userId);
  if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { scope = "full", nodeIds: selectedNodeIds = [] } = body as {
    scope?: "full" | "partial" | "single"; nodeIds?: string[];
  };

  const canvas   = workflow.canvas as { nodes?: WorkflowNode[]; edges?: WorkflowEdge[] };
  const allNodes = canvas.nodes ?? [];
  const allEdges = canvas.edges ?? [];

  // ── Validate the complete graph before executing anything ──────────────────
  const validationErrors: ValidationError[] = validateWorkflow(allNodes, allEdges);
  if (hasCycle(allNodes, allEdges)) {
    validationErrors.unshift({ message: "Workflow contains a cycle — remove it before running." });
  }
  if (validationErrors.length > 0) {
    return NextResponse.json(
      { error: "Workflow validation failed.", errors: validationErrors },
      { status: 400 }
    );
  }

  // ── Determine exactly which nodes this run touches ──────────────────────────
  const { deps, edgeMap } = buildDAG(allNodes, allEdges);

  let executionSet: Set<string>;
  if (scope === "full") {
    executionSet = new Set(allNodes.map((n) => n.id));
  } else if (scope === "single") {
    if (selectedNodeIds.length !== 1) {
      return NextResponse.json(
        { error: "Single-node execution requires exactly one selected node." },
        { status: 400 }
      );
    }
    // Auto-include whatever upstream dependencies are required to produce
    // this node's inputs. Unrelated downstream nodes are never touched.
    executionSet = getRequiredUpstreamNodes(selectedNodeIds, deps);
  } else {
    // partial
    if (selectedNodeIds.length === 0) {
      return NextResponse.json(
        { error: "Partial execution requires at least one selected node." },
        { status: 400 }
      );
    }
    executionSet = getRequiredUpstreamNodes(selectedNodeIds, deps);
  }

  const targetNodeIds = Array.from(executionSet);
  const levels = getExecutionLevels(targetNodeIds, deps);

  const nodeOutputs: Record<string, Record<string, string>> = {};
  const nodeRuns:    NodeRunResult[]                         = [];
  const runStart     = Date.now();
  let overallStatus: "success" | "failed" | "partial" = "success";

  // Request-Inputs: local, no Trigger task. Only resolved when this run's
  // execution set actually depends on it.
  const reqNode = allNodes.find((n) => n.type === "request-inputs");
  if (reqNode && executionSet.has(reqNode.id)) {
    const fields = (reqNode.data.fields ?? []) as Array<{ id: string; value: string }>;
    nodeOutputs[reqNode.id] = Object.fromEntries(fields.map((f) => [f.id, f.value ?? ""]));
    nodeRuns.push({
      nodeId: reqNode.id, nodeType: "request-inputs", nodeLabel: (reqNode.data.label as string) ?? "Request-Inputs",
      status: "success", duration: 0.1, output: `${fields.length} fields resolved`,
    });
  }

  // Execute each DAG level — nodes within a level fire in parallel.
  for (const level of levels) {
    const execNodes = level
      .map((nid) => allNodes.find((n) => n.id === nid))
      .filter((n): n is WorkflowNode => !!n && n.type !== "request-inputs" && n.type !== "response");

    if (execNodes.length === 0) continue;

    // Each mapped promise catches its own errors and always resolves with a
    // fully-identified NodeRunResult — nodeId/nodeType/nodeLabel are read
    // from the node closure, never guessed after the fact. This is what
    // fixes the old nodeId:"?" / nodeLabel:"Unknown" attribution bug: a
    // failure inside Promise.allSettled can no longer lose the node it
    // belongs to, because we no longer rely on the rejection reason alone
    // to say which node failed.
    const results = await Promise.allSettled(
      execNodes.map(async (node): Promise<NodeRunResult> => {
        const t0     = Date.now();
        const inputs = resolveNodeInputs(node.id, edgeMap, nodeOutputs);
        const data   = node.data as Record<string, unknown>;
        const nodeLabel = (data.label as string) || node.type;

        try {
          if (node.type === "crop-image") {
            const inputImage = typeof inputs["input-image"] === "string" ? inputs["input-image"] : "";
            const out = await runCropImageViaBackend({
              imageUrl: inputImage,
              xPos:   (data.xPos   as number) ?? 0,
              yPos:   (data.yPos   as number) ?? 0,
              width:  (data.width  as number) ?? 100,
              height: (data.height as number) ?? 100,
              nodeId: node.id,
            });
            nodeOutputs[node.id] = { "output-image": out };
            return {
              nodeId: node.id, nodeType: node.type, nodeLabel,
              status: "success", duration: (Date.now() - t0) / 1000, inputs: inputs as Record<string, unknown>, output: out,
            };
          }

          if (node.type === "gemini") {
            const rawVision = inputs["vision"];
            const visionUrls = Array.isArray(rawVision) ? rawVision.filter(Boolean) : rawVision ? [rawVision] : [];
            const promptInput = typeof inputs["prompt"] === "string" ? inputs["prompt"] : undefined;
            const systemPromptInput = typeof inputs["system-prompt"] === "string" ? inputs["system-prompt"] : undefined;

            const out = await runGemini({
              model:         (data.model        as string) ?? "gemini-2.0-flash",
              prompt:        promptInput        ?? (data.prompt        as string) ?? "",
              systemPrompt:  systemPromptInput   ?? (data.systemPrompt  as string) ?? "",
              visionUrls,
              temperature:  (data.temperature as number) ?? 0.7,
              maxTokens:    (data.maxTokens   as number) ?? 1024,
            });
            nodeOutputs[node.id] = { "response-text": out };
            return {
              nodeId: node.id, nodeType: node.type, nodeLabel,
              status: "success", duration: (Date.now() - t0) / 1000, inputs: inputs as Record<string, unknown>, output: out,
            };
          }

          throw new Error(`Unknown node type: ${node.type}`);
        } catch (err) {
          // Caught here (rather than left to reject) so the identity of the
          // failing node is never lost — see the comment above this map call.
          return {
            nodeId: node.id, nodeType: node.type, nodeLabel,
            status: "error", duration: (Date.now() - t0) / 1000,
            inputs: inputs as Record<string, unknown>,
            error: (err as Error)?.message ?? "Unknown error",
          };
        }
      })
    );

    // Every promise above resolves (never rejects), so this branch is a
    // defensive fallback only — but if it's ever hit, `execNodes[i]` still
    // gives us the correct node identity via the settled results' index,
    // which Promise.allSettled preserves from the input array order.
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        if (r.value.status === "error") {
          overallStatus = overallStatus === "success" ? "partial" : "failed";
        }
        nodeRuns.push(r.value);
      } else {
        const node = execNodes[i];
        overallStatus = overallStatus === "success" ? "partial" : "failed";
        nodeRuns.push({
          nodeId: node.id, nodeType: node.type, nodeLabel: (node.data.label as string) || node.type,
          status: "error", duration: 0,
          error: (r.reason as Error)?.message ?? "Unknown error",
        });
      }
    });
  }

  // Response: local, no Trigger task. Only resolved when this run's
  // execution set actually reaches it — a single/partial run of an upstream
  // node must not silently update the Response node's last result.
  const respNode = allNodes.find((n) => n.type === "response");
  if (respNode && executionSet.has(respNode.id)) {
    const inputs = resolveNodeInputs(respNode.id, edgeMap, nodeOutputs);
    const result = (typeof inputs["result"] === "string" ? inputs["result"] : undefined)
      ?? Object.values(nodeOutputs).flatMap(Object.values).filter(Boolean).at(-1)
      ?? "";
    nodeOutputs[respNode.id] = { result };
    nodeRuns.push({
      nodeId: respNode.id, nodeType: "response", nodeLabel: (respNode.data.label as string) ?? "Response",
      status: "success", duration: 0.1,
      output: result ? "final result captured" : "no result",
    });
  }

  const duration = (Date.now() - runStart) / 1000;
  const run = await db.createRun(id, userId, { status: overallStatus, scope, duration, nodeRuns });
  await db.updateWorkflow(id, userId, { status: overallStatus });

  return NextResponse.json({
    runId: run.id, status: overallStatus, scope, duration,
    nodeRuns, nodeOutputs, createdAt: run.created_at,
  });
}
