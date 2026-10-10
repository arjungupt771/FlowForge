"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  ArrowDownUp, ArrowRight, Boxes, Check, Clock3, FilePlus2, LayoutDashboard,
  MoreHorizontal, Pencil, Plus, Search, Sparkles, Trash2, Workflow as WorkflowIcon,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

interface Workflow {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_STYLES: Record<string, { color: string; label: string }> = {
  idle: { color: "#94a3b8", label: "Draft" },
  success: { color: "#4ade80", label: "Successful" },
  failed: { color: "#fb7185", label: "Failed" },
  partial: { color: "#fbbf24", label: "Partial" },
  running: { color: "#a78bfa", label: "Running" },
};

function StatusBadge({ status }: { status: string }) {
  const value = STATUS_STYLES[status] ?? STATUS_STYLES.idle;
  return <span className="workflow-status" style={{ "--status-color": value.color } as React.CSSProperties}>
    <span className="workflow-status-dot" />{value.label}
  </span>;
}

function WorkflowCard({ workflow, onOpen, onRename, onDelete }: {
  workflow: Workflow;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(workflow.name);

  const finishRename = () => {
    const cleanName = name.trim();
    if (cleanName && cleanName !== workflow.name) onRename(cleanName);
    else setName(workflow.name);
    setRenaming(false);
  };

  return (
    <article className="workflow-card">
      <button className="workflow-card-preview" onClick={onOpen} aria-label={`Open ${workflow.name}`}>
        <div className="preview-flow" aria-hidden="true">
          <span className="preview-node preview-node-input"><Boxes size={14} />Input</span>
          <span className="preview-connector" />
          <span className="preview-node preview-node-ai"><Sparkles size={14} />Model</span>
          <span className="preview-connector" />
          <span className="preview-node preview-node-output"><Check size={14} />Output</span>
        </div>
        <span className="preview-open">Open workflow <ArrowRight size={14} /></span>
      </button>

      <div className="workflow-card-content">
        <div className="workflow-card-title-row">
          <div className="workflow-card-heading">
            {renaming ? <input autoFocus className="workflow-rename-input" value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={finishRename}
              onKeyDown={(event) => {
                if (event.key === "Enter") finishRename();
                if (event.key === "Escape") { setName(workflow.name); setRenaming(false); }
              }} aria-label="Workflow name" /> :
              <button className="workflow-title" onClick={onOpen} title={workflow.name}>{workflow.name}</button>}
          </div>
          <div className="workflow-menu-wrap">
            <button className="icon-button workflow-menu-button" aria-label={`Actions for ${workflow.name}`}
              aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><MoreHorizontal size={18} /></button>
            {menuOpen && <>
              <button className="menu-dismiss" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
              <div className="workflow-menu">
                <button onClick={() => { setMenuOpen(false); onOpen(); }}><ArrowRight size={15} />Open</button>
                <button onClick={() => { setMenuOpen(false); setRenaming(true); }}><Pencil size={15} />Rename</button>
                <button className="danger-action" onClick={() => { setMenuOpen(false); onDelete(); }}><Trash2 size={15} />Delete</button>
              </div>
            </>}
          </div>
        </div>
        <div className="workflow-card-meta">
          <StatusBadge status={workflow.status} />
          <span className="meta-divider" />
          <span className="updated-meta"><Clock3 size={13} />{formatRelativeTime(workflow.updatedAt)}</span>
        </div>
      </div>
    </article>
  );
}

export function DashboardClient({ initialWorkflows }: { initialWorkflows: Workflow[] }) {
  const [workflows, setWorkflows] = useState<Workflow[]>(initialWorkflows);
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [query, setQuery] = useState("");
  const [sortRecent, setSortRecent] = useState(true);
  const router = useRouter();

  const filteredWorkflows = useMemo(() => {
    const filtered = workflows.filter((workflow) => workflow.name.toLowerCase().includes(query.trim().toLowerCase()));
    return filtered.sort((a, b) => sortRecent
      ? new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      : a.name.localeCompare(b.name));
  }, [workflows, query, sortRecent]);

  const createWorkflow = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled Workflow" }),
      });
      const { workflow } = await res.json();
      router.push(`/workflow/${workflow.id}`);
    } finally { setCreating(false); }
  };

  const loadSampleWorkflow = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/seed-sample", { method: "POST" });
      const { workflow } = await res.json();
      router.push(`/workflow/${workflow.id}`);
    } finally { setSeeding(false); }
  };

  const renameWorkflow = async (id: string, name: string) => {
    await fetch(`/api/workflows/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
    });
    setWorkflows((items) => items.map((item) => item.id === id ? { ...item, name } : item));
  };

  const deleteWorkflow = async (id: string) => {
    if (!confirm("Delete this workflow? This cannot be undone.")) return;
    await fetch(`/api/workflows/${id}`, { method: "DELETE" });
    setWorkflows((items) => items.filter((item) => item.id !== id));
  };

  const successfulCount = workflows.filter((workflow) => workflow.status === "success").length;
  const runningCount = workflows.filter((workflow) => workflow.status === "running").length;

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <a href="/dashboard" className="brand-lockup">
          <span className="brand-mark"><WorkflowIcon size={19} strokeWidth={2.2} /></span>
          <span className="brand-copy"><strong>FlowForge</strong><small>Workflow Studio</small></span>
        </a>
        <div className="sidebar-section-label">Workspace</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <a href="/dashboard" className="sidebar-link active"><LayoutDashboard size={17} />Workflows<span className="nav-count">{workflows.length}</span></a>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help"><span className="help-orb"><Sparkles size={15} /></span><div><strong>Build something great</strong><span>Connect your first model</span></div></div>
          <div className="sidebar-account"><UserButton /><div><strong>Your account</strong><span>Manage profile</span></div></div>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-topbar"><div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>Workflows</strong></div><span className="workspace-pill"><span />Personal workspace</span></header>
        <div className="dashboard-content">
          <section className="dashboard-heading">
            <div><div className="eyebrow">YOUR AUTOMATION WORKSPACE</div><h1>Workflows</h1><p>Design, run, and manage your AI workflows.</p></div>
            <div className="heading-actions">
              <button className="button button-secondary" onClick={loadSampleWorkflow} disabled={seeding}>{seeding ? <span className="button-spinner" /> : <Sparkles size={16} />}Explore sample</button>
              <button className="button button-primary" onClick={createWorkflow} disabled={creating}>{creating ? <span className="button-spinner" /> : <Plus size={17} />}New workflow</button>
            </div>
          </section>

          <section className="workspace-stats" aria-label="Workflow summary">
            <div className="stat-card"><span className="stat-icon stat-icon-violet"><WorkflowIcon size={18} /></span><div><span className="stat-label">Total workflows</span><strong>{workflows.length}</strong></div></div>
            <div className="stat-card"><span className="stat-icon stat-icon-green"><Check size={18} /></span><div><span className="stat-label">Successful</span><strong>{successfulCount}</strong></div></div>
            <div className="stat-card"><span className="stat-icon stat-icon-blue"><Clock3 size={18} /></span><div><span className="stat-label">Currently running</span><strong>{runningCount}</strong></div></div>
          </section>

          <section className="workflow-section">
            <div className="section-heading"><div><h2>All workflows</h2><span>{workflows.length} {workflows.length === 1 ? "workflow" : "workflows"} in your workspace</span></div>
              {workflows.length > 0 && <div className="workflow-controls"><label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workflows" aria-label="Search workflows" />{query && <button onClick={() => setQuery("")} aria-label="Clear search">×</button>}</label><button className="sort-button" onClick={() => setSortRecent(!sortRecent)}><ArrowDownUp size={15} />{sortRecent ? "Recently edited" : "Name"}</button></div>}
            </div>

            {filteredWorkflows.length === 0 ? (
              workflows.length === 0 ? <div className="empty-state"><span className="empty-icon"><FilePlus2 size={26} /></span><h3>Start with a workflow</h3><p>Build a visual AI pipeline from scratch, or open a sample to see how the pieces fit together.</p><div className="empty-actions"><button className="button button-primary" onClick={createWorkflow}><Plus size={17} />Create a workflow</button><button className="button button-secondary" onClick={loadSampleWorkflow}><Sparkles size={16} />Open sample</button></div></div>
                : <div className="no-results"><Search size={20} /><strong>No workflows found</strong><span>Try another name or clear your search.</span><button onClick={() => setQuery("")}>Clear search</button></div>
            ) : <div className="workflow-grid">{filteredWorkflows.map((workflow) => <WorkflowCard key={workflow.id} workflow={workflow}
              onOpen={() => router.push(`/workflow/${workflow.id}`)}
              onRename={(name) => renameWorkflow(workflow.id, name)}
              onDelete={() => deleteWorkflow(workflow.id)} />)}</div>}
          </section>
        </div>
      </main>
    </div>
  );
}
