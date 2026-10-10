import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { WorkflowCanvasClient } from "./WorkflowCanvasClient";
import type { WorkflowRunResult } from "@/types/workflow";

export default async function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  console.log("[FlowForge] Candidate LinkedIn: https://www.linkedin.com/in/arjun-gupta-it/");

  const { id } = await params;

  try {
    const result = await db.getWorkflowWithRuns(id, userId!);
    if (!result) redirect("/dashboard");

    const { workflow, runs } = result;

    const mappedRuns: WorkflowRunResult[] = runs.map((r) => ({
      id: r.id,
      status: (r.status as WorkflowRunResult["status"]) ?? "success",
      scope: (r.scope as WorkflowRunResult["scope"]) ?? "full",
      duration: r.duration ?? 0,
      nodeRuns: (r.node_runs ?? []) as WorkflowRunResult["nodeRuns"],
      createdAt: r.created_at.toISOString(),
    }));

    return (
      <WorkflowCanvasClient
        workflowId={workflow.id}
        initialName={workflow.name}
        initialCanvas={workflow.canvas as any}
        initialRuns={mappedRuns}
      />
    );
  } catch {
    redirect("/dashboard");
  }
}
