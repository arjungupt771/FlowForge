import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { MIGRATION_SQL } from "@/lib/migrations";

export async function POST(req: Request) {
  const authHeader = req.headers.get("x-admin-secret");
  if (authHeader !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const sql = getDb();
  await sql.unsafe(MIGRATION_SQL);
  return NextResponse.json({ success: true });
}
