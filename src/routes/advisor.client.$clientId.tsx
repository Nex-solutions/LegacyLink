import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Blob, PageShell } from "@/components/legacy/PageShell";
import { findClient, formatCAD, type ClientVault } from "@/lib/legacy-data";
import { getAdvisor, type Advisor } from "@/lib/legacy-auth";
import {
  addNote, addTask, deleteNote, deleteTask, getNotes, getTasks,
  subscribeWorkspace, toggleTask,
} from "@/lib/advisor-workspace";

export const Route = createFileRoute("/advisor/client/$clientId")({
  head: () => ({ meta: [{ title: "Client — LegacyLink Advisor" }] }),
  component: ClientDetail,
});

type Tab = "vaults" | "beneficiaries" | "activity" | "notes" | "tasks";

function useWorkspace() {
  return useSyncExternalStore(
    (cb) => subscribeWorkspace(cb),
    () => Date.now(),
    () => 0,
  );
}

function ClientDetail() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  const [advisor, setAdvisor] = useState<Advisor | null>(null);
  const [tab, setTab] = useState<Tab>("vaults");
  useWorkspace();

  useEffect(() => {
    const a = getAdvisor();
    if (!a) navigate({ to: "/advisor/login" });
    else setAdvisor(a);
  }, [navigate]);

  const client = findClient(clientId);
  if (!advisor) return null;
  if (!client) {
    return (
      <PageShell>
        <div className="max-w-3xl mx-auto p-12 text-center">
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 28, color: "var(--forest)" }}>
            Client not found
          </h1>
          <Link to="/advisor/dashboard" className="ll-pill ll-pill-secondary mt-6 inline-block">
            ← Back to dashboard
          </Link>
        </div>
      </PageShell>
    );
  }

  const initials = client.name.split(" ").map((s) => s[0]).join("").slice(0, 2);
  const totalBeneficiaries = client.vaultDetail.reduce((a, v) => a + v.beneficiaries.length, 0);

  return (
    <PageShell>
      {/* Header */}
      <header className="sticky top-0 z-30" style={{ background: "var(--forest)" }}>
        <div className="px-6 lg:px-12 py-4 flex items-center justify-between">
          <Link to="/advisor/dashboard" className="text-sm" style={{ color: "var(--cream)" }}>
            ← Back to dashboard
          </Link>
          <span className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "rgba(250,250,247,0.55)" }}>
            Read-only · Advisor view
          </span>
        </div>
      </header>

      <section className="relative overflow-hidden" style={{ background: "var(--forest)" }}>
        <Blob className="w-[480px] h-[480px] -top-32 -left-20" color="var(--sage)" opacity={0.18} />
        <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-12 pt-8 pb-10">
          <div className="flex flex-wrap items-center gap-5">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center font-semibold text-xl"
              style={{ background: "var(--honey)", color: "var(--forest)" }}
            >
              {initials}
            </div>
            <div className="flex-1">
              <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 32, color: "var(--cream)", fontWeight: 600 }}>
                {client.name}
              </h1>
              <p className="text-sm" style={{ color: "rgba(250,250,247,0.65)" }}>
                {client.email} · Since {client.since}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => window.print()}
                className="ll-pill ll-pill-secondary text-sm"
              >📄 Download summary</button>
              <Link
                to="/advisor/messages"
                className="ll-pill text-sm inline-block"
                style={{ background: "var(--honey)", color: "var(--forest)" }}
              >✉ Message client</Link>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MiniStat label="Protected" value={formatCAD(client.total)} />
            <MiniStat label="Vaults" value={String(client.vaults)} />
            <MiniStat label="Beneficiaries" value={String(totalBeneficiaries)} />
            <MiniStat label="Last active" value={client.lastActiveDays === 0 ? "Today" : `${client.lastActiveDays}d ago`} />
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-6 lg:px-12 mt-8">
        <div className="flex flex-wrap gap-1 border-b" style={{ borderColor: "rgba(26,46,26,0.1)" }}>
          {(["vaults", "beneficiaries", "activity", "notes", "tasks"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2.5 text-sm font-medium capitalize transition"
              style={{
                color: tab === t ? "var(--forest)" : "var(--warm-gray)",
                borderBottom: tab === t ? "2px solid var(--honey)" : "2px solid transparent",
              }}
            >{t}</button>
          ))}
        </div>

        <div className="py-8">
          {tab === "vaults" && (
            <div className="grid sm:grid-cols-2 gap-4">
              {client.vaultDetail.map((v) => (
                <VaultMini key={v.id} clientId={client.id} vault={v} />
              ))}
            </div>
          )}

          {tab === "beneficiaries" && (
            <div className="ll-card overflow-hidden">
              <table className="w-full text-sm">
                <thead style={{ background: "rgba(26,46,26,0.04)" }}>
                  <tr>
                    <Th>Name</Th><Th>Vault</Th><Th>Estimated share</Th>
                  </tr>
                </thead>
                <tbody>
                  {client.vaultDetail.flatMap((v) =>
                    v.beneficiaries.map((b, i) => {
                      const split = v.beneficiaries.length || 1;
                      return (
                        <tr key={`${v.id}-${i}`} className="border-t" style={{ borderColor: "rgba(26,46,26,0.06)" }}>
                          <Td>{b.name}</Td>
                          <Td>{v.name}</Td>
                          <Td><span style={{ color: "var(--honey)", fontWeight: 600 }}>{formatCAD(v.amount_cad / split)}</span></Td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "activity" && (
            <div className="ll-card p-6 text-sm" style={{ color: "var(--warm-gray)" }}>
              <p>Synthetic activity from this client's vault history is shown on the main advisor dashboard. Per-vault timelines are available on each vault's detail page.</p>
            </div>
          )}

          {tab === "notes" && <NotesPanel clientId={client.id} />}
          {tab === "tasks" && <TasksPanel clientId={client.id} clientName={client.name} />}
        </div>
      </div>
    </PageShell>
  );
}

// ─── Subcomponents ─────────────────────────────────────────

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="ll-card p-4">
      <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--warm-gray)" }}>{label}</p>
      <p className="mt-1.5" style={{ fontFamily: "var(--font-serif)", color: "var(--honey)", fontSize: 22, fontWeight: 600 }}>
        {value}
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider" style={{ color: "var(--warm-gray)" }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3" style={{ color: "var(--forest)" }}>{children}</td>;
}

function VaultMini({ clientId, vault }: { clientId: string; vault: ClientVault }) {
  const cond = vault.condition;
  const desc =
    cond.kind === "time" ? `Releases ${new Date(cond.unlock_date).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}`
    : cond.kind === "inactivity" ? `Inactivity · ${cond.inactivity_days}-day threshold`
    : "Manual release";
  return (
    <Link
      to="/advisor/client/$clientId/vault/$vaultId"
      params={{ clientId, vaultId: vault.id }}
      className="ll-card p-5 block transition hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between">
        <h3 style={{ fontFamily: "var(--font-serif)", fontWeight: 600, color: "var(--forest)", fontSize: 17 }}>{vault.name}</h3>
        <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--sage)", color: "var(--forest)" }}>{vault.status}</span>
      </div>
      <p className="mt-2" style={{ fontFamily: "var(--font-serif)", color: "var(--honey)", fontSize: 22, fontWeight: 600 }}>
        {formatCAD(vault.amount_cad)}
      </p>
      <p className="mt-1 text-[12px]" style={{ color: "var(--warm-gray)" }}>{desc}</p>
      <p className="mt-3 text-[12px]" style={{ color: "var(--honey)" }}>View detail →</p>
    </Link>
  );
}

function NotesPanel({ clientId }: { clientId: string }) {
  const [body, setBody] = useState("");
  const notes = getNotes(clientId);
  return (
    <div className="grid lg:grid-cols-[1fr_2fr] gap-6">
      <div className="ll-card p-5">
        <h3 style={{ fontFamily: "var(--font-serif)", fontWeight: 600, color: "var(--forest)" }}>Add a private note</h3>
        <p className="text-xs mt-1" style={{ color: "var(--warm-gray)" }}>
          Visible only to you. Never shown to the client.
        </p>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="Meeting recap, KYC reminder, planning rationale…"
          className="ll-input w-full mt-4"
        />
        <button
          disabled={!body.trim()}
          onClick={() => { addNote(clientId, body.trim()); setBody(""); toast.success("Note saved"); }}
          className="ll-pill ll-pill-primary mt-3 text-sm"
          style={{ opacity: body.trim() ? 1 : 0.5 }}
        >Save note</button>
      </div>
      <div className="space-y-3">
        {notes.length === 0 && (
          <div className="ll-card p-8 text-center text-sm" style={{ color: "var(--warm-gray)" }}>No notes yet.</div>
        )}
        {notes.map((n) => (
          <div key={n.id} className="ll-card p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--forest)" }}>{n.body}</p>
              <button onClick={() => deleteNote(n.id)} className="text-xs" style={{ color: "var(--warm-gray)" }}>Delete</button>
            </div>
            <p className="text-[11px] mt-2" style={{ color: "var(--warm-gray)" }}>{new Date(n.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TasksPanel({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const tasks = getTasks(clientId);
  return (
    <div className="grid lg:grid-cols-[1fr_2fr] gap-6">
      <div className="ll-card p-5">
        <h3 style={{ fontFamily: "var(--font-serif)", fontWeight: 600, color: "var(--forest)" }}>Add a task</h3>
        <p className="text-xs mt-1" style={{ color: "var(--warm-gray)" }}>
          Personal follow-ups for {clientName}.
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Call about Q2 review"
          className="ll-input w-full mt-4"
        />
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="ll-input w-full mt-2"
        />
        <button
          disabled={!title.trim()}
          onClick={() => { addTask({ clientId, title: title.trim(), due: due || undefined }); setTitle(""); setDue(""); toast.success("Task added"); }}
          className="ll-pill ll-pill-primary mt-3 text-sm"
          style={{ opacity: title.trim() ? 1 : 0.5 }}
        >Add task</button>
      </div>
      <div className="space-y-2">
        {tasks.length === 0 && (
          <div className="ll-card p-8 text-center text-sm" style={{ color: "var(--warm-gray)" }}>No tasks yet.</div>
        )}
        {tasks.map((t) => (
          <motion.div layout key={t.id} className="ll-card p-4 flex items-center gap-3">
            <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} className="w-4 h-4" />
            <div className="flex-1">
              <p className="text-sm" style={{ color: "var(--forest)", textDecoration: t.done ? "line-through" : undefined, opacity: t.done ? 0.6 : 1 }}>
                {t.title}
              </p>
              {t.due && (
                <p className="text-[11px]" style={{ color: "var(--warm-gray)" }}>Due {new Date(t.due).toLocaleDateString()}</p>
              )}
            </div>
            <button onClick={() => deleteTask(t.id)} className="text-xs" style={{ color: "var(--warm-gray)" }}>Delete</button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
