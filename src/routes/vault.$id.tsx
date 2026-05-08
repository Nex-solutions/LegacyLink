import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { differenceInDays, differenceInSeconds, format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AppHeader } from "@/components/legacy/Nav";
import { PageShell } from "@/components/legacy/PageShell";
import { formatCAD, getVault, updateVault, type Vault } from "@/lib/legacy-data";
import { getUser } from "@/lib/legacy-auth";


export const Route = createFileRoute("/vault/$id")({
  head: () => ({ meta: [{ title: "Vault — LegacyLink" }] }),
  component: VaultDetail,
});

function useCountdown(target: Date) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, differenceInSeconds(target, now));
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  const secs = diff % 60;
  return { days, hours, mins, secs };
}

function CountdownBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="ll-card p-5 text-center min-w-[80px]" style={{ border: "2px solid var(--honey)" }}>
      <div style={{ fontFamily: "var(--font-serif)", color: "var(--forest)", fontSize: 36, fontWeight: 600, lineHeight: 1 }}>
        {String(value).padStart(2, "0")}
      </div>
      <div className="text-xs mt-2 uppercase tracking-wider" style={{ color: "var(--warm-gray)" }}>{label}</div>
    </div>
  );
}

function Initials({ name }: { name: string }) {
  const i = name.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="w-12 h-12 rounded-full flex items-center justify-center font-semibold flex-shrink-0" style={{ background: "var(--forest)", color: "var(--cream)" }}>{i}</div>
  );
}

function VaultDetail() {
  const { id } = useParams({ from: "/vault/$id" });
  const navigate = useNavigate();
  const [vault, setVault] = useState<Vault | null>(null);
  const [showRelease, setShowRelease] = useState(false);
  const [releasing, setReleasing] = useState(false);

  useEffect(() => {
    if (!getUser()) { navigate({ to: "/login" }); return; }
    const v = getVault(id);
    if (!v) { navigate({ to: "/dashboard" }); return; }
    setVault(v);
  }, [id, navigate]);

  if (!vault) return null;

  function checkIn() {
    if (!vault || vault.condition.kind !== "inactivity") return;
    const today = new Date().toISOString().slice(0, 10);
    const updated = { ...vault, condition: { ...vault.condition, last_checkin: today } };
    updateVault(vault.id, updated);
    setVault(updated);
    toast.success("Checked in. Countdown reset.");
  }

  async function release() {
    setReleasing(true);
    setTimeout(() => {
      if (!vault) return;
      updateVault(vault.id, { status: "Released" });
      setVault({ ...vault, status: "Released" });
      setReleasing(false);
      setShowRelease(false);
      toast.success("Vault released. Beneficiaries notified via Interac e-Transfer.");
    }, 2200);
  }

  const cond = vault.condition;

  return (
    <PageShell>
      <AppHeader />

      {/* Hero */}
      <div className="relative overflow-hidden" style={{ background: "var(--forest)" }}>
        <div className="ll-blob ll-drift" style={{ width: 480, height: 480, top: -160, right: -100, background: "var(--honey)", opacity: 0.18 }} />
        <div className="ll-blob ll-drift" style={{ width: 360, height: 360, bottom: -160, left: -60, background: "var(--sage)", opacity: 0.18 }} />
        <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-12 py-14">
          <Link to="/dashboard" className="text-sm" style={{ color: "rgba(250,250,247,0.75)" }}>← Back to dashboard</Link>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <h1 style={{ fontFamily: "var(--font-serif)", color: "var(--cream)", fontSize: 40, fontWeight: 600 }}>{vault.name}</h1>
            <span className="px-4 py-1.5 rounded-full text-sm font-medium" style={{ background: vault.status === "Active" ? "var(--sage)" : "rgba(250,250,247,0.2)", color: "var(--forest)" }}>{vault.status}</span>
          </div>
          <p className="mt-6" style={{ fontFamily: "var(--font-serif)", color: "var(--honey)", fontSize: 56, fontWeight: 600 }}>{formatCAD(vault.amount_cad)}</p>
          <p className="mt-2" style={{ color: "rgba(250,250,247,0.78)" }}>
            {cond.kind === "time" && `Releases automatically on ${format(parseISO(cond.unlock_date), "MMMM d, yyyy")}`}
            {cond.kind === "inactivity" && `Releases if silent for ${cond.inactivity_days} days`}
            {cond.kind === "manual" && "Released at your command"}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-6 lg:px-12 py-12 grid lg:grid-cols-[1.5fr_1fr] gap-8">
        <div className="space-y-6">
          {cond.kind === "time" && <TimeCondition unlockDate={cond.unlock_date} />}
          {cond.kind === "inactivity" && <InactivityCondition cond={cond} onCheckIn={checkIn} />}
          {cond.kind === "manual" && (
            <div className="ll-card p-8">
              <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600 }}>You control when this releases.</h3>
              <p className="mt-2" style={{ color: "var(--warm-gray)" }}>This vault waits patiently until you say it's time.</p>
              {vault.status === "Active" && (
                <button onClick={() => setShowRelease(true)} className="ll-pill ll-pill-secondary mt-6">Release Vault</button>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="ll-card p-8">
            <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600 }}>Activity</h3>
            <div className="mt-6 relative pl-8">
              <div className="absolute left-2 top-2 bottom-2 w-px" style={{ background: "rgba(26,46,26,0.15)" }} />
              {[
                { d: vault.created_at, label: "Vault created" },
                { d: vault.created_at, label: `Funded with ${formatCAD(vault.amount_cad)}` },
                ...(cond.kind === "inactivity" ? [{ d: cond.last_checkin, label: "Last check-in" }] : []),
                ...(vault.status === "Released" ? [{ d: new Date().toISOString().slice(0, 10), label: "Released to beneficiaries" }] : []),
              ].map((e, i) => (
                <div key={i} className="relative mb-5">
                  <div className="absolute -left-[26px] top-1.5 w-3 h-3 rounded-full" style={{ background: "var(--honey)" }} />
                  <p style={{ color: "var(--forest)", fontWeight: 500 }}>{e.label}</p>
                  <p className="text-xs" style={{ color: "var(--warm-gray)" }}>{format(parseISO(e.d), "MMMM d, yyyy")}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <TrusteesPanel vault={vault} onChange={(b) => { updateVault(vault.id, { beneficiaries: b }); setVault({ ...vault, beneficiaries: b }); }} />

          <div className="ll-card p-8">
            <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600 }}>Actions</h3>
            <div className="mt-6 space-y-3">
              {cond.kind === "manual" && vault.status === "Active" && (
                <button onClick={() => setShowRelease(true)} className="ll-pill ll-pill-secondary w-full">Release Now</button>
              )}
              <button onClick={() => window.print()} className="ll-pill ll-pill-ghost w-full">Download Summary</button>
            </div>
          </div>
        </div>
      </div>

      {showRelease && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(26,46,26,0.5)" }}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="ll-card p-8 max-w-md w-full">
            <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 600 }}>Are you sure?</h3>
            <p className="mt-3" style={{ color: "var(--warm-gray)" }}>This will send funds to your beneficiaries via Interac e-Transfer. This cannot be undone.</p>
            <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setShowRelease(false)} className="ll-pill ll-pill-ghost">Cancel</button>
              <button onClick={release} disabled={releasing} className="ll-pill ll-pill-secondary">{releasing ? "Releasing…" : "Confirm Release"}</button>
            </div>
          </motion.div>
        </div>
      )}
    </PageShell>
  );
}

