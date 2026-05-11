import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AppHeader } from "@/components/legacy/Nav";
import { Blob, PageShell } from "@/components/legacy/PageShell";
import { formatCAD, getVault, type Vault } from "@/lib/legacy-data";
import { evaluateAndHydrate, serverClaimByEmail } from "@/lib/vault-client";
import { publicLookupClaim, publicClaimByToken } from "@/lib/vault.functions";
import { conditionSummary } from "@/lib/vault-release";
import { solscanUrl } from "@/lib/solana-explorer";

type Search = { vault?: string; token?: string };

export const Route = createFileRoute("/claim")({
  head: () => ({ meta: [{ title: "Claim a vault — LegacyLink" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    vault: typeof s.vault === "string" ? s.vault : undefined,
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  component: Claim,
});

type Step = "lookup" | "found" | "claimed" | "notyet" | "notlisted" | "missing";
type TokenView = {
  vault: { id: string; name: string; amount_cad: number; status: string };
  beneficiary: { name: string; email: string; pct: number; payout_cad: number; claimed_at: string | null };
} | null;

function Claim() {
  const { vault: prefill, token } = useSearch({ from: "/claim" });

  // Token-based flow (public, no sign-in needed) — judges click PDF link
  const [tokenView, setTokenView] = useState<TokenView>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenClaiming, setTokenClaiming] = useState(false);
  const [tokenClaimed, setTokenClaimed] = useState<{ amount_cad: number; tx_signature: string; email: string } | null>(null);

  useEffect(() => {
    if (!prefill || !token) return;
    publicLookupClaim({ data: { vault_id: prefill, token } })
      .then((res) => setTokenView(res))
      .catch((e) => setTokenError(e instanceof Error ? e.message : "Couldn't load claim"));
  }, [prefill, token]);

  async function tokenClaim() {
    if (!prefill || !token) return;
    setTokenClaiming(true);
    try {
      const res = await publicClaimByToken({ data: { vault_id: prefill, token } });
      setTokenClaimed({ amount_cad: res.amount_cad, tx_signature: res.tx_signature, email: res.email });
      toast.success(`${formatCAD(res.amount_cad)} on its way to ${res.email}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setTokenClaiming(false);
    }
  }

  // Email-lookup flow (legacy, requires sign-in)
  const [vaultId, setVaultId] = useState(prefill ?? "");
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<Step>("lookup");
  const [vault, setVaultState] = useState<Vault | null>(null);
  const [legacyClaimTx, setLegacyClaimTx] = useState<string | null>(null);

  const myShare = useMemo(() => {
    if (!vault) return null;
    const me = vault.beneficiaries.find((b) => b.email.toLowerCase() === email.toLowerCase());
    if (!me) return null;
    return { ...me, payout: vault.amount_cad * me.pct / 100 };
  }, [vault, email]);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    const id = vaultId.trim();
    const em = email.trim().toLowerCase();
    if (!id || !em) return toast.error("Vault ID and your email are both required.");
    try { await evaluateAndHydrate(); } catch (err) { console.error(err); }
    const v = getVault(id);
    if (!v) { setStep("missing"); return; }
    setVaultState(v);
    const onList = v.beneficiaries.some((b) => b.email.toLowerCase() === em);
    if (!onList) { setStep("notlisted"); return; }
    if (v.status !== "Released") { setStep("notyet"); return; }
    setStep("found");
  }

  async function confirmClaim() {
    if (!vault || !myShare) return;
    try {
      const res = await serverClaimByEmail(vault.id, email);
      setLegacyClaimTx(res.tx_signature);
      setStep("claimed");
      toast.success(`${formatCAD(res.amount_cad)} on its way to ${email}`);
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

  // ── Render ────────────────────────────────────────────────────────────

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
            If a loved one set aside funds for you, claim them here. Your share is paid out instantly via Interac e-Transfer.
          </p>

          {/* Token flow */}
          {prefill && token && !tokenError && tokenView && !tokenClaimed && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ll-card p-8 mt-10">
              <p className="text-xs uppercase tracking-wider" style={{ color: "var(--honey)" }}>
                {tokenView.beneficiary.claimed_at ? "Already claimed" : tokenView.vault.status === "Released" ? "Released · ready to claim" : "Awaiting release"}
              </p>
              <h2 className="mt-2" style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 600 }}>{tokenView.vault.name}</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--warm-gray)" }}>For {tokenView.beneficiary.name} · {tokenView.beneficiary.email}</p>

              <div className="mt-6 p-5 rounded-xl" style={{ background: "rgba(218,165,32,0.08)", border: "1px solid rgba(218,165,32,0.25)" }}>
                <p className="text-xs uppercase tracking-wider" style={{ color: "var(--warm-gray)" }}>Your share</p>
                <p style={{ fontFamily: "var(--font-serif)", color: "var(--honey)", fontSize: 44, fontWeight: 600, lineHeight: 1.1 }}>{formatCAD(tokenView.beneficiary.payout_cad)}</p>
                <p className="text-sm mt-1" style={{ color: "var(--forest)" }}>{tokenView.beneficiary.pct}% of {formatCAD(tokenView.vault.amount_cad)}</p>
              </div>

              {tokenView.beneficiary.claimed_at ? (
                <p className="mt-5 text-sm" style={{ color: "var(--warm-gray)" }}>This share was already claimed on {new Date(tokenView.beneficiary.claimed_at).toLocaleDateString()}.</p>
              ) : tokenView.vault.status !== "Released" ? (
                <p className="mt-5 text-sm" style={{ color: "var(--warm-gray)" }}>This vault hasn't released yet. We'll email you the moment it does.</p>
              ) : (
                <>
                  <p className="mt-5 text-xs" style={{ color: "var(--warm-gray)" }}>Funds are paid via Interac e-Transfer to {tokenView.beneficiary.email}.</p>
                  <button onClick={tokenClaim} disabled={tokenClaiming} className="ll-pill ll-pill-primary w-full mt-5" style={{ opacity: tokenClaiming ? 0.6 : 1 }}>
                    {tokenClaiming ? "Processing claim…" : "Confirm & receive funds"}
                  </button>
                </>
              )}
            </motion.div>
          )}

          {prefill && token && tokenClaimed && (
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="ll-card p-10 mt-10 text-center">
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl" style={{ background: "var(--sage)", color: "var(--forest)" }}>✓</div>
              <h2 className="mt-5" style={{ fontFamily: "var(--font-serif)", fontSize: 30, fontWeight: 600 }}>Claim complete.</h2>
              <p className="mt-3" style={{ color: "var(--warm-gray)" }}>
                {formatCAD(tokenClaimed.amount_cad)} is on its way to {tokenClaimed.email} via Interac e-Transfer.
              </p>
              <a
                href={solscanUrl("tx", tokenClaimed.tx_signature)}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-xs font-mono break-all underline"
                style={{ color: "var(--honey)" }}
              >
                View hot wallet → claim wallet payout on Solscan ↗ {tokenClaimed.tx_signature}
              </a>
              <Link to="/" className="ll-pill ll-pill-ghost mt-7 inline-block">Back home</Link>
            </motion.div>
          )}

          {prefill && token && tokenError && (
            <div className="ll-card p-8 mt-10">
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 600 }}>This claim link isn't valid.</h2>
              <p className="mt-3 text-sm" style={{ color: "var(--warm-gray)" }}>{tokenError}</p>
              <Link to="/" className="ll-pill ll-pill-ghost mt-5 inline-block">Back home</Link>
            </div>
          )}

          {prefill && token && !tokenView && !tokenError && (
            <div className="ll-card p-8 mt-10 text-center" style={{ color: "var(--warm-gray)" }}>Loading your claim…</div>
          )}

          {/* Email-lookup flow when no token */}
          {(!prefill || !token) && step === "lookup" && (
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

          {(!prefill || !token) && step === "found" && vault && myShare && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ll-card p-8 mt-10">
              <p className="text-xs uppercase tracking-wider" style={{ color: "var(--honey)" }}>Released · ready to claim</p>
              <h2 className="mt-2" style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 600 }}>{vault.name}</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--warm-gray)" }}>{conditionSummary(vault)}</p>
              <div className="mt-6 p-5 rounded-xl" style={{ background: "rgba(218,165,32,0.08)", border: "1px solid rgba(218,165,32,0.25)" }}>
                <p className="text-xs uppercase tracking-wider" style={{ color: "var(--warm-gray)" }}>Your share</p>
                <p style={{ fontFamily: "var(--font-serif)", color: "var(--honey)", fontSize: 44, fontWeight: 600, lineHeight: 1.1 }}>{formatCAD(myShare.payout)}</p>
                <p className="text-sm mt-1" style={{ color: "var(--forest)" }}>{myShare.pct}% allocated to {myShare.name}</p>
              </div>
              <button onClick={confirmClaim} className="ll-pill ll-pill-secondary w-full mt-5">Confirm & receive funds</button>
            </motion.div>
          )}

          {(!prefill || !token) && step === "claimed" && vault && myShare && (
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="ll-card p-10 mt-10 text-center">
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl" style={{ background: "var(--sage)", color: "var(--forest)" }}>✓</div>
              <h2 className="mt-5" style={{ fontFamily: "var(--font-serif)", fontSize: 30, fontWeight: 600 }}>Claim complete.</h2>
              <p className="mt-3" style={{ color: "var(--warm-gray)" }}>{formatCAD(myShare.payout)} from <strong>{vault.name}</strong> is on its way to {email}.</p>
              {legacyClaimTx && (
                <a
                  href={solscanUrl("tx", legacyClaimTx)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-xs font-mono break-all underline"
                  style={{ color: "var(--honey)" }}
                >
                  View hot wallet → claim wallet payout on Solscan ↗ {legacyClaimTx}
                </a>
              )}
              <Link to="/" className="ll-pill ll-pill-ghost mt-7 inline-block">Back home</Link>
            </motion.div>
          )}

          {(!prefill || !token) && step === "notyet" && vault && (
            <div className="ll-card p-8 mt-10">
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 600 }}>{vault.name}</h2>
              <p className="mt-2" style={{ color: "var(--warm-gray)" }}>{conditionSummary(vault)}</p>
              <p className="mt-4 text-sm" style={{ color: "var(--forest)" }}>You're listed as a beneficiary. We'll email you the moment this vault releases.</p>
              <button onClick={reset} className="ll-pill ll-pill-ghost mt-5">Look up another vault</button>
            </div>
          )}

          {(!prefill || !token) && step === "notlisted" && (
            <div className="ll-card p-8 mt-10">
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 600 }}>That email isn't on this vault.</h2>
              <p className="mt-3 text-sm" style={{ color: "var(--warm-gray)" }}>Double-check with the vault owner — it must match exactly.</p>
              <button onClick={reset} className="ll-pill ll-pill-ghost mt-5">Try again</button>
            </div>
          )}

          {(!prefill || !token) && step === "missing" && (
            <div className="ll-card p-8 mt-10">
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 600 }}>We couldn't find that vault.</h2>
              <p className="mt-3 text-sm" style={{ color: "var(--warm-gray)" }}>Check the vault ID with whoever sent it to you.</p>
              <button onClick={reset} className="ll-pill ll-pill-ghost mt-5">Try again</button>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
