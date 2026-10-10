import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SAMPLE_WORKFLOW } from "@/lib/sample-workflow";

// Creates the required sample workflow for the authenticated user
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workflow = await db.createWorkflow(
    userId,
    "Sample Workflow (Spec Reference)",
    SAMPLE_WORKFLOW
  );
  return NextResponse.json({ workflow });
}