function TimeCondition({ unlockDate }: { unlockDate: string }) {
  const target = parseISO(unlockDate);
  const c = useCountdown(target);
  return (
    <div className="ll-card p-8">
      <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600 }}>Unlocks in</h3>
      <div className="grid grid-cols-4 gap-3 mt-6">
        <CountdownBox value={c.days} label="Days" />
        <CountdownBox value={c.hours} label="Hours" />
        <CountdownBox value={c.mins} label="Mins" />
        <CountdownBox value={c.secs} label="Secs" />
      </div>
      <p className="mt-6" style={{ color: "var(--warm-gray)" }}>Unlocks {format(target, "MMMM d, yyyy")}</p>
    </div>
  );
}

function InactivityCondition({ cond, onCheckIn }: { cond: { kind: "inactivity"; inactivity_days: number; last_checkin: string }; onCheckIn: () => void }) {
  const last = parseISO(cond.last_checkin);
  const elapsed = Math.max(0, differenceInDays(new Date(), last));
  const remaining = Math.max(0, cond.inactivity_days - elapsed);
  const pct = Math.min(100, (elapsed / cond.inactivity_days) * 100);
  const r = 70;
  const C = 2 * Math.PI * r;
  return (
    <div className="ll-card p-8">
      <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600 }}>Check-in status</h3>
      <p className="mt-2 text-sm" style={{ color: "var(--warm-gray)" }}>Last check-in: {format(last, "MMMM d, yyyy")}</p>
      <div className="mt-6 flex items-center gap-8">
        <svg width="170" height="170" viewBox="0 0 170 170">
          <circle cx="85" cy="85" r={r} stroke="rgba(26,46,26,0.08)" strokeWidth="12" fill="none" />
          <circle
            cx="85" cy="85" r={r}
            stroke="var(--honey)" strokeWidth="12" fill="none"
            strokeDasharray={C}
            strokeDashoffset={C - (C * pct) / 100}
            strokeLinecap="round"
            transform="rotate(-90 85 85)"
          />
          <text x="85" y="80" textAnchor="middle" style={{ fontFamily: "var(--font-serif)", fontSize: 32, fontWeight: 600, fill: "var(--forest)" }}>{remaining}</text>
          <text x="85" y="105" textAnchor="middle" style={{ fontSize: 11, fill: "var(--warm-gray)" }}>days left</text>
        </svg>
        <div className="flex-1">
          <button onClick={onCheckIn} className="ll-pill ll-pill-sage">✓ Check In</button>
          <p className="text-xs mt-3" style={{ color: "var(--warm-gray)" }}>Checking in resets your {cond.inactivity_days}-day countdown.</p>
        </div>
      </div>
    </div>
  );
}

