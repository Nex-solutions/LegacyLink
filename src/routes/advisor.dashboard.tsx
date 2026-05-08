import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Blob, PageShell } from "@/components/legacy/PageShell";
import {
  advisorClients, advisorTotals, activityFeed, formatCAD,
  type AdvisorClient, type ClientVault, type ActivityKind,
} from "@/lib/legacy-data";
import {
  clearAdvisor, getAdvisor, advisorDisplayName, advisorInitials,
  type Advisor,
} from "@/lib/legacy-auth";

export const Route = createFileRoute("/advisor/dashboard")({
  head: () => ({ meta: [{ title: "Advisor Dashboard — LegacyLink" }] }),
  component: AdvisorDashboard,
});

type SortKey = "recent" | "aum" | "name" | "vaults" | "upcoming";

function AdvisorDashboard() {
  const navigate = useNavigate();
  const [advisor, setAdvisorState] = useState<Advisor | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<null | "invite" | "report" | "review">(null);
  const totals = useMemo(() => advisorTotals(), []);

  useEffect(() => {
    const a = getAdvisor();
    if (!a) navigate({ to: "/advisor/login" });
    else setAdvisorState(a);
  }, [navigate]);

  const filtered = useMemo(() => {
    let list = [...advisorClients];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      switch (sort) {
        case "aum": return b.total - a.total;
        case "name": return a.name.localeCompare(b.name);
        case "vaults": return b.vaults - a.vaults;
        case "upcoming": return Number(!!b.alert) - Number(!!a.alert);
        default: return a.lastActiveDays - b.lastActiveDays;
      }
    });
    return list;
  }, [search, sort]);

  if (!advisor) return null;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <PageShell>
      {/* Sticky header */}
      <header className="sticky top-0 z-30" style={{ background: "var(--forest)" }}>
        <div className="px-6 lg:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/advisor" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--honey)" }}>
                <span style={{ color: "var(--forest)", fontFamily: "var(--font-serif)", fontWeight: 700 }}>L</span>
              </div>
              <span style={{ fontFamily: "var(--font-serif)", color: "var(--cream)", fontSize: 20, fontWeight: 600 }}>
                LegacyLink
              </span>
            </Link>
            <span className="hidden md:inline text-[11px] uppercase tracking-[0.18em]"
              style={{ color: "rgba(250,250,247,0.4)" }}>
              Advisor Portal
            </span>
          </div>

          <div className="relative flex items-center gap-4">
            <div className="hidden sm:block text-right leading-tight">
              <div className="text-[13px]" style={{ color: "var(--cream)" }}>{advisorDisplayName(advisor)}</div>
              <div className="text-[11px]" style={{ color: "rgba(250,250,247,0.55)" }}>{advisor.firm}</div>
            </div>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm"
              style={{ background: "var(--honey)", color: "var(--forest)" }}
              aria-label="Account menu"
            >
              {advisorInitials(advisor)}
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="absolute right-0 top-12 ll-card overflow-hidden w-48"
                  style={{ zIndex: 40 }}
                >
                  <Link to="/advisor/profile" onClick={() => setMenuOpen(false)}
                    className="block px-4 py-3 text-sm hover:bg-[rgba(26,46,26,0.04)]"
                    style={{ color: "var(--forest)" }}>My Profile</Link>
                  <button onClick={() => { setMenuOpen(false); toast("Settings coming soon."); }}
                    className="block w-full text-left px-4 py-3 text-sm hover:bg-[rgba(26,46,26,0.04)]"
                    style={{ color: "var(--forest)" }}>Settings</button>
                  <button
                    onClick={() => { clearAdvisor(); navigate({ to: "/advisor" }); }}
                    className="block w-full text-left px-4 py-3 text-sm border-t hover:bg-[rgba(26,46,26,0.04)]"
                    style={{ color: "var(--forest)", borderColor: "rgba(26,46,26,0.08)" }}>
                    Sign out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: "var(--forest)" }}>
        <Blob className="w-[520px] h-[520px] -top-40 -left-32" color="var(--sage)" opacity={0.18} />
        <Blob className="w-[420px] h-[420px] -bottom-32 right-0" color="var(--honey)" opacity={0.10} />
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 pt-12 pb-14">
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(34px,4vw,44px)", color: "var(--cream)", fontWeight: 600 }}>
            {greeting}, {advisor.firstName}.
          </h1>
          <p className="mt-2 text-[15px]" style={{ color: "rgba(250,250,247,0.55)" }}>
            {advisor.firm} · {advisor.advisorType}
          </p>

          {/* Stat row */}
          <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Clients" value={String(totals.clients)} />
            <StatCard label="Assets Protected" value={formatCAD(totals.aum)} />
            <StatCard label="Active Vaults" value={String(totals.vaults)} />
            <StatCard label="Upcoming Releases" value={String(totals.upcoming)} highlight={totals.upcoming > 0} />
          </div>
        </div>
      </section>

      {/* Main */}
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12 grid lg:grid-cols-[1.85fr_1fr] gap-10">
        {/* LEFT — Clients */}
        <section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 600, color: "var(--forest)" }}>
              Your Clients
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="ll-input"
                style={{ width: 240, padding: "0.6rem 0.9rem" }}
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="ll-input"
                style={{ width: 200, padding: "0.6rem 0.9rem" }}
              >
                <option value="recent">Sort: Recent</option>
                <option value="aum">Sort: AUM</option>
                <option value="name">Sort: Name</option>
                <option value="vaults">Sort: Vault Count</option>
                <option value="upcoming">Sort: Upcoming Releases</option>
              </select>
              <button onClick={() => setModal("invite")}
                className="ll-pill ll-pill-secondary text-sm" style={{ padding: "0.6rem 1.1rem" }}>
                + Invite Client
              </button>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {filtered.map((c) => (
              <ClientCard
                key={c.id}
                client={c}
                expanded={open === c.id}
                onToggle={() => setOpen(open === c.id ? null : c.id)}
              />
            ))}
            {filtered.length === 0 && (
              <div className="ll-card p-12 text-center" style={{ color: "var(--warm-gray)" }}>
                No clients match "{search}".
              </div>
            )}
          </div>
        </section>

        {/* RIGHT — Activity + Quick Actions */}
        <aside className="space-y-6">
          <div className="ll-card p-6">
            <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 600, color: "var(--forest)" }}>
              Recent Activity
            </h3>
            <div className="mt-5 space-y-5">
              {activityFeed.map((e) => (
                <div key={e.id} className="flex items-start gap-3">
                  <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: kindColor(e.kind) }} />
                  <div className="flex-1">
                    <p className="text-sm" style={{ color: "var(--forest)", fontWeight: 500 }}>{e.title}</p>
                    <p className="text-[13px] mt-0.5" style={{ color: "var(--warm-gray)" }}>{e.detail}</p>
                    <p className="text-[12px] mt-1" style={{ color: "rgba(74,74,74,0.55)" }}>{e.when}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => toast("Full activity log coming soon.")}
              className="mt-6 text-sm font-medium" style={{ color: "var(--honey)" }}>
              View All Activity →
            </button>
          </div>

          <div className="ll-card p-6">
            <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 600, color: "var(--forest)" }}>
              Quick Actions
            </h3>
            <div className="mt-5 space-y-3">
              <QuickActionButton onClick={() => setModal("invite")} icon="✉" label="Invite a New Client" />
              <QuickActionButton onClick={() => setModal("report")} icon="📋" label="Download Client Report" />
              <QuickActionButton onClick={() => setModal("review")} icon="📞" label="Schedule a Review" />
            </div>
          </div>
        </aside>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal === "invite" && <InviteModal advisor={advisor} onClose={() => setModal(null)} />}
        {modal === "report" && <ReportModal onClose={() => setModal(null)} />}
        {modal === "review" && <ReviewModal onClose={() => setModal(null)} />}
      </AnimatePresence>
    </PageShell>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────

