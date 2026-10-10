# FlowForge — Workflow Studio

FlowForge is a visual, node-based AI workflow builder for designing, validating, and running small LLM pipelines. Build flows with text and image inputs, crop and transform images, connect Gemini prompts, and execute the whole graph, a subset, or a single node from a clean visual editor.

This app is built for prototyping AI-driven workflows without writing custom orchestration code. It includes Clerk authentication, workflow persistence, run history, graph validation, and optional Trigger.dev background execution.

## Tech Stack

| Layer | Stack |
|---|---|
| Framework | Next.js App Router + TypeScript |
| Auth | Clerk |
| Database | PostgreSQL via `postgres` |
| Canvas | React Flow (`@xyflow/react`) |
| State | Zustand |
| LLM | Google Gemini (`@google/generative-ai`) |
| Image processing | Sharp |
| Background execution | Trigger.dev (optional) |
| Validation | Zod + custom DAG validation |
| Styling | Tailwind CSS |
| Icons | Lucide React |

---

## Setup

### 1. Clone & install

```bash
git clone <repo>
cd flowforge
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in real values:

```env
# Clerk (https://clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Neon PostgreSQL (https://neon.tech)
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# Google AI Studio (https://aistudio.google.com)
GEMINI_API_KEY=AIza...

# Admin secret (pick anything — used to run migrations)
ADMIN_SECRET=some-secret-string

# Optional — see "Execution Backend" below. Defaults to "direct" outside
# production if left unset.
EXECUTION_MODE=direct

# Optional — only needed if EXECUTION_MODE=trigger
TRIGGER_SECRET_KEY=tr_dev_...
TRIGGER_PROJECT_ID=proj_...
```

### 3. Run DB migrations

After setting `DATABASE_URL`, run:

```bash
curl -X POST http://localhost:3000/api/migrate \
  -H "x-admin-secret: <your ADMIN_SECRET>"
```

This creates the `workflows` and `workflow_runs` tables.

### 4. Seed sample workflow (optional)

```bash
# Must be authenticated — easiest via the app
# Or hit the endpoint after sign-in
POST /api/seed-sample
```

### 5. Start dev server

```bash
npm run dev
```

---

## Routes

| Route | Purpose |
|---|---|
| `/sign-in`, `/sign-up` | Clerk authentication |
| `/dashboard` | Workflow list, creation, rename, deletion, and search |
| `/workflow/[id]` | Canvas editor and execution interface |
| `/` | Redirects users to the signed-in dashboard or sign-in flow |

### Dashboard and editor

- The dashboard lists workflows with status and last-edited time, and supports name search and sorting by recency or name.
- The editor autosaves workflow changes, supports undo/redo, and can import or export workflow JSON.
- Add Crop Image and Gemini nodes from the node picker. Use canvas controls to pan, zoom, fit the graph, and open the minimap.
- Run the full workflow or selected nodes. The history panel shows prior runs and expandable node-level results.
- The dashboard and editor layouts adapt to smaller screens.

---

## Node Types

| Node | Description | Execution |
|---|---|---|
| **Request-Inputs** | Pre-placed. Add `text_field` / `image_field` inputs. | Local — resolves synchronously |
| **Crop Image** | Crops an image with [Sharp](https://sharp.pixelplumbing.com/). X/Y/width/height are set as percentages of the source image on the node; those are converted to a real pixel rectangle against the image's actual dimensions and validated before cropping. | Local or Trigger.dev — see below |
| **Gemini** | Calls Google Gemini with a Prompt, optional System Prompt, and optional Vision image(s). The Vision input accepts more than one incoming image (they're all attached to the same call). | Local or Trigger.dev — see below |
| **Response** | Pre-placed. Collects the final workflow result. | Local — resolves synchronously |

---

## Execution Backend

Which backend runs Crop Image / Gemini tasks is controlled by `EXECUTION_MODE`, read once per request:

| `EXECUTION_MODE` | Behavior |
|---|---|
| `direct` | Runs every task in the Next.js server process. No Trigger.dev involved. |
| `trigger` | Submits every task to Trigger.dev and waits for the result. **No fallback** — if submission or execution fails, that failure is returned as the node's error; it is never silently retried through the direct executor. |
| *(unset)* | Defaults to `direct` **outside production only**, as a documented dev convenience. If `NODE_ENV=production` and `EXECUTION_MODE` is unset, the request fails fast with a configuration error instead of guessing. |

This is deliberately never inferred from whether `TRIGGER_SECRET_KEY` happens to be set — the mode is always explicit.

---

## Workflow Validation

Before any node runs, the complete graph is checked by `validateWorkflow()` (`lib/execution-engine.ts`). A workflow that fails validation returns `400` with a structured `errors: { nodeId?, message }[]` array — shown in the UI as a dismissible banner (clicking an error selects the offending node) — and nothing executes.

Checks performed:

- **Cycle detection** — unchanged, still runs separately via `hasCycle()`.
- **Missing required configuration** — e.g. a Gemini node with no prompt, either static or wired; a Crop Image node with no image connected.
- **Invalid connections** — edges pointing at nodes that no longer exist, or connecting type-incompatible handles.
- **Orphan nodes** — a node with zero incoming and zero outgoing edges can never run meaningfully.
- **Multiple values into a single-value input** — most target handles accept exactly one incoming edge; a second is rejected. Gemini's `vision` handle is the one explicit exception (it's designed to accept several images, aggregated into one call) — see `MULTI_VALUE_TARGET_HANDLES` in `types/workflow.ts`.
- **Missing dependencies** — folded into the checks above (an unwired required input is both a missing-config and a missing-dependency problem).

---

## Execution Model

- **DAG-only** — cycles are rejected before execution (see Validation, above).
- **Parallel execution** — independent nodes at the same DAG level fire concurrently via `Promise.allSettled`, with each node's own try/catch guaranteeing its result always carries the correct `nodeId` / `nodeType` / `nodeLabel`, even on failure.
- **Scopes** — Full Workflow / Multi-select (partial) / Single node. For partial and single runs, the API computes the full transitive closure of upstream dependencies (`getRequiredUpstreamNodes()`) and executes exactly that set:
  - Running a single downstream node automatically (re-)runs whatever upstream nodes are required to produce fresh inputs for it.
  - Unrelated downstream nodes are never touched, and the Response node's last result is only updated when it's actually within the executed scope.

### Sample Workflow Execution Order

```
T=0  → Crop#1, Crop#2, Gemini#1 start simultaneously
       Gemini#2 starts as soon as Gemini#1 finishes (not blocked by Crops)
       Final Gemini starts only after Crop#1 + Crop#2 + Gemini#2 are all done
