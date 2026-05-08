import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AppHeader } from "@/components/legacy/Nav";
import { Blob, PageShell } from "@/components/legacy/PageShell";
import { formatCAD, getVault, type Vault } from "@/lib/legacy-data";
import { evaluateAndHydrate, serverClaimByEmail } from "@/lib/vault-client";
import { conditionSummary } from "@/lib/vault-release";

type Search = { vault?: string };

export const Route = createFileRoute("/claim")({
  head: () => ({ meta: [{ title: "Claim a vault — LegacyLink" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    vault: typeof s.vault === "string" ? s.vault : undefined,
  }),
  component: Claim,
});

type Step = "lookup" | "found" | "claimed" | "notyet" | "notlisted" | "missing";

function Claim() {
  const { vault: prefill } = useSearch({ from: "/claim" });
  const [vaultId, setVaultId] = useState(prefill ?? "");
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<Step>("lookup");
  const [vault, setVaultState] = useState<Vault | null>(null);

  const myShare = useMemo(() => {
    if (!vault) return null;
    const me = vault.beneficiaries.find(b => b.email.toLowerCase() === email.toLowerCase());
    if (!me) return null;
    return { ...me, payout: vault.amount_cad * me.pct / 100 };
  }, [vault, email]);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    const id = vaultId.trim();
    const em = email.trim().toLowerCase();
    if (!id || !em) return toast.error("Vault ID and your email are both required.");
    try {
      await evaluateAndHydrate();
    } catch (err) { console.error(err); }
    const v = getVault(id);
    if (!v) { setStep("missing"); return; }
    setVaultState(v);
    const onList = v.beneficiaries.some(b => b.email.toLowerCase() === em);
    if (!onList) { setStep("notlisted"); return; }
    if (v.status !== "Released") { setStep("notyet"); return; }
    setStep("found");
  }

  async function confirmClaim() {
    if (!vault || !myShare) return;
    try {
      const res = await serverClaimByEmail(vault.id, email);
      setStep("claimed");
      toast.success(`${formatCAD(res.amount_cad)} on its way to ${email} via Interac e-Transfer.`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Claim failed");
    }
  }

  function reset() {
    setStep("lookup");
    setVaultState(null);
    setVaultId("");
    setEmail("");
  }

  return (
    <PageShell>
      <AppHeader />
      <div className="relative px-6 py-16 max-w-2xl mx-auto">
        <Blob className="w-[420px] h-[420px] -top-20 -right-20" color="var(--honey)" opacity={0.08} />
        <div className="relative z-10">
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--honey)" }}>For beneficiaries</p>
          <h1 className="mt-3" style={{ fontFamily: "var(--font-serif)", fontSize: 44, fontWeight: 600, lineHeight: 1.05 }}>
            Claim what's yours.
          </h1>
          <p className="mt-3" style={{ color: "var(--warm-gray)" }}>
            If a loved one set aside funds for you, look them up here. Once the vault has met its release condition, your share is paid out instantly.
          </p>

          {step === "lookup" && (
            <form onSubmit={lookup} className="ll-card p-8 mt-10 space-y-5">
              <div>
                <label className="ll-label">Vault ID</label>
                <input className="ll-input" value={vaultId} onChange={(e) => setVaultId(e.target.value)} placeholder="vault-XXXXXX" />
                <p className="text-xs mt-1" style={{ color: "var(--warm-gray)" }}>Sent to you by the vault owner or their advisor.</p>
              </div>
              <div>
                <label className="ll-label">Your email</label>
                <input className="ll-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
                <p className="text-xs mt-1" style={{ color: "var(--warm-gray)" }}>Must match the email on the beneficiary list.</p>
              </div>
              <button type="submit" className="ll-pill ll-pill-primary w-full">Look up vault</button>
            </form>
          )}

          {step === "found" && vault && myShare && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ll-card p-8 mt-10">
              <p className="text-xs uppercase tracking-wider" style={{ color: "var(--honey)" }}>Released · ready to claim</p>
              <h2 className="mt-2" style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 600 }}>{vault.name}</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--warm-gray)" }}>{conditionSummary(vault)}</p>

              <div className="mt-6 p-5 rounded-xl" style={{ background: "rgba(218,165,32,0.08)", border: "1px solid rgba(218,165,32,0.25)" }}>
                <p className="text-xs uppercase tracking-wider" style={{ color: "var(--warm-gray)" }}>Your share</p>
                <p style={{ fontFamily: "var(--font-serif)", color: "var(--honey)", fontSize: 44, fontWeight: 600, lineHeight: 1.1 }}>{formatCAD(myShare.payout)}</p>
                <p className="text-sm mt-1" style={{ color: "var(--forest)" }}>{myShare.pct}% allocated to {myShare.name}</p>
              </div>

              <p className="mt-5 text-xs" style={{ color: "var(--warm-gray)" }}>Funds are paid via Interac e-Transfer to {email}. You'll get a confirmation email shortly after.</p>
              <button onClick={confirmClaim} className="ll-pill ll-pill-secondary w-full mt-5">Confirm & receive funds</button>
            </motion.div>
          )}

          {step === "claimed" && vault && myShare && (
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="ll-card p-10 mt-10 text-center">
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl" style={{ background: "var(--sage)", color: "var(--forest)" }}>✓</div>
              <h2 className="mt-5" style={{ fontFamily: "var(--font-serif)", fontSize: 30, fontWeight: 600 }}>Claim complete.</h2>
              <p className="mt-3" style={{ color: "var(--warm-gray)" }}>
                {formatCAD(myShare.payout)} from <strong>{vault.name}</strong> is on its way to {email} via Interac e-Transfer.
              </p>
              <p className="mt-2 text-sm" style={{ color: "var(--warm-gray)" }}>This claim has been logged in the vault's audit trail.</p>
              <Link to="/" className="ll-pill ll-pill-ghost mt-7 inline-block">Back home</Link>
            </motion.div>
          )}

          {step === "notyet" && vault && (
            <div className="ll-card p-8 mt-10">
              <p className="text-xs uppercase tracking-wider" style={{ color: "var(--warm-gray)" }}>Vault not yet released</p>
              <h2 className="mt-2" style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 600 }}>{vault.name}</h2>
              <p className="mt-2" style={{ color: "var(--warm-gray)" }}>{conditionSummary(vault)}</p>
              <p className="mt-4 text-sm" style={{ color: "var(--forest)" }}>You're listed as a beneficiary. We'll email you the moment this vault releases — no action needed from you right now.</p>
              <button onClick={reset} className="ll-pill ll-pill-ghost mt-5">Look up another vault</button>
            </div>
          )}

          {step === "notlisted" && (
            <div className="ll-card p-8 mt-10">
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 600 }}>That email isn't on this vault.</h2>
              <p className="mt-3 text-sm" style={{ color: "var(--warm-gray)" }}>
                Double-check the email address with the vault owner — it must match exactly. If you believe this is in error, reach out to a LegacyLink steward.
              </p>
              <button onClick={reset} className="ll-pill ll-pill-ghost mt-5">Try again</button>
            </div>
          )}

          {step === "missing" && (
            <div className="ll-card p-8 mt-10">
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 600 }}>We couldn't find that vault.</h2>
              <p className="mt-3 text-sm" style={{ color: "var(--warm-gray)" }}>Check the vault ID with whoever sent it to you. IDs look like <code>vault-demo-released</code>.</p>
              <button onClick={reset} className="ll-pill ll-pill-ghost mt-5">Try again</button>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
