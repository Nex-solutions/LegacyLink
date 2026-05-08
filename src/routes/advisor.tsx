import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Blob, PageShell } from "@/components/legacy/PageShell";
import { Logo } from "@/components/legacy/Nav";
import { advisorClients, formatCAD, getVaults } from "@/lib/legacy-data";
import { clearAdvisor, getAdvisor } from "@/lib/legacy-auth";

export const Route = createFileRoute("/advisor")({
  head: () => ({ meta: [{ title: "Advisor Portal — LegacyLink" }] }),
  component: AdvisorDashboard,
});

function AdvisorDashboard() {
  const navigate = useNavigate();
  const [open, setOpen] = useState<string | null>(null);
  const [invite, setInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const myVaults = typeof window !== "undefined" ? getVaults() : [];

  useEffect(() => {
    if (!getAdvisor()) navigate({ to: "/advisor/login" });
  }, [navigate]);

  return (
    <PageShell>
      <header className="px-6 lg:px-12 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-sm px-3 py-1 rounded-full" style={{ background: "var(--honey)", color: "var(--forest)" }}>IGWM Advisor Portal</span>
        </div>
        <button onClick={() => { clearAdvisor(); navigate({ to: "/" }); }} className="ll-pill ll-pill-ghost text-sm" style={{ padding: "0.5rem 1rem" }}>Sign out</button>
      </header>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-12 py-10">
        <Blob className="w-[500px] h-[500px] -top-40 -right-32" color="var(--sage)" opacity={0.08} />

        <div className="relative z-10">
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 44, fontWeight: 600 }}>Welcome, Advisor.</h1>
          <p className="mt-2" style={{ color: "var(--warm-gray)" }}>Clients: 3 · Combined AUM: $44,000 CAD · Active Vaults: 6</p>

          <div className="mt-10 flex items-center justify-between">
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 600 }}>Your Clients</h2>
            <button onClick={() => setInvite(true)} className="ll-pill ll-pill-secondary text-sm" style={{ padding: "0.55rem 1.2rem" }}>+ Invite Client</button>
          </div>

          <div className="mt-6 space-y-4">
            {advisorClients.map((c) => {
              const initials = c.name.split(" ").map(s => s[0]).join("").slice(0, 2);
              const isOpen = open === c.id;
              return (
                <motion.div key={c.id} layout className="ll-card overflow-hidden">
                  <button onClick={() => setOpen(isOpen ? null : c.id)} className="w-full p-5 text-left flex items-center gap-5">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center font-semibold" style={{ background: "var(--forest)", color: "var(--cream)" }}>{initials}</div>
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-5 items-center gap-4">
                      <div className="md:col-span-2">
                        <p style={{ color: "var(--forest)", fontWeight: 500 }}>{c.name}</p>
                        <p className="text-xs" style={{ color: "var(--warm-gray)" }}>{c.email}</p>
                      </div>
                      <div className="hidden md:block">
                        <p className="text-xs uppercase tracking-wide" style={{ color: "var(--warm-gray)" }}>Vaults</p>
                        <p style={{ color: "var(--forest)", fontWeight: 600 }}>{c.vaults}</p>
                      </div>
                      <div className="hidden md:block">
                        <p className="text-xs uppercase tracking-wide" style={{ color: "var(--warm-gray)" }}>Total</p>
                        <p style={{ fontFamily: "var(--font-serif)", color: "var(--honey)", fontWeight: 600 }}>{formatCAD(c.total)}</p>
                      </div>
                      <div className="hidden md:flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: "var(--sage)" }} />
                        <span className="text-xs" style={{ color: "var(--warm-gray)" }}>{c.last}</span>
                      </div>
                    </div>
                    <span style={{ color: "var(--honey)" }} className="text-sm whitespace-nowrap">View Portfolio →</span>
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="px-6 pb-6 grid md:grid-cols-2 gap-4 border-t" style={{ borderColor: "rgba(26,46,26,0.08)" }}>
                          {myVaults.slice(0, 2).map((v) => (
                            <div key={v.id} className="p-5 rounded-2xl" style={{ background: "rgba(26,46,26,0.04)" }}>
                              <div className="flex items-center justify-between">
                                <h4 style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 18 }}>{v.name}</h4>
                                <span className="text-xs px-2 py-1 rounded-full" style={{ background: "var(--sage)", color: "var(--forest)" }}>{v.status}</span>
                              </div>
                              <p className="mt-3" style={{ fontFamily: "var(--font-serif)", color: "var(--honey)", fontSize: 24, fontWeight: 600 }}>{formatCAD(v.amount_cad)}</p>
                              <p className="text-xs mt-1" style={{ color: "var(--warm-gray)" }}>{v.beneficiaries.length} beneficiaries</p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {invite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(26,46,26,0.5)" }}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="ll-card p-8 max-w-md w-full">
            <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 600 }}>Invite a client</h3>
            <p className="mt-2" style={{ color: "var(--warm-gray)" }}>They'll receive a secure link to set up their LegacyLink vault.</p>
            <input className="ll-input mt-6" placeholder="client@email.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setInvite(false)} className="ll-pill ll-pill-ghost">Cancel</button>
              <button onClick={() => { setInvite(false); setInviteEmail(""); toast.success("Invitation sent!"); }} className="ll-pill ll-pill-secondary">Send Invitation</button>
            </div>
          </motion.div>
        </div>
      )}
    </PageShell>
  );
}