```

---

## Deploy to Vercel

```bash
vercel --prod
```

Set all env vars in the Vercel dashboard — including `EXECUTION_MODE` (required explicitly in production; there is no implicit default there). `vercel.json` sets `maxDuration: 60` on the execute route as headroom for downloading and cropping larger images plus a Gemini call in the same request.

If deploying Trigger.dev tasks (`EXECUTION_MODE=trigger`), note that `trigger.config.ts` marks `sharp` as an external build dependency, since it ships native bindings that shouldn't be bundled.

---

## Deliverables Checklist

- [x] Clerk auth + protected routes
- [x] Dashboard — list, create-new, open, rename, delete workflows
- [x] Searchable and sortable dashboard with workflow status summaries
- [x] Canvas — Request-Inputs + Response pre-placed; Crop Image + Gemini added via + picker
- [x] Responsive workflow editor with autosave, undo/redo, import/export, and execution controls
- [x] Right-sidebar workflow history with node-level expand
- [x] React Flow canvas: dot grid, MiniMap, pan/zoom/fit-view, undo/redo
- [x] Real image cropping (Sharp), validated against actual image dimensions — no placeholders, no artificial delays
- [x] Crop output compatible with downstream Gemini Vision (including multiple images into one call)
- [x] Correct node identity on execution failure (no more `nodeId: "?"`)
- [x] Explicit `EXECUTION_MODE` — no silent Trigger.dev → direct fallback
- [x] Full graph validation before execution, with structured, UI-visible errors
- [x] Deterministic single/partial execution semantics (auto-included upstream deps, no unrelated downstream execution)
- [x] Pulsating glow on running nodes; parallel siblings pulsate simultaneously
- [x] Type-safe connections (image ↔ text rejected visually)
- [x] Connected inputs greyed out / disabled
- [x] DAG cycle detection before run
- [x] Selective execution (single / multi-select / full)
- [x] Pre-built sample workflow (spec layout)
- [x] Gemini integration with vision
- [x] Animated purple edges
- [x] API routes with Zod validation
- [x] PostgreSQL via `postgres` driver; workflows + history persisted
- [x] Workflow export/import as JSON
- [x] TypeScript strict mode
- [x] Ready to deploy on Vercel
#   F l o w F o r g e  
 