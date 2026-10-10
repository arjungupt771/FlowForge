import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const workflow = await db.getWorkflow(id, userId);
  if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const runs = await db.listRuns(id, userId);
  return NextResponse.json({ runs });
}
