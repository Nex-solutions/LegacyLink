import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AppHeader } from "@/components/legacy/Nav";
import { Blob, PageShell } from "@/components/legacy/PageShell";

export const Route = createFileRoute("/claim")({
  head: () => ({ meta: [{ title: "Start a Claim — LegacyLink" }] }),
  component: Claim,
});

function Claim() {
  const [vaultId, setVaultId] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!vaultId || !email) return toast.error("Vault ID and your email are required.");
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setDone(true);
      toast.success("Claim filed. The vault owner and beneficiaries have been notified.");
    }, 1800);
  }

  return (
    <PageShell>
      <AppHeader />
      <div className="relative px-6 py-16 max-w-2xl mx-auto">
        <Blob className="w-[420px] h-[420px] -top-20 -right-20" color="var(--honey)" opacity={0.08} />
        <div className="relative z-10">
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--honey)" }}>For beneficiaries & trusted contacts</p>
          <h1 className="mt-3" style={{ fontFamily: "var(--font-serif)", fontSize: 44, fontWeight: 600, lineHeight: 1.05 }}>
            Start a claim.
          </h1>
          <p className="mt-3" style={{ color: "var(--warm-gray)" }}>
            If someone you love has passed or can no longer act, file a claim here. We'll notify the vault and walk you through the rest.
          </p>

          {done ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ll-card p-8 mt-10 text-center">
              <div className="text-4xl">📨</div>
              <h2 className="mt-4" style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 600 }}>Claim received.</h2>
              <p className="mt-2" style={{ color: "var(--warm-gray)" }}>We've sent confirmation to {email}. A LegacyLink steward will reach out within 24 hours.</p>
              <Link to="/" className="ll-pill ll-pill-secondary mt-6 inline-block">Back home</Link>
            </motion.div>
          ) : (
            <form onSubmit={submit} className="ll-card p-8 mt-10 space-y-5">
              <div>
                <label className="ll-label">Vault ID</label>
                <input className="ll-input" value={vaultId} onChange={(e) => setVaultId(e.target.value)} placeholder="vault-XXXXXX" />
              </div>
              <div>
                <label className="ll-label">Your email</label>
                <input className="ll-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
              </div>
              <div>
                <label className="ll-label">Reason for claim</label>
                <textarea className="ll-input" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="A brief description so we can verify quickly." />
              </div>
              <button type="submit" disabled={submitting} className="ll-pill ll-pill-primary w-full" style={{ opacity: submitting ? 0.6 : 1 }}>
                {submitting ? "Filing claim…" : "File claim"}
              </button>
              <p className="text-xs text-center" style={{ color: "var(--warm-gray)" }}>
                False claims are logged and may be escalated. We verify every request.
              </p>
            </form>
          )}
        </div>
      </div>
    </PageShell>
  );
}