function StatCard({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="ll-card p-5"
      style={{ borderLeft: highlight ? "3px solid var(--honey)" : undefined }}>
      <p className="text-[11px] uppercase tracking-widest" style={{ color: "var(--warm-gray)" }}>{label}</p>
      <p className="mt-2" style={{ fontFamily: "var(--font-serif)", color: "var(--honey)", fontSize: 32, fontWeight: 600, lineHeight: 1 }}>
        {value}
      </p>
    </div>
  );
}

function QuickActionButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors"
      style={{ borderColor: "rgba(26,46,26,0.10)", color: "var(--forest)" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(232,160,32,0.08)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span className="text-base">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function StatusPill({ status }: { status: AdvisorClient["status"] }) {
  const map = {
    active: { dot: "🟢", text: "Active", color: "var(--sage)" },
    quiet: { dot: "🟡", text: "Quiet", color: "var(--honey)" },
    inactive: { dot: "🔴", text: "Inactive", color: "#C0392B" },
  } as const;
  const m = map[status];
  return (
    <span className="inline-flex items-center gap-2 text-[12px] px-3 py-1 rounded-full"
      style={{ background: "rgba(26,46,26,0.05)", color: "var(--forest)" }}>
      <span className="w-2 h-2 rounded-full" style={{ background: m.color }} />
      {m.text}
    </span>
  );
}

function ConditionTag({ kind }: { kind: "time" | "inactivity" | "manual" }) {
  const map = {
    time: { icon: "📅", label: "Time-based", bg: "rgba(127,168,130,0.20)", color: "var(--forest)" },
    inactivity: { icon: "💤", label: "Inactivity", bg: "rgba(232,160,32,0.18)", color: "var(--forest)" },
    manual: { icon: "🔑", label: "Manual", bg: "rgba(74,74,74,0.10)", color: "var(--warm-gray)" },
  } as const;
  const m = map[kind];
  return (
    <span className="text-[11px] px-2.5 py-1 rounded-full font-medium"
      style={{ background: m.bg, color: m.color }}>
      {m.icon} {m.label}
    </span>
  );
}

function ClientCard({ client, expanded, onToggle }: {
  client: AdvisorClient; expanded: boolean; onToggle: () => void;
}) {
  const initials = client.name.split(" ").map((s) => s[0]).join("").slice(0, 2);
  const lastActive = client.lastActiveDays === 0 ? "Today"
    : client.lastActiveDays === 1 ? "Yesterday"
    : `${client.lastActiveDays} days ago`;

  return (
    <motion.div layout className="ll-card overflow-hidden"
      whileHover={{ y: -3, boxShadow: "0 12px 48px rgba(26,46,26,0.14)" }}
      transition={{ duration: 0.2 }}>
      <div className="p-6">
        {/* Top row */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-full flex items-center justify-center font-semibold"
              style={{ background: "var(--forest)", color: "var(--cream)" }}>
              {initials}
            </div>
            <div>
              <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 600, color: "var(--forest)" }}>
                {client.name}
              </h3>
              <p className="text-[13px]" style={{ color: "rgba(74,74,74,0.7)" }}>{client.email}</p>
            </div>
          </div>
          <StatusPill status={client.status} />
        </div>

        {/* Middle row */}
        <p className="mt-4 text-[13px]" style={{ color: "rgba(74,74,74,0.75)" }}>
          {client.vaults} vaults · {formatCAD(client.total)} protected · Since {client.since} · Last active {lastActive}
        </p>

        {/* Alert */}
        {client.alert && (
          <div className="mt-4 px-4 py-2.5 rounded-xl text-[13px] font-medium flex items-center gap-2"
            style={{
              background: client.status === "inactive" ? "rgba(192,57,43,0.10)" : "rgba(232,160,32,0.18)",
              color: "var(--forest)",
            }}>
            <span>{client.status === "inactive" ? "⚠" : "⚡"}</span>
            <span>{client.alert}</span>
          </div>
        )}

        {/* Bottom row */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {client.conditionTypes.map((t) => <ConditionTag key={t} kind={t} />)}
          </div>
          <button onClick={onToggle} className="text-sm font-medium" style={{ color: "var(--honey)" }}>
            {expanded ? "Collapse ↑" : "View Portfolio →"}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-6 pb-6 grid sm:grid-cols-2 gap-3 border-t pt-5"
              style={{ borderColor: "rgba(26,46,26,0.08)" }}>
              {client.vaultDetail.map((v) => <ReadOnlyVault key={v.id} vault={v} />)}
            </div>
            <div className="px-6 pb-5 text-right">
              <button onClick={onToggle} className="text-sm" style={{ color: "var(--warm-gray)" }}>
                Collapse
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ReadOnlyVault({ vault }: { vault: ClientVault }) {
  const cond = vault.condition;
  const desc =
    cond.kind === "time" ? `Releases on ${new Date(cond.unlock_date).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" })}`
    : cond.kind === "inactivity" ? `Inactivity trigger · ${cond.inactivity_days}-day threshold`
    : "Manual release";

  let progress = 0;
  if (cond.kind === "inactivity") {
    const daysSince = Math.max(0, Math.floor((Date.now() - new Date(cond.last_checkin).getTime()) / (1000 * 60 * 60 * 24)));
    progress = Math.min(100, (daysSince / cond.inactivity_days) * 100);
  }

  return (
    <div className="p-5 rounded-2xl" style={{ background: "rgba(26,46,26,0.04)" }}>
      <div className="flex items-start justify-between gap-3">
        <h4 style={{ fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 600, color: "var(--forest)" }}>
          {vault.name}
        </h4>
        <span className="text-[11px] px-2 py-1 rounded-full"
          style={{ background: "var(--sage)", color: "var(--forest)" }}>
          {vault.status}
        </span>
      </div>
      <p className="mt-2" style={{ fontFamily: "var(--font-serif)", color: "var(--honey)", fontSize: 22, fontWeight: 600 }}>
        {formatCAD(vault.amount_cad)}
      </p>
      <p className="mt-1 text-[12px]" style={{ color: "var(--warm-gray)" }}>{desc}</p>

      {cond.kind === "inactivity" && (
        <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(26,46,26,0.08)" }}>
          <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "var(--honey)" }} />
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        {vault.beneficiaries.map((b, i) => (
          <span key={i} className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold"
            style={{ background: "var(--sage)", color: "var(--forest)" }}>
            {b.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
          </span>
        ))}
        <button onClick={() => toast("Read-only vault detail coming soon.")}
          className="ml-auto text-[12px]" style={{ color: "var(--honey)" }}>
          View Full Detail →
        </button>
      </div>
    </div>
  );
}

function kindColor(k: ActivityKind) {
  switch (k) {
    case "fund": return "var(--honey)";
    case "checkin": return "var(--sage)";
    case "release": return "var(--forest)";
    case "warning": return "#C0392B";
    case "beneficiary": return "var(--honey)";
  }
}

// ─── Modals ──────────────────────────────────────────────────────

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(26,46,26,0.55)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        className="ll-card p-8 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function InviteModal({ advisor, onClose }: { advisor: Advisor; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState(
    `Hi ${name || "[Name]"}, I'd like to invite you to set up your estate vault on LegacyLink — it's a simple way to make sure what matters reaches the people who matter.`
  );
  return (
    <ModalShell onClose={onClose}>
      <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 600, color: "var(--forest)" }}>
        Invite a Client to LegacyLink
      </h3>
      <div className="mt-5 space-y-3">
        <input className="ll-input" placeholder="Client name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="ll-input" placeholder="client@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <textarea className="ll-input min-h-[120px]" value={msg} onChange={(e) => setMsg(e.target.value)} />
        <p className="text-[12px]" style={{ color: "var(--warm-gray)" }}>
          This invitation will come from {advisor.firstName} {advisor.lastName}, {advisor.firm}.
        </p>
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
        <button onClick={() => { navigator.clipboard?.writeText("https://legacylink.app/invite/abc123"); toast.success("Link copied"); }}
          className="ll-pill ll-pill-ghost text-sm">Copy Invite Link</button>
        <button onClick={() => {
          if (!email) return toast.error("Add a client email.");
          onClose();
          toast.success(`Invitation sent to ${email}. You'll be notified when they sign up.`);
        }} className="ll-pill ll-pill-primary text-sm">Send Invitation</button>
      </div>
    </ModalShell>
  );
}

function ReportModal({ onClose }: { onClose: () => void }) {
  const [client, setClient] = useState(advisorClients[0].id);
  return (
    <ModalShell onClose={onClose}>
      <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 600, color: "var(--forest)" }}>
        Download Client Report
      </h3>
      <p className="mt-2 text-sm" style={{ color: "var(--warm-gray)" }}>
        Choose a client to generate a printable vault summary.
      </p>
      <select className="ll-input mt-5" value={client} onChange={(e) => setClient(e.target.value)}>
        {advisorClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} className="ll-pill ll-pill-ghost text-sm">Cancel</button>
        <button onClick={() => { onClose(); setTimeout(() => window.print(), 100); }}
          className="ll-pill ll-pill-secondary text-sm">Generate Report</button>
      </div>
    </ModalShell>
  );
}

function ReviewModal({ onClose }: { onClose: () => void }) {
  const [client, setClient] = useState(advisorClients[0].name);
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  return (
    <ModalShell onClose={onClose}>
      <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 600, color: "var(--forest)" }}>
        Schedule a Review
      </h3>
      <div className="mt-5 space-y-3">
        <select className="ll-input" value={client} onChange={(e) => setClient(e.target.value)}>
          {advisorClients.map((c) => <option key={c.id}>{c.name}</option>)}
        </select>
        <input type="datetime-local" className="ll-input" value={when} onChange={(e) => setWhen(e.target.value)} />
        <textarea className="ll-input min-h-[100px]" placeholder="Notes for the client…" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} className="ll-pill ll-pill-ghost text-sm">Cancel</button>
        <button onClick={() => { onClose(); toast.success(`Review request sent to ${client}.`); }}
          className="ll-pill ll-pill-primary text-sm">Send Review Request</button>
      </div>
    </ModalShell>
  );
}
