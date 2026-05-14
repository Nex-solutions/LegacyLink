import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Blob, PageShell } from "@/components/legacy/PageShell";
import { findClient, formatCAD } from "@/lib/legacy-data";
import { getAdvisor, type Advisor } from "@/lib/legacy-auth";

export const Route = createFileRoute("/advisor/clients/$clientId/vault/$vaultId")({
  head: () => ({ meta: [{ title: "Vault — LegacyLink Advisor" }] }),
  component: VaultDetail,
});

function VaultDetail() {
  const { clientId, vaultId } = Route.useParams();
  const navigate = useNavigate();
  const [advisor, setAdvisor] = useState<Advisor | null>(null);

  useEffect(() => {
    const a = getAdvisor();
    if (!a) navigate({ to: "/advisor/login" });
    else setAdvisor(a);
  }, [navigate]);

  const client = findClient(clientId);
  const vault = client?.vaultDetail.find((v) => v.id === vaultId);
  if (!advisor) return null;
  if (!client || !vault) {
    return (
      <PageShell>
        <div className="max-w-3xl mx-auto p-12 text-center">
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 28, color: "var(--forest)" }}>
            Vault not found
          </h1>
          <Link to="/advisor/dashboard" className="ll-pill ll-pill-secondary mt-6 inline-block">
            ← Back to dashboard
          </Link>
        </div>
      </PageShell>
    );
  }

  const cond = vault.condition;
  let countdown: string | null = null;
  let progress: number | null = null;
  if (cond.kind === "time") {
    const days = Math.ceil((new Date(cond.unlock_date).getTime() - Date.now()) / 86400000);
    countdown =
      days > 0 ? `Releases in ${days} day${days === 1 ? "" : "s"}` : "Release date passed";
  } else if (cond.kind === "inactivity") {
    const elapsed = Math.max(
      0,
      Math.floor((Date.now() - new Date(cond.last_checkin).getTime()) / 86400000),
    );
    progress = Math.min(100, (elapsed / cond.inactivity_days) * 100);
    const remain = Math.max(0, cond.inactivity_days - elapsed);
    countdown = `${elapsed}/${cond.inactivity_days} days · ${remain} remaining`;
  }

  // Synthetic event timeline derived from vault state.
  const events = [
    {
      kind: "fund",
      title: "Vault funded",
      detail: formatCAD(vault.amount_cad),
      when: client.since,
    },
    ...(cond.kind === "inactivity"
      ? [
          {
            kind: "checkin",
            title: "Last check-in",
            detail: "Owner checked in",
            when: cond.last_checkin,
          },
        ]
      : []),
    ...(vault.status === "Released"
      ? [
          {
            kind: "release",
            title: "Vault released",
            detail: "Beneficiaries notified",
            when: "Recently",
          },
        ]
      : []),
  ];

  return (
    <PageShell>
      <header className="sticky top-0 z-30" style={{ background: "var(--forest)" }}>
        <div className="px-6 lg:px-12 py-4 flex items-center justify-between">
          <Link
            to="/advisor/clients/$clientId"
            params={{ clientId }}
            className="text-sm"
            style={{ color: "var(--cream)" }}
          >
            ← Back to {client.name}
          </Link>
          <span
            className="text-[11px] uppercase tracking-[0.18em]"
            style={{ color: "rgba(250,250,247,0.55)" }}
          >
            Read-only · Advisor view
          </span>
        </div>
      </header>

      <section className="relative overflow-hidden" style={{ background: "var(--forest)" }}>
        <Blob
          className="w-[420px] h-[420px] -top-24 -right-24"
          color="var(--honey)"
          opacity={0.12}
        />
        <div className="relative z-10 max-w-5xl mx-auto px-6 lg:px-12 pt-8 pb-10">
          <p
            className="text-xs uppercase tracking-widest"
            style={{ color: "rgba(250,250,247,0.55)" }}
          >
            {client.name}'s vault
          </p>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 36,
              color: "var(--cream)",
              fontWeight: 600,
              marginTop: 6,
            }}
          >
            {vault.name}
          </h1>
          <p
            className="mt-3"
            style={{
              fontFamily: "var(--font-serif)",
              color: "var(--honey)",
              fontSize: 36,
              fontWeight: 600,
            }}
          >
            {formatCAD(vault.amount_cad)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className="text-[11px] px-2.5 py-1 rounded-full"
              style={{ background: "var(--sage)", color: "var(--forest)" }}
            >
              {vault.status}
            </span>
            <span
              className="text-[11px] px-2.5 py-1 rounded-full"
              style={{ background: "rgba(250,250,247,0.1)", color: "var(--cream)" }}
            >
              {cond.kind === "time"
                ? "📅 Time-based"
                : cond.kind === "inactivity"
                  ? "💤 Inactivity"
                  : "🔑 Manual"}
            </span>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 lg:px-12 py-10 grid lg:grid-cols-[1.4fr_1fr] gap-8">
        {/* LEFT */}
        <div className="space-y-6">
          {/* Condition */}
          <div className="ll-card p-6">
            <h3
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 18,
                fontWeight: 600,
                color: "var(--forest)",
              }}
            >
              Release condition
            </h3>
            {cond.kind === "time" && (
              <p className="mt-3 text-sm" style={{ color: "var(--warm-gray)" }}>
                Vault releases on{" "}
                <strong style={{ color: "var(--forest)" }}>
                  {new Date(cond.unlock_date).toLocaleDateString("en-CA", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </strong>
                .
              </p>
            )}
            {cond.kind === "inactivity" && (
              <>
                <p className="mt-3 text-sm" style={{ color: "var(--warm-gray)" }}>
                  Vault releases after{" "}
                  <strong style={{ color: "var(--forest)" }}>
                    {cond.inactivity_days} consecutive days
                  </strong>{" "}
                  without an owner check-in.
                </p>
                <div
                  className="mt-4 h-2 rounded-full overflow-hidden"
                  style={{ background: "rgba(26,46,26,0.08)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${progress}%`, background: "var(--honey)" }}
                  />
                </div>
              </>
            )}
            {cond.kind === "manual" && (
              <p className="mt-3 text-sm" style={{ color: "var(--warm-gray)" }}>
                Released only when the owner manually triggers it.
              </p>
            )}
            {countdown && (
              <p className="mt-3 text-sm font-medium" style={{ color: "var(--honey)" }}>
                {countdown}
              </p>
            )}
          </div>

          {/* Beneficiaries */}
          <div className="ll-card p-6">
            <h3
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 18,
                fontWeight: 600,
                color: "var(--forest)",
              }}
            >
              Beneficiaries
            </h3>
            <div className="mt-4 space-y-2">
              {vault.beneficiaries.map((b, i) => {
                const split = vault.beneficiaries.length || 1;
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-xl"
                    style={{ background: "rgba(26,46,26,0.04)" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold"
                        style={{ background: "var(--sage)", color: "var(--forest)" }}
                      >
                        {b.name
                          .split(" ")
                          .map((s) => s[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <span className="text-sm" style={{ color: "var(--forest)" }}>
                        {b.name}
                      </span>
                    </div>
                    <span className="text-sm font-semibold" style={{ color: "var(--honey)" }}>
                      {formatCAD(vault.amount_cad / split)}
                    </span>
                  </div>
                );
              })}
              {vault.beneficiaries.length === 0 && (
                <p className="text-sm" style={{ color: "var(--warm-gray)" }}>
                  No beneficiaries on file.
                </p>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="ll-card p-6">
            <h3
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 18,
                fontWeight: 600,
                color: "var(--forest)",
              }}
            >
              Audit trail
            </h3>
            <div className="mt-4 space-y-4">
              {events.map((e, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span
                    className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: "var(--honey)" }}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: "var(--forest)" }}>
                      {e.title}
                    </p>
                    <p className="text-[13px]" style={{ color: "var(--warm-gray)" }}>
                      {e.detail}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "rgba(74,74,74,0.55)" }}>
                      {e.when}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <aside className="space-y-4">
          <div className="ll-card p-6">
            <h3
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 16,
                fontWeight: 600,
                color: "var(--forest)",
              }}
            >
              Actions
            </h3>
            <div className="mt-4 space-y-2">
              <button
                onClick={() => window.print()}
                className="w-full text-left px-4 py-2.5 rounded-xl text-sm border"
                style={{ borderColor: "rgba(26,46,26,0.1)", color: "var(--forest)" }}
              >
                📄 Download vault summary
              </button>
              <Link
                to="/advisor/messages"
                className="block w-full text-left px-4 py-2.5 rounded-xl text-sm border"
                style={{ borderColor: "rgba(26,46,26,0.1)", color: "var(--forest)" }}
              >
                ✉ Message {client.name.split(" ")[0]} about this vault
              </Link>
              <button
                onClick={() =>
                  toast("Read-only — ask the client to make changes from their dashboard.")
                }
                className="w-full text-left px-4 py-2.5 rounded-xl text-sm border"
                style={{ borderColor: "rgba(26,46,26,0.1)", color: "var(--warm-gray)" }}
              >
                🔒 Edit vault (client-only)
              </button>
            </div>
          </div>

          <div className="ll-card p-6">
            <h3
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 16,
                fontWeight: 600,
                color: "var(--forest)",
              }}
            >
              On-chain references
            </h3>
            <p className="text-[11px] mt-1" style={{ color: "var(--warm-gray)" }}>
              Vault PDA and init transaction will appear here once funded on Solana.
            </p>
            <div
              className="mt-3 space-y-2 text-[12px] font-mono"
              style={{ color: "var(--warm-gray)" }}
            >
              <div>
                Vault PDA: <span style={{ color: "var(--forest)" }}>—</span>
              </div>
              <div>
                Init tx: <span style={{ color: "var(--forest)" }}>—</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
