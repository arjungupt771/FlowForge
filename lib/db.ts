import postgres from "postgres";

let _sql: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (!_sql) {
    _sql = postgres(process.env.DATABASE_URL!, {
      ssl: { rejectUnauthorized: false },
      max: 10,
    });
  }
  return _sql;
}

export interface Workflow {
  id: string;
  user_id: string;
  name: string;
  canvas: Record<string, unknown>;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  user_id: string;
  status: string;
  scope: string;
  duration: number | null;
  node_runs: unknown[];
  created_at: Date;
}

export const db = {
  async listWorkflows(userId: string) {
    const sql = getDb();
    return sql<Workflow[]>`
      SELECT id, user_id, name, status, created_at, updated_at
      FROM workflows WHERE user_id = ${userId} ORDER BY updated_at DESC`;
  },

  async getWorkflow(id: string, userId: string) {
    const sql = getDb();
    const rows = await sql<Workflow[]>`
      SELECT * FROM workflows WHERE id = ${id} AND user_id = ${userId} LIMIT 1`;
    return rows[0] ?? null;
  },

  async createWorkflow(userId: string, name: string, canvas: unknown) {
    const sql = getDb();
    const canvasJson = JSON.stringify(canvas ?? {});
    const rows = await sql<Workflow[]>`
      INSERT INTO workflows (user_id, name, canvas)
      VALUES (${userId}, ${name}, ${canvasJson}::jsonb)
      RETURNING *`;
    return rows[0];
  },

  async updateWorkflow(id: string, userId: string, data: {
    name?: string; canvas?: unknown; status?: string;
  }) {
    const sql = getDb();
    const sets: string[] = ["updated_at = NOW()"];
    const vals: (string | number)[] = [];
    let i = 1;

    if (data.name !== undefined)   { sets.push(`name = $${i++}`);            vals.push(data.name); }
    if (data.canvas !== undefined) { sets.push(`canvas = $${i++}::jsonb`);   vals.push(JSON.stringify(data.canvas)); }
    if (data.status !== undefined) { sets.push(`status = $${i++}`);          vals.push(data.status); }

    vals.push(id);
    vals.push(userId);

    const rows = await sql.unsafe<Workflow[]>(
      `UPDATE workflows SET ${sets.join(", ")} WHERE id = $${i++} AND user_id = $${i} RETURNING *`,
      vals as postgres.ParameterOrJSON<never>[]
    );
    return (rows as unknown as Workflow[])[0] ?? null;
  },

  async deleteWorkflow(id: string, userId: string) {
    const sql = getDb();
    await sql`DELETE FROM workflows WHERE id = ${id} AND user_id = ${userId}`;
  },

  async createRun(workflowId: string, userId: string, data: {
    status: string; scope: string; duration: number; nodeRuns: unknown[];
  }) {
    const sql = getDb();
    const nodeRunsJson = JSON.stringify(data.nodeRuns ?? []);
    const rows = await sql<WorkflowRun[]>`
      INSERT INTO workflow_runs (workflow_id, user_id, status, scope, duration, node_runs)
      VALUES (${workflowId}, ${userId}, ${data.status}, ${data.scope}, ${data.duration}, ${nodeRunsJson}::jsonb)
      RETURNING *`;
    return rows[0];
  },

  async listRuns(workflowId: string, userId: string) {
    const sql = getDb();
    return sql<WorkflowRun[]>`
      SELECT * FROM workflow_runs
      WHERE workflow_id = ${workflowId} AND user_id = ${userId}
      ORDER BY created_at DESC LIMIT 50`;
  },

  async getWorkflowWithRuns(id: string, userId: string) {
    const sql = getDb();
    const wfRows = await sql<Workflow[]>`SELECT * FROM workflows WHERE id=${id} AND user_id=${userId} LIMIT 1`;
    if (!wfRows[0]) return null;
    const runs = await sql<WorkflowRun[]>`
      SELECT * FROM workflow_runs WHERE workflow_id=${id} AND user_id=${userId}
      ORDER BY created_at DESC LIMIT 50`;
    return { workflow: wfRows[0], runs };
  },
};
