import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Blob, PageShell } from "@/components/legacy/PageShell";
import { Logo } from "@/components/legacy/Nav";

export const Route = createFileRoute("/advisor/")({
  head: () => ({
    meta: [
      { title: "LegacyLink for Advisors — Real-time client estate visibility" },
      { name: "description", content: "A real-time window into your clients' estate vaults — built for Canadian financial advisors and estate planners." },
      { property: "og:title", content: "LegacyLink for Advisors" },
      { property: "og:description", content: "Monitor every client vault, condition, and release from one dashboard." },
    ],
  }),
  component: AdvisorLanding,
});

const FIRMS = [
  "Raymond James", "Edward Jones", "Harbourfront Wealth",
  "Investors Group", "IG Wealth Management", "Independent Advisors",
];

const VALUES = [
  {
    n: "01", title: "Full Visibility",
    body: "See every vault, condition, and upcoming release across your entire client book — in real time.",
  },
  {
    n: "02", title: "Proactive Alerts",
    body: "Get notified the moment a client goes quiet, a vault nears release, or a condition needs review.",
  },
  {
    n: "03", title: "Effortless Onboarding",
    body: "Invite clients directly from your dashboard. They are protected within minutes, not weeks.",
  },
];

function AdvisorLanding() {
  return (
    <PageShell>
      {/* Header */}
      <header className="relative z-10 px-6 lg:px-12 py-5 flex items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-3 lg:gap-5">
          <Link to="/" className="hidden sm:inline text-sm" style={{ color: "var(--forest)" }}>For Families</Link>
          <Link to="/advisor/login" className="text-sm" style={{ color: "var(--forest)" }}>Sign in</Link>
          <Link to="/advisor/signup" className="ll-pill ll-pill-primary text-sm" style={{ padding: "0.55rem 1.2rem" }}>
            Create Advisor Account
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative px-6 lg:px-12 pt-12 lg:pt-20 pb-24 overflow-hidden">
        <Blob className="w-[640px] h-[640px] -top-40 -right-40" color="var(--sage)" opacity={0.10} />
        <Blob className="w-[420px] h-[420px] top-40 -left-20" color="var(--honey)" opacity={0.08} />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block text-xs px-3 py-1 rounded-full font-medium uppercase tracking-widest"
            style={{ background: "rgba(232,160,32,0.14)", color: "var(--forest)" }}
          >
            For Financial Professionals
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="mt-6"
            style={{ fontFamily: "var(--font-serif)", color: "var(--forest)", fontSize: "clamp(40px,6vw,56px)", lineHeight: 1.05, fontWeight: 600, letterSpacing: "-0.02em" }}
          >
            Your clients' legacies,
            <br />
            <span style={{ color: "var(--forest)" }}>always protected.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.7 }}
            className="mx-auto mt-7 max-w-2xl text-lg"
            style={{ color: "var(--warm-gray)" }}
          >
            LegacyLink gives financial advisors a real-time window into their clients'
            estate vaults — with zero extra work for you or them.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            <Link to="/advisor/signup" className="ll-pill ll-pill-primary">Create Advisor Account</Link>
            <Link to="/advisor/login" className="ll-pill ll-pill-ghost">Sign In</Link>
          </motion.div>
        </div>
      </section>

      {/* Value props */}
      <section className="px-6 lg:px-12 pb-24">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
          {VALUES.map((v, i) => (
            <motion.div
              key={v.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="ll-card p-8"
            >
              <div style={{ fontFamily: "var(--font-serif)", color: "var(--honey)", fontSize: 40, fontWeight: 600, lineHeight: 1 }}>{v.n}</div>
              <div className="mt-5 h-px w-10" style={{ background: "rgba(26,46,26,0.14)" }} />
              <h3 className="mt-5 text-xl" style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}>
                {v.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--warm-gray)" }}>{v.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Trust strip */}
      <section className="px-6 lg:px-12 pb-24">
        <div className="max-w-5xl mx-auto text-center">
          <p style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 500, color: "var(--forest)" }}>
            Whether you're at a major firm or running an independent practice,
            LegacyLink fits your workflow.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {FIRMS.map((f) => (
              <span key={f} className="text-sm" style={{ color: "rgba(74,74,74,0.55)" }}>
                {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA strip */}
      <section style={{ background: "var(--forest)" }} className="px-6 lg:px-12 py-20 text-center relative overflow-hidden">
        <div className="ll-blob ll-drift" style={{ width: 480, height: 480, right: -120, top: -160, background: "var(--honey)", opacity: 0.18 }} />
        <div className="relative z-10 max-w-3xl mx-auto">
          <h2 style={{ fontFamily: "var(--font-serif)", color: "var(--cream)", fontSize: "clamp(30px,4vw,44px)", fontWeight: 600 }}>
            Ready to protect your clients' legacies?
          </h2>
          <Link to="/advisor/signup" className="ll-pill ll-pill-secondary mt-8 inline-flex">
            Create Advisor Account
          </Link>
        </div>
      </section>

      <footer className="px-6 lg:px-12 py-8 text-center text-xs" style={{ color: "rgba(74,74,74,0.6)" }}>
        © LegacyLink · Built for Canadian families and the advisors who serve them
      </footer>
    </PageShell>
  );
}
