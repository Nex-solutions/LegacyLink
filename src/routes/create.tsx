import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { AppHeader } from "@/components/legacy/Nav";
import { Blob, PageShell } from "@/components/legacy/PageShell";
import { addVault, formatCAD, type Vault, type VaultCondition } from "@/lib/legacy-data";
import { getUser } from "@/lib/legacy-auth";

export const Route = createFileRoute("/create")({
  head: () => ({ meta: [{ title: "Create a Vault — LegacyLink" }] }),
  component: Create,
});

const STEPS = ["Amount", "Condition", "Beneficiaries", "Review"];

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-12">
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={label} className="flex items-center gap-3">
            <div
              className="flex flex-col items-center"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors"
                style={{
                  background: done || active ? "var(--honey)" : "rgba(26,46,26,0.08)",
                  color: done || active ? "var(--forest)" : "var(--warm-gray)",
                }}
              >
                {done ? "✓" : i + 1}
              </div>
              <span className="mt-2 text-xs hidden sm:block" style={{ color: active ? "var(--forest)" : "var(--warm-gray)" }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="w-10 h-px" style={{ background: done ? "var(--honey)" : "rgba(26,46,26,0.15)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Create() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // step 1
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [funding, setFunding] = useState<"card" | "bank" | null>(null);
  const [funded, setFunded] = useState(false);
  const [funding_loading, setFundingLoading] = useState(false);

  // step 2
  const [condKind, setCondKind] = useState<"time" | "inactivity" | "manual" | null>(null);
  const [date, setDate] = useState("");
  const [days, setDays] = useState(180);

  // step 3
  const [bens, setBens] = useState<{ name: string; email: string; pct: number }[]>([
    { name: "", email: "", pct: 100 },
  ]);

  // step 4
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => { if (!getUser()) navigate({ to: "/login" }); }, [navigate]);

  const amountNum = parseFloat(amount.replace(/[^0-9.]/g, "")) || 0;
  const totalPct = useMemo(() => bens.reduce((s, b) => s + (Number(b.pct) || 0), 0), [bens]);

  function fund(method: "card" | "bank") {
    if (amountNum <= 0) return toast.error("Enter an amount first.");
    setFunding(method);
    setFundingLoading(true);
    setTimeout(() => {
      setFundingLoading(false);
      setFunded(true);
      toast.success(`${method === "card" ? "Card" : "Bank transfer"} funding confirmed.`);
    }, 2000);
  }

  function condDescription(): string {
    if (condKind === "time") return `Releases on ${date}`;
    if (condKind === "inactivity") return `Releases if I'm silent for ${days} days`;
    return "Manual release";
  }

  function getCondition(): VaultCondition {
    if (condKind === "time") return { kind: "time", unlock_date: date };
    if (condKind === "inactivity") return { kind: "inactivity", inactivity_days: days, last_checkin: new Date().toISOString().slice(0, 10) };
    return { kind: "manual" };
  }

  async function submit() {
    setSubmitting(true);
    setTimeout(() => {
      const id = "vault-" + Math.random().toString(36).slice(2, 8).toUpperCase();
      const v: Vault = {
        id,
        name: name || "Untitled Vault",
        amount_cad: amountNum,
        status: "Active",
        condition: getCondition(),
        beneficiaries: bens,
        created_at: new Date().toISOString().slice(0, 10),
      };
      addVault(v);
      setSuccess(id);
      setSubmitting(false);
    }, 3000);
  }

  if (success) {
    return (
      <PageShell>
        <AppHeader />
        <div className="max-w-2xl mx-auto px-6 py-24 text-center relative">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 160, damping: 14 }}
            className="w-24 h-24 mx-auto rounded-full flex items-center justify-center"
            style={{ background: "var(--sage)" }}
          >
            <motion.svg viewBox="0 0 60 60" width="56" height="56">
              <motion.path d="M14 32 L26 44 L46 18" fill="none" stroke="var(--forest)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.2 }} />
            </motion.svg>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="mt-8" style={{ fontFamily: "var(--font-serif)", fontSize: 48, fontWeight: 600 }}>
            Your vault is live.
          </motion.h1>
          <p className="mt-4" style={{ color: "var(--warm-gray)" }}>Vault ID</p>
          <p className="mt-1" style={{ fontFamily: "var(--font-serif)", color: "var(--forest)", fontSize: 20, letterSpacing: "0.08em" }}>{success}</p>
          <a href="#" className="block mt-3 text-[10px]" style={{ color: "var(--warm-gray)", opacity: 0.7 }}>View on Solana Explorer</a>
          <button onClick={() => navigate({ to: "/dashboard" })} className="ll-pill ll-pill-primary mt-8">Go to Dashboard</button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <AppHeader />
      <div className="relative px-6 lg:px-12 py-10 max-w-3xl mx-auto">
        <Blob className="w-[520px] h-[520px] -top-40 left-1/2 -translate-x-1/2" color="var(--honey)" opacity={0.07} />
        <div className="relative z-10">
          <h1 className="text-center" style={{ fontFamily: "var(--font-serif)", fontSize: 40, fontWeight: 600 }}>Create a Vault</h1>
          <div className="mt-10"><Stepper step={step} /></div>

          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="s1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="ll-card p-8 lg:p-12">
                <h2 className="text-center" style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 600 }}>How much would you like to protect?</h2>
                <div className="my-10 text-center">
                  <input
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="$0.00"
                    className="w-full text-center bg-transparent outline-none"
                    style={{ fontFamily: "var(--font-serif)", color: "var(--forest)", fontSize: 64, fontWeight: 600 }}
                  />
                  <p className="mt-1 text-sm" style={{ color: "var(--warm-gray)" }}>Canadian Dollars</p>
                </div>

                <p className="ll-label">Funding method</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { k: "card" as const, icon: "💳", t: "Credit or Debit Card", s: "Instant" },
                    { k: "bank" as const, icon: "🏦", t: "Interac e-Transfer", s: "Instant" },
                  ].map((m) => (
                    <button
                      key={m.k}
                      onClick={() => fund(m.k)}
                      disabled={funding_loading}
                      className="text-left p-5 rounded-2xl transition-all"
                      style={{
                        background: "var(--card-white)",
                        border: `2px solid ${funding === m.k ? "var(--honey)" : "rgba(26,46,26,0.08)"}`,
                      }}
                    >
                      <div className="text-2xl">{m.icon}</div>
                      <div className="mt-2 font-medium" style={{ color: "var(--forest)" }}>{m.t}</div>
                      <div className="text-xs mt-1" style={{ color: "var(--warm-gray)" }}>{m.s}</div>
                      {funding === m.k && (
                        <div className="mt-2 text-xs" style={{ color: funded ? "var(--sage)" : "var(--honey)" }}>
                          {funding_loading ? "Processing…" : funded ? "✓ Funded" : ""}
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                <div className="mt-8">
                  <label className="ll-label">Give this vault a name</label>
                  <input className="ll-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kids Education Fund" />
                </div>

                <div className="mt-10 flex justify-end">
                  <button
                    onClick={() => setStep(1)}
                    disabled={!funded || !name}
                    className="ll-pill ll-pill-secondary"
                    style={{ opacity: !funded || !name ? 0.5 : 1 }}
                  >
                    Continue →
                  </button>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="s2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                <h2 className="text-center mb-6" style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 600 }}>When should it release?</h2>

                {[
                  { k: "time" as const, icon: "📅", t: "On a specific date", d: "Choose a date when funds automatically transfer." },
                  { k: "inactivity" as const, icon: "💤", t: "If I go quiet", d: "Release funds if I don't check in for a set period. A safety net for the unexpected." },
                  { k: "manual" as const, icon: "🔑", t: "When I decide", d: "I'll trigger the release manually when the time is right." },
                ].map((c) => (
                  <button
                    key={c.k}
                    onClick={() => setCondKind(c.k)}
                    className="w-full text-left ll-card p-6 transition-all"
                    style={{
                      borderLeft: `4px solid ${condKind === c.k ? "var(--forest)" : "transparent"}`,
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-3xl">{c.icon}</div>
                      <div className="flex-1">
                        <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 600 }}>{c.t}</h3>
                        <p className="mt-1" style={{ color: "var(--warm-gray)" }}>{c.d}</p>
                        {condKind === c.k && c.k === "time" && (
                          <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            min={new Date().toISOString().slice(0, 10)}
                            className="ll-input mt-4"
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        {condKind === c.k && c.k === "inactivity" && (
                          <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="range" min={30} max={730} step={10}
                              value={days} onChange={(e) => setDays(parseInt(e.target.value))}
                              className="w-full"
                              style={{ accentColor: "var(--honey)" }}
                            />
                            <p className="mt-2 text-sm" style={{ color: "var(--forest)" }}>If I don't check in for <strong>{days}</strong> days</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}

                <div className="flex justify-between mt-8">
                  <button onClick={() => setStep(0)} className="ll-pill ll-pill-ghost">← Back</button>
                  <button
                    onClick={() => setStep(2)}
                    disabled={!condKind || (condKind === "time" && !date)}
                    className="ll-pill ll-pill-secondary"
                    style={{ opacity: !condKind || (condKind === "time" && !date) ? 0.5 : 1 }}
                  >
                    Continue →
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="s3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="ll-card p-8">
                <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 600 }}>Add your beneficiaries</h2>
                <p className="mt-2" style={{ color: "var(--warm-gray)" }}>They'll receive Canadian dollars directly via Interac e-Transfer — no setup required on their end.</p>

                <div className="mt-6 space-y-3">
                  {bens.map((b, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input className="ll-input col-span-4" placeholder="First name" value={b.name} onChange={(e) => {
                        const n = [...bens]; n[i].name = e.target.value; setBens(n);
                      }} />
                      <input className="ll-input col-span-5" placeholder="Email" value={b.email} onChange={(e) => {
                        const n = [...bens]; n[i].email = e.target.value; setBens(n);
                      }} />
                      <div className="col-span-2 flex items-center gap-1">
                        <input
                          type="number" min={0} max={100}
                          className="ll-input text-center"
                          value={b.pct}
                          onChange={(e) => {
                            const n = [...bens]; n[i].pct = parseInt(e.target.value || "0"); setBens(n);
                          }}
                        />
                        <span style={{ color: "var(--warm-gray)" }}>%</span>
                      </div>
                      <button
                        onClick={() => setBens(bens.filter((_, j) => j !== i))}
                        className="col-span-1 text-xl"
                        style={{ color: "var(--warm-gray)" }}
                        aria-label="Remove"
                      >×</button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setBens([...bens, { name: "", email: "", pct: 0 }])}
                  className="ll-pill ll-pill-secondary text-sm mt-5"
                  style={{ padding: "0.5rem 1.1rem" }}
                >+ Add Person</button>

                <div className="mt-8">
                  <div className="flex justify-between text-sm mb-2">
                    <span style={{ color: "var(--warm-gray)" }}>{totalPct}% allocated · {Math.max(0, 100 - totalPct)}% remaining</span>
                    {totalPct > 100 && <span style={{ color: "#C0392B" }}>Over 100%</span>}
                  </div>
                  <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: "rgba(26,46,26,0.08)" }}>
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${Math.min(100, totalPct)}%`,
                        background: totalPct === 100 ? "var(--honey)" : totalPct > 100 ? "#C0392B" : "var(--sage)",
                      }}
                    />
                  </div>
                </div>

                <div className="flex justify-between mt-8">
                  <button onClick={() => setStep(1)} className="ll-pill ll-pill-ghost">← Back</button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={totalPct !== 100 || bens.some(b => !b.name || !b.email)}
                    className="ll-pill ll-pill-secondary"
                    style={{ opacity: totalPct !== 100 || bens.some(b => !b.name || !b.email) ? 0.5 : 1 }}
                  >Continue →</button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="s4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="ll-card p-10">
                <h2 className="text-center" style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 600 }}>{name}</h2>
                <p className="text-center mt-3" style={{ fontFamily: "var(--font-serif)", color: "var(--honey)", fontSize: 44, fontWeight: 600 }}>{formatCAD(amountNum)}</p>
                <p className="text-center mt-1" style={{ color: "var(--warm-gray)" }}>{condDescription()}</p>

                <div className="mt-8">
                  <p className="ll-label">Beneficiaries</p>
                  <div className="space-y-2">
                    {bens.map((b, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "rgba(26,46,26,0.04)" }}>
                        <div>
                          <div style={{ color: "var(--forest)", fontWeight: 500 }}>{b.name}</div>
                          <div className="text-xs" style={{ color: "var(--warm-gray)" }}>{b.email}</div>
                        </div>
                        <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ background: "var(--honey)", color: "var(--forest)" }}>{b.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-sm mt-6 text-center" style={{ color: "var(--warm-gray)" }}>Estimated network fee: &lt; $0.50 CAD</p>

                <label className="flex items-start gap-3 mt-6 cursor-pointer">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" style={{ accentColor: "var(--honey)" }} />
                  <span className="text-sm" style={{ color: "var(--warm-gray)" }}>
                    I understand this vault operates on blockchain infrastructure and funds are secured by cryptographic conditions.
                  </span>
                </label>

                <button
                  onClick={submit}
                  disabled={!agree || submitting}
                  className="ll-pill ll-pill-primary w-full mt-6"
                  style={{ opacity: !agree || submitting ? 0.6 : 1 }}
                >
                  {submitting ? (
                    <motion.span initial={{ rotate: 0 }} animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}>
                      🔒 Securing your vault on-chain…
                    </motion.span>
                  ) : "Protect My Family"}
                </button>

                <div className="flex justify-between mt-4">
                  <button onClick={() => setStep(2)} className="ll-pill ll-pill-ghost text-sm" style={{ padding: "0.5rem 1rem" }}>← Back</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageShell>
  );
}
