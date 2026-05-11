import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AppHeader } from "@/components/legacy/Nav";
import { Blob, PageShell } from "@/components/legacy/PageShell";
import { VaultCard } from "@/components/legacy/VaultCard";
import { getUser } from "@/lib/legacy-auth";
import { formatCAD, getVaults, type Vault } from "@/lib/legacy-data";
import { addAdvisorLink, getAdvisorLinks, recommendedAdvisors, removeAdvisorLink, type AdvisorLink, type RecommendedAdvisor } from "@/lib/legacy-advisors";
import { evaluateAndHydrate, hydrateVaults, serverCheckIn, serverRetryVault } from "@/lib/vault-client";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — LegacyLink" }] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUserState] = useState<{ name: string; email: string } | null>(null);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [links, setLinks] = useState<AdvisorLink[]>([]);
  const [advisorModal, setAdvisorModal] = useState<null | { mode: "choose" | "invite" | "platform"; preset?: RecommendedAdvisor }>(null);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", firm: "", note: "" });

  useEffect(() => {
    const u = getUser();
    if (!u) { navigate({ to: "/login" }); return; }
    setUserState(u);
    setLinks(getAdvisorLinks());
    // Render cached vaults instantly so the page paints without waiting on the network.
    setVaults(getVaults());
    // Hydrate fresh data, then evaluate releases in the background.
    (async () => {
      try {
        const fresh = await hydrateVaults();
        setVaults(fresh);
      } catch (e) {
        console.error(e);
        toast.error("Couldn't load your vaults");
        return;
      }
      try {
        const { released, vaults: after } = await evaluateAndHydrate();
        setVaults(after);
        if (released.length) {
          toast.success(
            released.length === 1
              ? "A vault just met its release condition and was released to its beneficiaries."
              : `${released.length} vaults just met their release conditions.`
          );
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [navigate]);

  async function handleResetDemo() {
    try {
      await serverResetDemo();
      setVaults(getVaults());
      toast.success("Demo data reset. Four vaults loaded for the live walkthrough.");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't reset demo");
    }
  }

  function handleInviteExternal(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteForm.email || !inviteForm.name) return;
    const link: AdvisorLink = {
      id: `ext-${Date.now()}`,
      source: "external",
      status: "pending",
      name: inviteForm.name,
      email: inviteForm.email,
      firm: inviteForm.firm || undefined,
      invitedAt: new Date().toISOString(),
    };
    addAdvisorLink(link);
    setLinks(getAdvisorLinks());
    setAdvisorModal(null);
    setInviteForm({ name: "", email: "", firm: "", note: "" });
    toast.success(`Invite sent to ${link.email}. They'll be onboarded as your advisor once they accept.`);
  }

  function handleConnectPlatform(a: RecommendedAdvisor) {
    const link: AdvisorLink = {
      id: `plat-${a.id}`,
      source: "platform",
      status: "connected",
      name: a.name,
      email: a.email,
      firm: a.firm,
      city: a.city,
      focus: a.focus,
      invitedAt: new Date().toISOString(),
    };
    addAdvisorLink(link);
    setLinks(getAdvisorLinks());
    setAdvisorModal(null);
    toast.success(`You're now linked with ${a.name}. They have read-only access to your vaults.`);
  }

  function unlink(id: string, name: string) {
    removeAdvisorLink(id);
    setLinks(getAdvisorLinks());
    toast.success(`Disconnected from ${name}.`);
  }


  async function checkIn(id: string) {
    try {
      await serverCheckIn(id);
      setVaults(getVaults());
      toast.success("Checked in. Countdown reset.");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't check in");
    }
  }

  const [retrying, setRetrying] = useState<string | null>(null);
  const [supportFor, setSupportFor] = useState<Vault | null>(null);

  async function retryVault(v: Vault) {
    if ((v.failure_count ?? 0) >= 3) {
      setSupportFor(v);
      return;
    }
    setRetrying(v.id);
    try {
      await serverRetryVault(v.id);
      setVaults(getVaults());
      toast.success(`"${v.name}" is back online.`);
    } catch (e) {
      console.error(e);
      const fresh = getVaults().find(x => x.id === v.id);
      if (fresh && (fresh.failure_count ?? 0) >= 3) {
        setSupportFor(fresh);
      } else {
        toast.error("That attempt failed. Try once more or reach support.");
      }
      setVaults(getVaults());
    } finally {
      setRetrying(null);
    }
  }


  if (!user) return null;
  const unfinished = vaults.filter(v => v.status === "Failed" || v.status === "Draft");
  const completed = vaults.filter(v => v.status !== "Failed" && v.status !== "Draft");
  const total = completed.reduce((s, v) => s + v.amount_cad, 0);
  const beneficiaries = new Set(completed.flatMap(v => v.beneficiaries.map(b => b.email))).size;
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

          {/* Unfinished / failed vaults */}
          {unfinished.length > 0 && (
            <div className="mt-12">
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 600 }}>Continue where you left off</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--warm-gray)" }}>These vaults didn't finish setting up. Pick one up and try again.</p>
              <div className="mt-4 grid md:grid-cols-2 gap-4">
                {unfinished.map((v) => {
                  const fc = v.failure_count ?? 0;
                  const exhausted = fc >= 3;
                  return (
                    <div key={v.id} className="ll-card p-5" style={{ borderColor: "rgba(232,160,32,0.4)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p style={{ fontFamily: "var(--font-serif)", fontWeight: 600, color: "var(--forest)", fontSize: 18 }}>{v.name}</p>
                          <p className="text-xs mt-1" style={{ color: "var(--warm-gray)" }}>
                            {formatCAD(v.amount_cad)} · {v.beneficiaries.length} beneficiar{v.beneficiaries.length === 1 ? "y" : "ies"}
                            {fc > 0 && ` · ${fc} failed attempt${fc === 1 ? "" : "s"}`}
                          </p>
                        </div>
                        <span className="text-[11px] uppercase tracking-wider px-2 py-1 rounded-full" style={{ background: "rgba(232,160,32,0.18)", color: "var(--honey)" }}>
                          {v.status === "Draft" ? "○ Draft" : "● Needs attention"}
                        </span>
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        {exhausted ? (
                          <button onClick={() => setSupportFor(v)} className="ll-pill ll-pill-primary text-sm" style={{ padding: "0.45rem 0.95rem" }}>
                            Reach customer support
                          </button>
                        ) : (
                          <button
                            onClick={() => retryVault(v)}
                            disabled={retrying === v.id}
                            className="ll-pill ll-pill-secondary text-sm"
                            style={{ padding: "0.45rem 0.95rem", opacity: retrying === v.id ? 0.6 : 1 }}
                          >
                            {retrying === v.id ? "Retrying…" : "Try again"}
                          </button>
                        )}
                        <Link to="/create" className="text-xs underline" style={{ color: "var(--warm-gray)" }}>Edit details</Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Vaults */}
          <div className="mt-12 flex items-center justify-between flex-wrap gap-3">
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 600 }}>Your Vaults</h2>
            <button onClick={handleResetDemo} className="ll-pill ll-pill-ghost text-sm" style={{ padding: "0.45rem 0.95rem" }}>
              ⚡ Load demo data
            </button>
          </div>

          {completed.length === 0 ? (
            <div className="ll-card p-12 mt-6 text-center">
              <svg viewBox="0 0 200 200" className="w-40 h-40 mx-auto">
                <rect x="40" y="60" width="120" height="110" rx="14" fill="var(--forest)" opacity="0.08" />
                <rect x="40" y="60" width="120" height="110" rx="14" fill="none" stroke="var(--forest)" strokeWidth="2" />
                <circle cx="130" cy="115" r="10" fill="var(--honey)" />
                <path d="M40 60 L100 30 L160 60" fill="var(--sage)" opacity="0.3" />
              </svg>
              <h3 className="mt-4" style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 600 }}>Your legacy starts here.</h3>
              <p className="mt-3 max-w-md mx-auto text-sm" style={{ color: "var(--warm-gray)" }}>
                Just exploring? Load four demo vaults that show every state — time-locked, inactivity, manual release, and already released.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link to="/create" className="ll-pill ll-pill-secondary">Create your first vault</Link>
                <button onClick={handleResetDemo} className="ll-pill ll-pill-ghost">⚡ Load demo data</button>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid md:grid-cols-2 gap-6">
              {completed.map((v) => <VaultCard key={v.id} vault={v} onCheckIn={checkIn} />)}
            </div>
          )}

          {/* Advisor */}
          <div className="mt-16">
            <div className="flex items-end justify-between flex-wrap gap-3">
              <div>
                <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 600 }}>Your Advisor</h2>
                <p className="mt-1" style={{ color: "var(--warm-gray)" }}>Bring your own planner — or pick one of ours. Linked advisors get read-only access to all your vaults and trustees, and a private chat with you.</p>
              </div>
              <button
                onClick={() => setAdvisorModal({ mode: "choose" })}
                className="ll-pill ll-pill-secondary"
              >+ Add an Advisor</button>
            </div>

            {/* Linked advisors */}
            {links.length > 0 && (
              <div className="mt-6 grid md:grid-cols-2 gap-5">
                {links.map((l) => (
                  <div key={l.id} className="ll-card p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: l.status === "connected" ? "var(--sage)" : "var(--cream)", color: "var(--forest)", fontFamily: "var(--font-serif)", fontWeight: 600, border: "1px solid rgba(26,46,26,0.1)" }}>
                          {l.name.split(" ").map(p => p[0]).slice(0, 2).join("")}
                        </div>
                        <div>
                          <p style={{ fontFamily: "var(--font-serif)", fontWeight: 600, color: "var(--forest)" }}>{l.name}</p>
                          <p className="text-xs" style={{ color: "var(--warm-gray)" }}>{l.firm || l.email}</p>
                        </div>
                      </div>
                      <span
                        className="text-[11px] uppercase tracking-wider px-2 py-1 rounded-full"
                        style={{
                          background: l.status === "connected" ? "rgba(127,168,130,0.18)" : "rgba(232,160,32,0.18)",
                          color: l.status === "connected" ? "var(--forest)" : "var(--honey)",
                        }}
                      >
                        {l.status === "connected" ? "● Linked" : "○ Pending"}
                      </span>
                    </div>
                    <p className="mt-3 text-xs" style={{ color: "var(--warm-gray)" }}>
                      {l.status === "connected"
                        ? "Read-only access to all your vaults, beneficiaries and audit trail."
                        : l.source === "external"
                          ? `We emailed ${l.email} an onboarding link. They'll appear connected once they finish signup.`
                          : "Awaiting their acceptance."}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <Link
                        to="/messages"
                        className="ll-pill ll-pill-sage text-sm inline-flex items-center gap-1.5"
                        style={{ padding: "0.45rem 0.95rem" }}
                        aria-label={`Message ${l.name}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                        </svg>
                        Message
                      </Link>
                      <button onClick={() => unlink(l.id, l.name)} className="text-xs" style={{ color: "var(--warm-gray)", textDecoration: "underline" }}>Disconnect</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-8 ll-label">Recommended for you</p>
            <div className="grid md:grid-cols-3 gap-5">
              {recommendedAdvisors.map((a) => {
                const linked = links.some(l => l.email === a.email);
                return (
                  <div key={a.id} className="ll-card p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "var(--honey)", color: "var(--forest)", fontFamily: "var(--font-serif)", fontWeight: 600 }}>
                        {a.name.split(" ").map(p => p[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <p style={{ fontFamily: "var(--font-serif)", fontWeight: 600, color: "var(--forest)" }}>{a.name}</p>
                        <p className="text-xs" style={{ color: "var(--warm-gray)" }}>{a.firm} · {a.city}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm" style={{ color: "var(--warm-gray)" }}>{a.focus}</p>
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-xs" style={{ color: "var(--honey)" }}>★ {a.rating}</span>
                      <button
                        disabled={linked}
                        onClick={() => handleConnectPlatform(a)}
                        className="ll-pill ll-pill-ghost text-sm"
                        style={{ padding: "0.4rem 0.9rem", opacity: linked ? 0.5 : 1, cursor: linked ? "default" : "pointer" }}
                      >{linked ? "Linked" : "Connect"}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Advisor modal */}
        {advisorModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(26,46,26,0.55)", backdropFilter: "blur(4px)" }}
            onClick={() => setAdvisorModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.22 }}
              className="w-full max-w-lg rounded-2xl p-7"
              style={{ background: "var(--cream)", boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {advisorModal.mode === "choose" && (
                <div>
                  <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 600, color: "var(--forest)" }}>Add an advisor</h3>
                  <p className="mt-1 text-sm" style={{ color: "var(--warm-gray)" }}>Choose how you'd like to bring an advisor onto your legacy.</p>
                  <div className="mt-6 grid gap-3">
                    <button
                      onClick={() => setAdvisorModal({ mode: "invite" })}
                      className="text-left p-4 rounded-xl transition hover:translate-y-[-1px]"
                      style={{ border: "1px solid rgba(26,46,26,0.12)", background: "rgba(255,255,255,0.5)" }}
                    >
                      <p style={{ fontFamily: "var(--font-serif)", fontWeight: 600, color: "var(--forest)", fontSize: 17 }}>Invite my own advisor</p>
                      <p className="mt-1 text-sm" style={{ color: "var(--warm-gray)" }}>Send an email invite. We'll onboard them onto LegacyLink and link them to your account.</p>
                    </button>
                    <button
                      onClick={() => setAdvisorModal({ mode: "platform" })}
                      className="text-left p-4 rounded-xl transition hover:translate-y-[-1px]"
                      style={{ border: "1px solid rgba(26,46,26,0.12)", background: "rgba(255,255,255,0.5)" }}
                    >
                      <p style={{ fontFamily: "var(--font-serif)", fontWeight: 600, color: "var(--forest)", fontSize: 17 }}>Choose a LegacyLink advisor</p>
                      <p className="mt-1 text-sm" style={{ color: "var(--warm-gray)" }}>Vetted Canadian planners already on the platform. Instant link.</p>
                    </button>
                  </div>
                </div>
              )}

              {advisorModal.mode === "invite" && (
                <form onSubmit={handleInviteExternal}>
                  <button type="button" onClick={() => setAdvisorModal({ mode: "choose" })} className="text-xs mb-3" style={{ color: "var(--warm-gray)" }}>← Back</button>
                  <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 600, color: "var(--forest)" }}>Invite your advisor</h3>
                  <p className="mt-1 text-sm" style={{ color: "var(--warm-gray)" }}>We'll email them a private onboarding link. Once they finish signup, you'll be strongly linked.</p>
                  <div className="mt-5 space-y-3">
                    <input required placeholder="Advisor's full name" value={inviteForm.name} onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })} className="ll-input w-full" />
                    <input required type="email" placeholder="Advisor's email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} className="ll-input w-full" />
                    <input placeholder="Firm (optional)" value={inviteForm.firm} onChange={e => setInviteForm({ ...inviteForm, firm: e.target.value })} className="ll-input w-full" />
                    <textarea placeholder="Personal note (optional)" value={inviteForm.note} onChange={e => setInviteForm({ ...inviteForm, note: e.target.value })} rows={3} className="ll-input w-full" />
                  </div>
                  <p className="mt-4 text-xs" style={{ color: "var(--warm-gray)" }}>They'll receive an email and an in-app notification when they create their account.</p>
                  <div className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={() => setAdvisorModal(null)} className="ll-pill ll-pill-ghost">Cancel</button>
                    <button type="submit" className="ll-pill ll-pill-primary">Send invite</button>
                  </div>
                </form>
              )}

              {advisorModal.mode === "platform" && (
                <div>
                  <button type="button" onClick={() => setAdvisorModal({ mode: "choose" })} className="text-xs mb-3" style={{ color: "var(--warm-gray)" }}>← Back</button>
                  <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 600, color: "var(--forest)" }}>Choose a LegacyLink advisor</h3>
                  <p className="mt-1 text-sm" style={{ color: "var(--warm-gray)" }}>Each one has been vetted and is licensed in Canada.</p>
                  <div className="mt-5 space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                    {recommendedAdvisors.map(a => {
                      const linked = links.some(l => l.email === a.email);
                      return (
                        <div key={a.id} className="flex items-center justify-between p-3 rounded-xl" style={{ border: "1px solid rgba(26,46,26,0.1)" }}>
                          <div>
                            <p style={{ fontFamily: "var(--font-serif)", fontWeight: 600, color: "var(--forest)" }}>{a.name}</p>
                            <p className="text-xs" style={{ color: "var(--warm-gray)" }}>{a.firm} · {a.city} · ★ {a.rating}</p>
                          </div>
                          <button
                            disabled={linked}
                            onClick={() => handleConnectPlatform(a)}
                            className="ll-pill ll-pill-secondary text-sm"
                            style={{ padding: "0.4rem 0.9rem", opacity: linked ? 0.5 : 1 }}
                          >{linked ? "Linked" : "Link"}</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* FAB */}
        <Link
          to="/create"
          aria-label="New Vault"
          className="ll-fab-pulse fixed bottom-8 right-8 w-16 h-16 rounded-full flex items-center justify-center z-30 group"
          style={{ background: "var(--forest)", color: "var(--honey)", fontSize: 32, boxShadow: "0 12px 32px rgba(26,46,26,0.25)" }}
        >
          <span
            className="absolute -top-9 whitespace-nowrap text-xs font-medium px-3 py-1.5 rounded-full"
            style={{ background: "var(--honey)", color: "var(--forest)", boxShadow: "0 6px 16px rgba(0,0,0,0.15)" }}
          >
            Protect someone today
          </span>
          <span style={{ lineHeight: 1, marginTop: -3 }}>+</span>
          <span className="absolute right-20 whitespace-nowrap text-sm px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition" style={{ background: "var(--forest)", color: "var(--cream)" }}>
            Protect someone today
          </span>
        </Link>

        {/* Demo controls — for hackathon walkthrough */}
        <button
          onClick={handleResetDemo}
          aria-label="Reset demo data"
          title="Reset demo data — loads a curated scenario for live walkthroughs"
          className="fixed bottom-8 left-8 z-30 px-3 py-2 rounded-full text-xs flex items-center gap-2"
          style={{ background: "rgba(26,46,26,0.08)", color: "var(--forest)", border: "1px solid rgba(26,46,26,0.15)", backdropFilter: "blur(6px)" }}
        >
          <span aria-hidden>↻</span> Reset demo
        </button>

        {/* Customer support modal — appears after 3 failed retries */}
        {supportFor && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(26,46,26,0.55)", backdropFilter: "blur(4px)" }}
            onClick={() => setSupportFor(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.22 }}
              className="w-full max-w-md rounded-2xl p-7"
              style={{ background: "var(--cream)", boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 600, color: "var(--forest)" }}>
                Let's get this sorted together
              </h3>
              <p className="mt-2 text-sm" style={{ color: "var(--warm-gray)" }}>
                "{supportFor.name}" hasn't been able to finish setup after {supportFor.failure_count ?? 0} attempts.
                Our team can complete it for you in minutes.
              </p>
              <div className="mt-5 rounded-xl p-4" style={{ background: "rgba(127,168,130,0.12)" }}>
                <p className="text-xs uppercase tracking-wider" style={{ color: "var(--warm-gray)" }}>Vault reference</p>
                <code className="text-xs">{supportFor.id}</code>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 justify-end">
                <button onClick={() => setSupportFor(null)} className="ll-pill ll-pill-ghost text-sm">Not now</button>
                <a
                  href={`mailto:support@legacylink.app?subject=${encodeURIComponent(`Help finishing vault ${supportFor.name}`)}&body=${encodeURIComponent(`Hi LegacyLink team,\n\nMy vault "${supportFor.name}" (id ${supportFor.id}) has failed to set up ${supportFor.failure_count ?? 0} times. Can you help me finish it?\n\nThanks.`)}`}
                  className="ll-pill ll-pill-primary text-sm"
                >Email support</a>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
