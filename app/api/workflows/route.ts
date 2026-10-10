import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const CreateSchema = z.object({
  name: z.string().min(1).max(100).default("Untitled Workflow"),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workflows = await db.listWorkflows(userId);
  return NextResponse.json({ workflows });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const workflow = await db.createWorkflow(userId, parsed.data.name, {});
  return NextResponse.json({ workflow }, { status: 201 });
}
