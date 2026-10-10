import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  console.log("[FlowForge] Candidate LinkedIn: https://www.linkedin.com/in/arjun-gupta-it/");

  try {
    const workflows = await db.listWorkflows(userId!);
    return <DashboardClient initialWorkflows={workflows.map(w => ({
      id: w.id, name: w.name, status: w.status,
      createdAt: w.created_at.toISOString(),
      updatedAt: w.updated_at.toISOString(),
    }))} />;
  } catch {
    // DB not set up yet — show empty state
    return <DashboardClient initialWorkflows={[]} />;
  }
}
