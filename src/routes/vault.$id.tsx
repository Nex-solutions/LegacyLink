import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { differenceInDays, differenceInSeconds, format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AppHeader } from "@/components/legacy/Nav";
import { PageShell } from "@/components/legacy/PageShell";
import { formatCAD, getVault, updateVault, type Vault, type Beneficiary, type VaultCondition } from "@/lib/legacy-data";
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

          {vault.status === "Active" && (
            <ConditionPanel
              vault={vault}
              onChange={(c) => { updateVault(vault.id, { condition: c }); setVault({ ...vault, condition: c }); }}
            />
          )}

          <div className="ll-card p-8">
            <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600 }}>Actions</h3>
            <div className="mt-6 space-y-3">
              {vault.status === "Active" && (
                <AddFundsButton vault={vault} onAdded={(amt) => { const next = { ...vault, amount_cad: vault.amount_cad + amt }; updateVault(vault.id, { amount_cad: next.amount_cad }); setVault(next); }} />
              )}
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


function TrusteesPanel({ vault, onChange }: { vault: Vault; onChange: (b: Beneficiary[]) => void }) {
  const [editing, setEditing] = useState(false);
  const [list, setList] = useState<Beneficiary[]>(vault.beneficiaries);
  const total = list.reduce((a, b) => a + (Number(b.pct) || 0), 0);

  function save() {
    if (total !== 100) { toast.error(`Allocations must total 100% (currently ${total}%)`); return; }
    if (list.some(b => !b.name.trim() || !b.email.trim())) { toast.error("Every trustee needs a name and email"); return; }
    onChange(list);
    setEditing(false);
    toast.success("Trustees updated");
  }

  function update(i: number, patch: Partial<Beneficiary>) {
    setList(list.map((b, idx) => idx === i ? { ...b, ...patch } : b));
  }
  function remove(i: number) { setList(list.filter((_, idx) => idx !== i)); }
  function add() { setList([...list, { name: "", email: "", pct: 0 }]); }

  if (!editing) {
    return (
      <div className="ll-card p-8">
        <div className="flex items-center justify-between gap-3">
          <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600 }}>Trustees</h3>
          <button onClick={() => { setList(vault.beneficiaries); setEditing(true); }} className="ll-pill ll-pill-ghost text-sm">Manage</button>
        </div>
        <div className="mt-6 space-y-4">
          {vault.beneficiaries.map((b) => (
            <div key={b.email} className="flex items-center gap-4">
              <Initials name={b.name} />
              <div className="flex-1 min-w-0">
                <p style={{ color: "var(--forest)", fontWeight: 500 }}>{b.name}</p>
                <p className="text-xs truncate" style={{ color: "var(--warm-gray)" }}>{b.email}</p>
              </div>
              <div className="text-right">
                <p style={{ fontFamily: "var(--font-serif)", color: "var(--honey)", fontSize: 22, fontWeight: 600, lineHeight: 1 }}>{b.pct}%</p>
                <p className="text-xs mt-1" style={{ color: "var(--warm-gray)" }}>{formatCAD(vault.amount_cad * b.pct / 100)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="ll-card p-8">
      <div className="flex items-center justify-between gap-3">
        <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600 }}>Edit trustees</h3>
        <span className="text-xs" style={{ color: total === 100 ? "var(--forest)" : "var(--warm-gray)" }}>Total: {total}%</span>
      </div>
      <div className="mt-6 space-y-4">
        {list.map((b, i) => (
          <div key={i} className="space-y-2 pb-4" style={{ borderBottom: "1px solid rgba(26,46,26,0.08)" }}>
            <div className="grid grid-cols-2 gap-2">
              <input value={b.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Name" className="px-3 py-2 rounded border text-sm" style={{ borderColor: "rgba(26,46,26,0.2)" }} />
              <input value={b.email} onChange={(e) => update(i, { email: e.target.value })} placeholder="Email" className="px-3 py-2 rounded border text-sm" style={{ borderColor: "rgba(26,46,26,0.2)" }} />
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={100} value={b.pct} onChange={(e) => update(i, { pct: Number(e.target.value) })} className="px-3 py-2 rounded border text-sm w-24" style={{ borderColor: "rgba(26,46,26,0.2)" }} />
              <span className="text-xs" style={{ color: "var(--warm-gray)" }}>% allocation</span>
              <button onClick={() => remove(i)} className="ml-auto text-xs" style={{ color: "var(--warm-gray)" }}>Remove</button>
            </div>
          </div>
        ))}
        <button onClick={add} className="ll-pill ll-pill-ghost w-full text-sm">+ Add trustee</button>
      </div>
      <div className="flex gap-2 mt-6">
        <button onClick={() => setEditing(false)} className="ll-pill ll-pill-ghost flex-1">Cancel</button>
        <button onClick={save} className="ll-pill ll-pill-secondary flex-1">Save</button>
      </div>
    </div>
  );
}

type PayMethod = "interac" | "card" | "bank";
type PayStep = "amount" | "method" | "details" | "review" | "processing" | "success";

function AddFundsButton({ vault, onAdded }: { vault: Vault; onAdded: (amt: number) => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<PayStep>("amount");
  const [amt, setAmt] = useState<string>("");
  const [method, setMethod] = useState<PayMethod>("interac");
  const [email, setEmail] = useState("");
  const [card, setCard] = useState({ number: "", exp: "", cvc: "", name: "" });

  function reset() {
    setStep("amount"); setAmt(""); setMethod("interac");
    setEmail(""); setCard({ number: "", exp: "", cvc: "", name: "" });
  }
  function close() { setOpen(false); setTimeout(reset, 300); }

  const n = Number(amt);
  const fee = method === "card" ? Math.round(n * 0.029 * 100) / 100 + 0.30 : 0;
  const total = n + fee;

  function next() {
    if (step === "amount") {
      if (!n || n <= 0) { toast.error("Enter an amount greater than $0"); return; }
      setStep("method");
    } else if (step === "method") {
      setStep("details");
    } else if (step === "details") {
      if (method === "interac" && !email.trim()) { toast.error("Enter the email to send from"); return; }
      if (method === "card") {
        if (card.number.replace(/\s/g, "").length < 12) { toast.error("Enter a valid card number"); return; }
        if (!card.exp.match(/^\d{2}\/\d{2}$/)) { toast.error("Expiry must be MM/YY"); return; }
        if (card.cvc.length < 3) { toast.error("Enter the CVC"); return; }
        if (!card.name.trim()) { toast.error("Enter the cardholder name"); return; }
      }
      setStep("review");
    } else if (step === "review") {
      setStep("processing");
      setTimeout(() => {
        setStep("success");
        onAdded(n);
      }, 1800);
    }
  }

  function back() {
    if (step === "method") setStep("amount");
    else if (step === "details") setStep("method");
    else if (step === "review") setStep("details");
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="ll-pill ll-pill-sage w-full">+ Add Funds</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(26,46,26,0.5)" }}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="ll-card p-8 max-w-md w-full">
            {step !== "success" && step !== "processing" && (
              <>
                <p className="text-xs uppercase tracking-wider" style={{ color: "var(--warm-gray)" }}>
                  Add funds · Step {step === "amount" ? 1 : step === "method" ? 2 : step === "details" ? 3 : 4} of 4
                </p>
                <h3 className="mt-1" style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 600 }}>
                  {step === "amount" && "How much?"}
                  {step === "method" && "Payment method"}
                  {step === "details" && (method === "interac" ? "Interac e-Transfer" : method === "card" ? "Card details" : "Bank transfer")}
                  {step === "review" && "Review & confirm"}
                </h3>
              </>
            )}

            {step === "amount" && (
              <div className="mt-6">
                <label className="text-xs uppercase tracking-wider" style={{ color: "var(--warm-gray)" }}>Amount (CAD)</label>
                <input type="number" min={1} value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="e.g. 500" autoFocus
                  className="mt-2 w-full px-4 py-3 rounded border text-lg"
                  style={{ borderColor: "rgba(26,46,26,0.2)", fontFamily: "var(--font-serif)" }} />
                <p className="text-xs mt-2" style={{ color: "var(--warm-gray)" }}>Topping up <strong>{vault.name}</strong>. Funds can only be added once active.</p>
              </div>
            )}

            {step === "method" && (
              <div className="mt-6 space-y-2">
                {([
                  { id: "interac", label: "Interac e-Transfer", desc: "Free · 1–2 min" },
                  { id: "card", label: "Credit / Debit card", desc: "2.9% + $0.30 · Instant" },
                  { id: "bank", label: "Bank transfer (EFT)", desc: "Free · 1–3 business days" },
                ] as const).map(opt => (
                  <button key={opt.id} onClick={() => setMethod(opt.id)}
                    className="w-full text-left p-4 rounded border flex items-center gap-3"
                    style={{ borderColor: method === opt.id ? "var(--honey)" : "rgba(26,46,26,0.15)", background: method === opt.id ? "rgba(218,165,32,0.06)" : "transparent" }}>
                    <span className="w-4 h-4 rounded-full border-2 flex-shrink-0" style={{ borderColor: "var(--honey)", background: method === opt.id ? "var(--honey)" : "transparent" }} />
                    <div className="flex-1">
                      <p style={{ color: "var(--forest)", fontWeight: 500 }}>{opt.label}</p>
                      <p className="text-xs" style={{ color: "var(--warm-gray)" }}>{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {step === "details" && method === "interac" && (
              <div className="mt-6">
                <label className="text-xs uppercase tracking-wider" style={{ color: "var(--warm-gray)" }}>Send from email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoFocus
                  className="mt-2 w-full px-4 py-3 rounded border" style={{ borderColor: "rgba(26,46,26,0.2)" }} />
                <p className="text-xs mt-3" style={{ color: "var(--warm-gray)" }}>We'll send a request for {formatCAD(n)} to your bank's Interac.</p>
              </div>
            )}

            {step === "details" && method === "card" && (
              <div className="mt-6 space-y-3">
                <div>
                  <label className="text-xs uppercase tracking-wider" style={{ color: "var(--warm-gray)" }}>Card number</label>
                  <input value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} placeholder="1234 5678 9012 3456" autoFocus
                    className="mt-1 w-full px-4 py-3 rounded border" style={{ borderColor: "rgba(26,46,26,0.2)" }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs uppercase tracking-wider" style={{ color: "var(--warm-gray)" }}>Expiry</label>
                    <input value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} placeholder="MM/YY"
                      className="mt-1 w-full px-4 py-3 rounded border" style={{ borderColor: "rgba(26,46,26,0.2)" }} />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider" style={{ color: "var(--warm-gray)" }}>CVC</label>
                    <input value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} placeholder="123"
                      className="mt-1 w-full px-4 py-3 rounded border" style={{ borderColor: "rgba(26,46,26,0.2)" }} />
                  </div>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider" style={{ color: "var(--warm-gray)" }}>Cardholder</label>
                  <input value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} placeholder="Name on card"
                    className="mt-1 w-full px-4 py-3 rounded border" style={{ borderColor: "rgba(26,46,26,0.2)" }} />
                </div>
              </div>
            )}

            {step === "details" && method === "bank" && (
              <div className="mt-6 space-y-2 text-sm" style={{ color: "var(--forest)" }}>
                <p style={{ color: "var(--warm-gray)" }}>Send an EFT to:</p>
                <div className="p-4 rounded" style={{ background: "rgba(26,46,26,0.04)" }}>
                  <p><strong>Institution:</strong> 003 (RBC)</p>
                  <p><strong>Transit:</strong> 04821</p>
                  <p><strong>Account:</strong> 1029384756</p>
                  <p><strong>Reference:</strong> {vault.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <p className="text-xs" style={{ color: "var(--warm-gray)" }}>Funds will appear in {vault.name} within 1–3 business days.</p>
              </div>
            )}

            {step === "review" && (
              <div className="mt-6 space-y-3 text-sm">
                <Row label="Vault" value={vault.name} />
                <Row label="Amount" value={formatCAD(n)} />
                <Row label="Method" value={method === "interac" ? "Interac e-Transfer" : method === "card" ? `Card ····${card.number.slice(-4)}` : "Bank EFT"} />
                {fee > 0 && <Row label="Processing fee" value={formatCAD(fee)} />}
                <div className="pt-3" style={{ borderTop: "1px solid rgba(26,46,26,0.1)" }}>
                  <Row label="Total" value={formatCAD(total)} bold />
                </div>
              </div>
            )}

            {step === "processing" && (
              <div className="py-10 text-center">
                <div className="w-12 h-12 mx-auto rounded-full border-4 animate-spin" style={{ borderColor: "rgba(26,46,26,0.1)", borderTopColor: "var(--honey)" }} />
                <p className="mt-6" style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--forest)" }}>Processing payment…</p>
                <p className="text-xs mt-2" style={{ color: "var(--warm-gray)" }}>Securely charging {formatCAD(total)}</p>
              </div>
            )}

            {step === "success" && (
              <div className="py-8 text-center">
                <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl" style={{ background: "var(--sage)", color: "var(--forest)" }}>✓</div>
                <h3 className="mt-5" style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 600 }}>Payment successful</h3>
                <p className="mt-2 text-sm" style={{ color: "var(--warm-gray)" }}>{formatCAD(n)} added to {vault.name}.</p>
                <button onClick={close} className="ll-pill ll-pill-secondary mt-6">Done</button>
              </div>
            )}

            {step !== "processing" && step !== "success" && (
              <div className="flex justify-between gap-3 mt-8">
                <button onClick={step === "amount" ? close : back} className="ll-pill ll-pill-ghost">
                  {step === "amount" ? "Cancel" : "Back"}
                </button>
                <button onClick={next} className="ll-pill ll-pill-secondary">
                  {step === "review" ? `Pay ${formatCAD(total)}` : "Continue"}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </>
  );
}

function ConditionPanel({ vault, onChange }: { vault: Vault; onChange: (c: VaultCondition) => void }) {
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<VaultCondition["kind"]>(vault.condition.kind);
  const [unlockDate, setUnlockDate] = useState<string>(
    vault.condition.kind === "time" ? vault.condition.unlock_date : new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10)
  );
  const [days, setDays] = useState<number>(
    vault.condition.kind === "inactivity" ? vault.condition.inactivity_days : 180
  );
  const [authOpen, setAuthOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [pendingNext, setPendingNext] = useState<VaultCondition | null>(null);

  function open() {
    setKind(vault.condition.kind);
    if (vault.condition.kind === "time") setUnlockDate(vault.condition.unlock_date);
    if (vault.condition.kind === "inactivity") setDays(vault.condition.inactivity_days);
    setEditing(true);
  }

  function requestSave() {
    let next: VaultCondition;
    if (kind === "time") {
      const target = parseISO(unlockDate);
      if (differenceInDays(target, new Date()) < 1) {
        toast.error("Unlock date must be at least 1 day in the future");
        return;
      }
      next = { kind: "time", unlock_date: unlockDate };
    } else if (kind === "inactivity") {
      if (!days || days < 7 || days > 3650) {
        toast.error("Inactivity window must be between 7 and 3650 days");
        return;
      }
      const lastCheckin = vault.condition.kind === "inactivity" ? vault.condition.last_checkin : new Date().toISOString().slice(0, 10);
      const elapsed = Math.max(0, differenceInDays(new Date(), parseISO(lastCheckin)));
      if (days <= elapsed) {
        toast.error(`That window is shorter than the ${elapsed} days since your last check-in`);
        return;
      }
      next = { kind: "inactivity", inactivity_days: days, last_checkin: lastCheckin };
    } else {
      next = { kind: "manual" };
    }
    setPendingNext(next);
    setPwd("");
    setAuthOpen(true);
  }

  function confirmAuth() {
    if (pwd.trim().length < 4) { toast.error("Enter your account password to confirm"); return; }
    if (!pendingNext) return;
    setVerifying(true);
    setTimeout(() => {
      onChange(pendingNext);
      setVerifying(false);
      setAuthOpen(false);
      setPendingNext(null);
      setPwd("");
      setEditing(false);
      toast.success("Identity verified — release conditions updated");
    }, 900);
  }

  const cond = vault.condition;

  if (!editing) {
    return (
      <div className="ll-card p-8">
        <div className="flex items-center justify-between gap-3">
          <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600 }}>Release conditions</h3>
          <button onClick={open} className="ll-pill ll-pill-ghost text-sm">Change</button>
        </div>
        <div className="mt-6 space-y-2 text-sm">
          <p style={{ color: "var(--forest)", fontWeight: 500 }}>
            {cond.kind === "time" && "Time-locked"}
            {cond.kind === "inactivity" && "Inactivity check-in"}
            {cond.kind === "manual" && "Manual release"}
          </p>
          <p style={{ color: "var(--warm-gray)" }}>
            {cond.kind === "time" && `Unlocks ${format(parseISO(cond.unlock_date), "MMMM d, yyyy")}`}
            {cond.kind === "inactivity" && `Releases after ${cond.inactivity_days} days of silence`}
            {cond.kind === "manual" && "Released only when you say so"}
          </p>
        </div>
      </div>
    );
  }

  const tabs: Array<{ k: VaultCondition["kind"]; label: string }> = [
    { k: "time", label: "Time" },
    { k: "inactivity", label: "Inactivity" },
    { k: "manual", label: "Manual" },
  ];

  return (
    <div className="ll-card p-8">
      <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600 }}>Edit release</h3>
      <div className="mt-5 flex gap-2">
        {tabs.map(t => (
          <button
            key={t.k}
            onClick={() => setKind(t.k)}
            className="px-3 py-1.5 rounded-full text-xs font-medium flex-1"
            style={{
              background: kind === t.k ? "var(--forest)" : "transparent",
              color: kind === t.k ? "var(--cream)" : "var(--forest)",
              border: "1px solid var(--forest)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {kind === "time" && (
          <div>
            <label className="text-xs uppercase tracking-wider" style={{ color: "var(--warm-gray)" }}>Unlock date</label>
            <input
              type="date"
              value={unlockDate}
              min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
              onChange={(e) => setUnlockDate(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded border text-sm"
              style={{ borderColor: "rgba(26,46,26,0.2)" }}
            />
          </div>
        )}
        {kind === "inactivity" && (
          <div>
            <label className="text-xs uppercase tracking-wider" style={{ color: "var(--warm-gray)" }}>Days of silence before release</label>
            <input
              type="number" min={7} max={3650}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="mt-1 w-full px-3 py-2 rounded border text-sm"
              style={{ borderColor: "rgba(26,46,26,0.2)" }}
            />
            {vault.condition.kind === "inactivity" && (
              <p className="mt-2 text-xs" style={{ color: "var(--warm-gray)" }}>
                Last check-in: {format(parseISO(vault.condition.last_checkin), "MMMM d, yyyy")}
              </p>
            )}
          </div>
        )}
        {kind === "manual" && (
          <p className="text-sm" style={{ color: "var(--warm-gray)" }}>The vault waits until you release it manually. No timer, no auto-trigger.</p>
        )}
      </div>

      <div className="flex gap-2 mt-6">
        <button onClick={() => setEditing(false)} className="ll-pill ll-pill-ghost flex-1">Cancel</button>
        <button onClick={save} className="ll-pill ll-pill-secondary flex-1">Save</button>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: "var(--warm-gray)" }}>{label}</span>
      <span style={{ color: "var(--forest)", fontWeight: bold ? 600 : 500, fontFamily: bold ? "var(--font-serif)" : undefined }}>{value}</span>
    </div>
  );
}
