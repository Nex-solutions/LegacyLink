import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AppHeader } from "@/components/legacy/Nav";
import { Blob, PageShell } from "@/components/legacy/PageShell";
import { VaultCard } from "@/components/legacy/VaultCard";
import { getUser } from "@/lib/legacy-auth";
import { formatCAD, getVaults, updateVault, type Vault } from "@/lib/legacy-data";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — LegacyLink" }] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUserState] = useState<{ name: string; email: string } | null>(null);
  const [vaults, setVaults] = useState<Vault[]>([]);

  useEffect(() => {
    const u = getUser();
    if (!u) { navigate({ to: "/login" }); return; }
    setUserState(u);
    setVaults(getVaults());
  }, [navigate]);

  function checkIn(id: string) {
    const today = new Date().toISOString().slice(0, 10);
    const v = vaults.find(x => x.id === id);
    if (v && v.condition.kind === "inactivity") {
      const updated: Vault = { ...v, condition: { ...v.condition, last_checkin: today } };
      updateVault(id, updated);
      setVaults(getVaults());
      toast.success("Checked in. Countdown reset.");
    }
  }

  if (!user) return null;
  const total = vaults.reduce((s, v) => s + v.amount_cad, 0);
  const beneficiaries = new Set(vaults.flatMap(v => v.beneficiaries.map(b => b.email))).size;
  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  })();

  return (
    <PageShell>
      <AppHeader />
      <div className="relative px-6 lg:px-12 pt-6 pb-32 max-w-7xl mx-auto">
        <Blob className="w-[480px] h-[480px] -top-20 -right-32" color="var(--sage)" opacity={0.08} />

        <div className="relative z-10">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(32px,5vw,52px)", fontWeight: 600, lineHeight: 1.1 }}>
              {greeting}, {user.name.split(" ")[0]}.
            </h1>
            <p className="mt-2 text-lg" style={{ color: "var(--warm-gray)" }}>Here's the state of your legacy.</p>
            <p className="mt-1 text-sm" style={{ color: "var(--warm-gray)", opacity: 0.7 }}>{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
          </motion.div>

          {/* Summary */}
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { label: "Total Protected", value: formatCAD(total), accent: true },
              { label: "Active Vaults", value: String(vaults.filter(v => v.status === "Active").length) },
              { label: "Beneficiaries", value: `${beneficiaries} people protected` },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="ll-card p-6"
              >
                <p className="text-sm uppercase tracking-wider" style={{ color: "var(--warm-gray)" }}>{s.label}</p>
                <p className="mt-3" style={{ fontFamily: "var(--font-serif)", color: s.accent ? "var(--honey)" : "var(--forest)", fontSize: s.accent ? 36 : 32, fontWeight: 600 }}>
                  {s.value}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Vaults */}
          <div className="mt-12 flex items-center justify-between">
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 600 }}>Your Vaults</h2>
          </div>

          {vaults.length === 0 ? (
            <div className="ll-card p-12 mt-6 text-center">
              <svg viewBox="0 0 200 200" className="w-40 h-40 mx-auto">
                <rect x="40" y="60" width="120" height="110" rx="14" fill="var(--forest)" opacity="0.08" />
                <rect x="40" y="60" width="120" height="110" rx="14" fill="none" stroke="var(--forest)" strokeWidth="2" />
                <circle cx="130" cy="115" r="10" fill="var(--honey)" />
                <path d="M40 60 L100 30 L160 60" fill="var(--sage)" opacity="0.3" />
              </svg>
              <h3 className="mt-4" style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 600 }}>Your legacy starts here.</h3>
              <Link to="/create" className="ll-pill ll-pill-secondary mt-6">Create your first vault</Link>
            </div>
          ) : (
            <div className="mt-6 grid md:grid-cols-2 gap-6">
              {vaults.map((v) => <VaultCard key={v.id} vault={v} onCheckIn={checkIn} />)}
            </div>
          )}
        </div>

        {/* FAB */}
        <Link
          to="/create"
          aria-label="New Vault"
          className="ll-fab-pulse fixed bottom-8 right-8 w-16 h-16 rounded-full flex items-center justify-center z-30 group"
          style={{ background: "var(--forest)", color: "var(--honey)", fontSize: 32, boxShadow: "0 12px 32px rgba(26,46,26,0.25)" }}
        >
          <span style={{ lineHeight: 1, marginTop: -3 }}>+</span>
          <span className="absolute right-20 whitespace-nowrap text-sm px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition" style={{ background: "var(--forest)", color: "var(--cream)" }}>
            New Vault
          </span>
        </Link>
      </div>
    </PageShell>
  );
}
