import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { AppHeader } from "@/components/legacy/Nav";
import { Blob, PageShell } from "@/components/legacy/PageShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LegacyLink — Protect what matters. For the people who matter." },
      { name: "description", content: "Set aside Canadian dollars today so they reach the right hands at exactly the right moment — automatically, legally, and with certainty." },
      { property: "og:title", content: "LegacyLink — Certainty is a gift." },
      { property: "og:description", content: "A modern digital estate vault for Canadian families." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <PageShell>
      <AppHeader />

      {/* Hero */}
      <section className="relative px-6 lg:px-12 pt-12 lg:pt-20 pb-24 overflow-hidden">
        <Blob className="w-[680px] h-[680px] -top-40 -right-40" color="var(--forest)" opacity={0.05} />
        <Blob className="w-[480px] h-[480px] top-40 -left-32" color="var(--sage)" opacity={0.10} />
        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            style={{ fontFamily: "var(--font-serif)", color: "var(--forest)", fontSize: "clamp(40px,7vw,72px)", lineHeight: 1.05, fontWeight: 600, letterSpacing: "-0.02em" }}
          >
            Protect what matters.
            <br />
            <span style={{ color: "var(--forest)" }}>For the people who matter.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.7 }}
            className="mx-auto mt-8 max-w-2xl text-lg"
            style={{ color: "var(--warm-gray)" }}
          >
            LegacyLink lets you set aside money today so it reaches the right hands at exactly the right moment — automatically, legally, and with certainty.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            <Link to="/signup" className="ll-pill ll-pill-primary">Get Started Free</Link>
            <a href="#how" className="ll-pill ll-pill-ghost">See How It Works</a>
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 8, 0] }}
          transition={{ delay: 1, duration: 2, repeat: Infinity }}
          className="absolute left-1/2 -translate-x-1/2 bottom-6 text-sm"
          style={{ color: "var(--warm-gray)" }}
        >
          ↓ Scroll
        </motion.div>
      </section>

      {/* Stats strip */}
      <section style={{ background: "var(--forest)" }} className="px-6 lg:px-12 py-14">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 text-center">
          {[
            { stat: "$1.2T", label: "Canadian intergenerational wealth transfer projected by 2030 (CIBC)" },
            { stat: "51%", label: "Of Canadian adults have no will (Angus Reid, 2023)" },
            { stat: "8 mo.", label: "Average probate processing time across Canada" },
          ].map((s) => (
            <div key={s.label}>
              <div style={{ fontFamily: "var(--font-serif)", color: "var(--honey)", fontSize: 56, fontWeight: 600 }}>{s.stat}</div>
              <div className="mt-2 text-sm" style={{ color: "rgba(250,250,247,0.78)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative px-6 lg:px-12 py-24 overflow-hidden">
        <Blob className="w-[400px] h-[400px] -left-20 top-40" color="var(--honey)" opacity={0.08} />
        <div className="relative z-10 max-w-6xl mx-auto">
          <h2 className="text-center max-w-3xl mx-auto" style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(28px,4vw,40px)", lineHeight: 1.15, fontWeight: 600 }}>
            Simple as leaving a note.
            <br />
            Powerful as a legal trust.
          </h2>
          <div className="grid md:grid-cols-3 gap-6 mt-16">
            {[
              { n: "01", t: "Fund Your Vault", d: "Deposit any amount in Canadian dollars via e-transfer or credit card. We handle everything securely." },
              { n: "02", t: "Set Your Conditions", d: "Choose when your vault releases: on a date, if you go silent, or at your command." },
              { n: "03", t: "Your People Get Paid", d: "Beneficiaries receive Canadian dollars directly via Interac e-Transfer. No accounts needed." },
            ].map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.6 }}
                className="ll-card p-8"
              >
                <div style={{ fontFamily: "var(--font-serif)", color: "var(--honey)", fontSize: 56, fontWeight: 700, lineHeight: 1 }}>{s.n}</div>
                <h3 className="mt-4 text-2xl font-semibold">{s.t}</h3>
                <p className="mt-3" style={{ color: "var(--warm-gray)" }}>{s.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why */}
      <section style={{ background: "var(--forest)" }} className="px-6 lg:px-12 py-24 relative overflow-hidden">
        <div className="ll-blob ll-drift" style={{ width: 500, height: 500, right: -120, top: -120, background: "var(--sage)", opacity: 0.18 }} />
        <div className="relative z-10 max-w-6xl mx-auto grid md:grid-cols-2 gap-14 items-center">
          <div>
            <p style={{ fontFamily: "var(--font-serif)", color: "var(--cream)", fontSize: "clamp(28px,3.5vw,40px)", lineHeight: 1.2, fontWeight: 500 }}>
              "Estate planning used to take lawyers, paperwork, and months. We do it in 10 minutes."
            </p>
          </div>
          <ul className="space-y-5">
            {[
              "No lawyer fees, no paperwork mountain",
              "Funds release automatically — no delays for grieving families",
              "Beneficiaries paid in CAD via Interac e-Transfer",
              "Bank-grade security with cryptographic guarantees",
            ].map((b) => (
              <li key={b} className="flex items-start gap-4" style={{ color: "var(--cream)" }}>
                <span className="mt-1 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "var(--honey)", color: "var(--forest)" }}>✓</span>
                <span className="text-lg">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 lg:px-12 py-24 text-center relative overflow-hidden">
        <Blob className="w-[420px] h-[420px] left-1/2 -translate-x-1/2 top-10" color="var(--honey)" opacity={0.10} />
        <div className="relative z-10 max-w-2xl mx-auto">
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(32px,4.5vw,48px)", fontWeight: 600 }}>
            Begin your legacy in 10 minutes.
          </h2>
          <p className="mt-4" style={{ color: "var(--warm-gray)" }}>
            Free to start. No credit card required.
          </p>
          <Link to="/signup" className="ll-pill ll-pill-secondary mt-8">Create your vault →</Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: "var(--forest)" }} className="px-6 lg:px-12 py-12">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8 items-start">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--honey)" }}>
                <span style={{ color: "var(--forest)", fontFamily: "var(--font-serif)", fontWeight: 700 }}>L</span>
              </div>
              <span style={{ fontFamily: "var(--font-serif)", color: "var(--cream)", fontSize: 22, fontWeight: 600 }}>LegacyLink</span>
            </div>
            <p className="mt-3 italic" style={{ color: "rgba(250,250,247,0.75)", fontFamily: "var(--font-serif)" }}>
              Certainty is a gift.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 md:justify-end" style={{ color: "rgba(250,250,247,0.85)" }}>
            <a href="#how" className="text-sm">How it works</a>
            <a href="#" className="text-sm">Pricing</a>
            <Link to="/advisor" className="text-sm">For Advisors</Link>
            <a href="#" className="text-sm">Privacy</a>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-8 border-t text-xs" style={{ borderColor: "rgba(250,250,247,0.12)", color: "rgba(250,250,247,0.5)" }}>
          Powered by Solana · Secured by cryptography · Built for Canadian families
        </div>
      </footer>
    </PageShell>
  );
}
