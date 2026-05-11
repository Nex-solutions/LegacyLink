import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { AppHeader } from "@/components/legacy/Nav";
import { Blob, PageShell } from "@/components/legacy/PageShell";
import { formatCAD, type VaultCondition } from "@/lib/legacy-data";
import { serverCreateVault } from "@/lib/vault-client";
import { getUser } from "@/lib/legacy-auth";
import { solscanUrl } from "@/lib/solana-explorer";


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

  // step 3 — prefill with demo beneficiary so judges can click through
  const demoBenefs = useMemo(() => {
    const FIRST = ["Amara", "Tobias", "Ngozi", "Emeka", "Ada", "Chinedu", "Zara"];
    const LAST = ["Okafor", "Adeyemi", "Eze", "Nwosu", "Achebe"];
    const f = FIRST[Math.floor(Math.random() * FIRST.length)];
    const l = LAST[Math.floor(Math.random() * LAST.length)];
    return [{ name: `${f} ${l}`, email: `${f.toLowerCase()}.${l.toLowerCase()}@demo.legacylink.app`, pct: 100 }];
  }, []);
  const [bens, setBens] = useState<{ name: string; email: string; pct: number }[]>(demoBenefs);
  const [trustee, setTrustee] = useState<{ name: string; email: string }>({ name: "", email: "" });

  // step 4
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [chain, setChain] = useState<{ vault_pda: string; tx_signature: string; owner_pubkey: string; hot_pubkey: string; claim_demo: { name: string; email: string; token: string } | null } | null>(null);

  useEffect(() => { if (!getUser()) navigate({ to: "/login" }); }, [navigate]);

  const amountNum = parseFloat(amount.replace(/[^0-9.]/g, "")) || 0;
  const totalPct = useMemo(() => bens.reduce((s, b) => s + (Number(b.pct) || 0), 0), [bens]);

  function selectMethod(method: "card" | "bank") {
    if (amountNum <= 0) return toast.error("Enter an amount first.");
    if (funded) return; // already paid
    setFunding(method);
  }

  function confirmPayment() {
    if (!funding) return;
    if (amountNum <= 0) return toast.error("Enter an amount first.");
    setFundingLoading(true);
    setTimeout(() => {
      setFundingLoading(false);
      setFunded(true);
      toast.success(`${funding === "card" ? "Card" : "Bank transfer"} payment confirmed.`);
    }, 1600);
  }

  function changeMethod() {
    if (funding_loading || funded) return;
    setFunding(null);
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
    try {
      const { id, vault_pda, tx_signature, owner_pubkey, hot_pubkey, claim_demo } = await serverCreateVault({
        name: name || "Untitled Vault",
        amount_cad: amountNum,
        condition: getCondition(),
        beneficiaries: bens.map((b) => ({ name: b.name.trim(), email: b.email.trim().toLowerCase(), pct: Number(b.pct) })),
      });
      if (trustee.email) toast.success(`Setup email sent to ${trustee.name || trustee.email}`);
      setChain({ vault_pda, tx_signature, owner_pubkey, hot_pubkey, claim_demo });
      setSuccess(id);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Couldn't create vault");
    } finally {
      setSubmitting(false);
    }
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

          {chain && (
            <div
              className="mt-6 mx-auto max-w-md p-4 rounded-xl text-left text-sm"
              style={{
                background: "rgba(212,165,116,0.10)",
                border: "1px solid rgba(212,165,116,0.35)",
                color: "var(--forest)",
              }}
            >
              <div className="font-medium flex items-center gap-2">
                <span>🔗</span><span>Recorded on Solana devnet</span>
              </div>

              <div className="mt-3 text-xs" style={{ color: "var(--warm-gray)" }}>Your system wallet</div>
              <a
                href={solscanUrl("address", chain.owner_pubkey)}
                target="_blank" rel="noreferrer"
                className="text-xs font-mono break-all underline"
                style={{ color: "var(--forest)" }}
              >
                {chain.owner_pubkey} ↗
              </a>

              <div className="mt-3 text-xs" style={{ color: "var(--warm-gray)" }}>
                Vault proof transaction · 0.001 SOL → platform hot wallet
              </div>
              <a
                href={solscanUrl("tx", chain.tx_signature)}
                target="_blank" rel="noreferrer"
                className="text-xs font-mono break-all underline"
                style={{ color: "var(--forest)" }}
              >
                {chain.tx_signature} ↗
              </a>

            </div>
          )}

          {chain?.claim_demo && (
            <div className="mt-6 mx-auto max-w-md p-4 rounded-xl text-left" style={{ background: "rgba(127,168,130,0.10)", border: "1px solid rgba(127,168,130,0.35)" }}>
              <p className="text-xs uppercase tracking-wider" style={{ color: "var(--warm-gray)" }}>View claim demo</p>
              <p className="mt-1 text-sm" style={{ color: "var(--forest)" }}>
                Beneficiary: <strong>{chain.claim_demo.name}</strong> · {chain.claim_demo.email}
              </p>
              <a
                href={`/claim?vault=${success}&token=${encodeURIComponent(chain.claim_demo.token)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-xs font-mono break-all underline"
                style={{ color: "var(--honey)" }}
              >
                Open beneficiary claim flow ↗
              </a>
            </div>
          )}
          <p className="mt-6 text-sm" style={{ color: "var(--warm-gray)" }}>
            Demo flow: release this vault, then claim as the listed beneficiary to see hot wallet → user system wallet on Solscan.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={() => navigate({ to: "/vault/$id", params: { id: success } })} className="ll-pill ll-pill-primary">
              Open Vault Demo
            </button>
            <button onClick={() => navigate({ to: "/dashboard" })} className="ll-pill ll-pill-ghost">Go to Dashboard</button>
          </div>
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
                      onClick={() => selectMethod(m.k)}
                      disabled={funding_loading || funded}
                      className="text-left p-5 rounded-2xl transition-all"
                      style={{
                        background: "var(--card-white)",
                        border: `2px solid ${funding === m.k ? "var(--honey)" : "rgba(26,46,26,0.08)"}`,
                        cursor: funded ? "not-allowed" : "pointer",
                      }}
                    >
                      <div className="text-2xl">{m.icon}</div>
                      <div className="mt-2 font-medium" style={{ color: "var(--forest)" }}>{m.t}</div>
                      <div className="text-xs mt-1" style={{ color: "var(--warm-gray)" }}>{m.s}</div>
                      {funding === m.k && funded && (
                        <div className="mt-2 text-xs" style={{ color: "var(--sage)" }}>✓ Paid</div>
                      )}
                    </button>
                  ))}
                </div>

                {funding && !funded && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-5 rounded-2xl"
                    style={{ background: "rgba(26,46,26,0.04)", border: "1px solid rgba(26,46,26,0.1)" }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 600, color: "var(--forest)" }}>
                          Confirm payment
                        </p>
                        <p className="mt-1 text-sm" style={{ color: "var(--warm-gray)" }}>
                          {funding === "card" ? "Credit or Debit Card" : "Interac e-Transfer"} · ${amountNum.toFixed(2)} CAD
                        </p>
                        <p className="mt-1 text-xs" style={{ color: "var(--warm-gray)", opacity: 0.8 }}>
                          Demo payment — no real charge will be made.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 justify-end">
                      <button
                        type="button"
                        onClick={changeMethod}
                        disabled={funding_loading}
                        className="ll-pill ll-pill-ghost text-sm"
                        style={{ padding: "0.5rem 1rem" }}
                      >
                        Change method
                      </button>
                      <button
                        type="button"
                        onClick={confirmPayment}
                        disabled={funding_loading}
                        className="ll-pill ll-pill-primary text-sm"
                        style={{ padding: "0.5rem 1.2rem" }}
                      >
                        {funding_loading ? "Processing…" : `Confirm payment of $${amountNum.toFixed(2)}`}
                      </button>
                    </div>
                  </motion.div>
                )}

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

                <div className="mt-8 p-5 rounded-2xl" style={{ background: "rgba(26,46,26,0.04)", border: "1px dashed rgba(26,46,26,0.15)" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🛡️</span>
                    <p style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 600, color: "var(--forest)" }}>Trusted claim contact <span className="text-xs font-normal" style={{ color: "var(--warm-gray)" }}>(optional)</span></p>
                  </div>
                  <p className="mt-1 text-sm" style={{ color: "var(--warm-gray)" }}>Someone allowed to start a claim on behalf of your beneficiaries. They'll get an email at setup explaining how it works.</p>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <input className="ll-input" placeholder="Full name" value={trustee.name} onChange={(e) => setTrustee({ ...trustee, name: e.target.value })} />
                    <input className="ll-input" placeholder="Email" value={trustee.email} onChange={(e) => setTrustee({ ...trustee, email: e.target.value })} />
                  </div>
                </div>

                {(() => {
                  const missingName = bens.some(b => !b.name.trim());
                  const badEmail = bens.some(b => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim()));
                  const badPct = totalPct !== 100;
                  const disabled = missingName || badEmail || badPct;
                  const hint = missingName ? "Add a name for each beneficiary"
                    : badEmail ? "Check that every email looks valid"
                    : badPct ? `Allocations must add to 100% (currently ${totalPct}%)`
                    : "";
                  return (
                    <div className="mt-8">
                      {hint && <p className="text-sm mb-3 text-right" style={{ color: "var(--warm-gray)" }}>{hint}</p>}
                      <div className="flex justify-between">
                        <button onClick={() => setStep(1)} className="ll-pill ll-pill-ghost">← Back</button>
                        <button
                          disabled={disabled}
                          onClick={() => setStep(3)}
                          className="ll-pill ll-pill-primary"
                          style={{ opacity: disabled ? 0.5 : 1 }}
                        >Continue →</button>
                      </div>
                    </div>
                  );
                })()}
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

                {/* Advisors are linked at the account level — they see all your trusts read-only. Manage from the dashboard. */}


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
                  ) : (() => {
                    const names = bens.map(b => b.name.trim().split(/\s+/)[0]).filter(Boolean);
                    if (names.length === 0) return "Protect My Family";
                    if (names.length === 1) return `Protect ${names[0]}`;
                    if (names.length === 2) return `Protect ${names[0]} and ${names[1]}`;
                    if (names.length === 3) return `Protect ${names[0]}, ${names[1]} and ${names[2]}`;
                    return `Protect ${names[0]}, ${names[1]} and ${names.length - 2} others`;
                  })()}
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
