import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { AppHeader } from "@/components/legacy/Nav";
import { Blob, PageShell } from "@/components/legacy/PageShell";

export const Route = createFileRoute("/business-plan")({
  head: () => ({
    meta: [
      { title: "LegacyLink — Business Plan" },
      { name: "description", content: "How LegacyLink turns Canada's $1.2T intergenerational wealth transfer into a programmable, on-chain estate platform." },
      { property: "og:title", content: "LegacyLink — Business Plan" },
      { property: "og:description", content: "Market, product, model, traction, and the ask. One page." },
    ],
  }),
  component: BusinessPlan,
});

function Section({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className="relative py-14 lg:py-20"
    >
      <div className="max-w-6xl mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-[220px_1fr] gap-8 lg:gap-16">
          <div>
            <span
              className="text-[10px] uppercase tracking-[0.22em] font-semibold"
              style={{ color: "var(--honey)" }}
            >
              {label}
            </span>
            <h2
              className="mt-3"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(28px,3.4vw,38px)",
                lineHeight: 1.1,
                fontWeight: 600,
                color: "var(--forest)",
                letterSpacing: "-0.02em",
              }}
            >
              {title}
            </h2>
          </div>
          <div className="space-y-5 text-[17px] leading-[1.65]" style={{ color: "var(--warm-gray)" }}>
            {children}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="ll-card p-6">
      <div
        style={{
          fontFamily: "var(--font-serif)",
          color: "var(--forest)",
          fontSize: 42,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div className="mt-2 text-sm" style={{ color: "var(--warm-gray)" }}>
        {label}
      </div>
    </div>
  );
}

function BusinessPlan() {
  return (
    <PageShell>
      <AppHeader />

      {/* Hero */}
      <section className="relative px-6 lg:px-12 pt-10 lg:pt-16 pb-16 overflow-hidden">
        <Blob className="w-[640px] h-[640px] -top-40 -right-40" color="var(--forest)" opacity={0.05} />
        <Blob className="w-[420px] h-[420px] top-32 -left-32" color="var(--sage)" opacity={0.1} />
        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <span
            className="inline-block text-[11px] px-3 py-1 rounded-full font-medium uppercase tracking-[0.18em]"
            style={{ background: "rgba(232,160,32,0.18)", color: "var(--forest)" }}
          >
            Business plan · v1.0 · 2026
          </span>
          <h1
            className="mt-6"
            style={{
              fontFamily: "var(--font-serif)",
              color: "var(--forest)",
              fontSize: "clamp(40px,6.5vw,68px)",
              lineHeight: 1.05,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            Programmable inheritance,
            <br />
            built for Canada.
          </h1>
          <p
            className="mt-7 mx-auto max-w-2xl text-lg"
            style={{ color: "var(--warm-gray)" }}
          >
            LegacyLink turns Canada's $1.2T intergenerational wealth transfer into a
            CAD-in, CAD-out estate platform — secured on Solana, paid out via Interac, with
            zero probate friction.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/" className="ll-pill ll-pill-ghost">← Back to product</Link>
            <Link to="/signup" className="ll-pill ll-pill-primary">Try the demo</Link>
          </div>
        </div>
      </section>

      {/* Snapshot */}
      <section className="px-6 lg:px-12 py-10">
        <div className="max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat value="$1.2T" label="CA wealth transfer by 2030 (CIBC)" />
          <Stat value="51%" label="Canadian adults without a will" />
          <Stat value="8 mo." label="Average probate duration" />
          <Stat value="0" label="Crypto knowledge required by users" />
        </div>
      </section>

      <Section label="01 · Problem" title="Estate planning in Canada is slow, expensive, and exclusive.">
        <p>
          Half of Canadian adults have no will. Of those who do, settlement still takes
          an average of <strong>eight months</strong> through provincial probate, with
          legal fees that price out the middle class entirely.
        </p>
        <p>
          The result: families wait months for support during their hardest moment, and
          $1.2T of generational wealth is set to move through a system designed in the
          1800s.
        </p>
      </Section>

      <Section label="02 · Solution" title="A programmable vault that pays your people in CAD, automatically.">
        <p>
          LegacyLink lets a Canadian adult lock funds into a vault in ten minutes and
          define exactly when, how, and to whom they release — by date, by inactivity, or
          on command.
        </p>
        <p>
          Users deposit CAD. We on-ramp to USDC, sweep into a treasury hot wallet, lock
          the funds in an on-chain Anchor vault, and on trigger, off-ramp back to CAD via
          Interac e-Transfer. Beneficiaries never touch crypto. The chain is the receipt.
        </p>
      </Section>

      <Section label="03 · Market" title="$1.2T moving in the next five years — addressable today.">
        <ul className="space-y-3">
          <li>
            <strong style={{ color: "var(--forest)" }}>TAM:</strong> $1.2T Canadian
            intergenerational wealth transfer projected by 2030 (CIBC).
          </li>
          <li>
            <strong style={{ color: "var(--forest)" }}>SAM:</strong> ~14M Canadian adults
            without a will × ~$45 ARPU = <strong>~$630M/yr</strong>.
          </li>
          <li>
            <strong style={{ color: "var(--forest)" }}>SOM (Y3):</strong> 0.5% capture =
            <strong> ~$3.1M ARR</strong>, conservative path to $20M+ by Y5.
          </li>
        </ul>
      </Section>

      <Section label="04 · Product" title="Three primitives, one promise.">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { t: "Vault", d: "Programmable USDC escrow on Solana, owner-funded in CAD." },
            { t: "Triggers", d: "Date, inactivity (dead-man switch), or manual release." },
            { t: "Payout", d: "USDC → CAD off-ramp via Paytrie, Interac to beneficiaries." },
          ].map((p) => (
            <div key={p.t} className="ll-card p-6">
              <h3 className="text-xl font-semibold" style={{ color: "var(--forest)" }}>{p.t}</h3>
              <p className="mt-2 text-sm" style={{ color: "var(--warm-gray)" }}>{p.d}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section label="05 · Business model" title="Four revenue streams. One platform.">
        <ul className="space-y-3">
          <li>
            <strong style={{ color: "var(--forest)" }}>Transaction fees</strong> — 0.50%
            on every CAD → vault deposit and vault → CAD payout, capped at $250. Revenue
            scales with money actually moving.
          </li>
          <li>
            <strong style={{ color: "var(--forest)" }}>Float &amp; yield on locked funds</strong>
            — locked USDC sits in vetted, low-risk on-chain yield (T-bill-backed
            stablecoin strategies). We share the spread and keep a managed cut.
          </li>
          <li>
            <strong style={{ color: "var(--forest)" }}>Beneficiary premium</strong> —
            optional $5/mo per claimant for instant payouts, multi-recipient splits,
            tax-ready statements, and concierge claim support.
          </li>
          <li>
            <strong style={{ color: "var(--forest)" }}>Advisor SaaS</strong> —
            $49/seat/mo for financial planners managing client books, with white-label
            tier for credit unions and wealth desks.
          </li>
        </ul>
      </Section>

      <Section label="06 · Go-to-market" title="Distribution through trust, not ads.">
        <ol className="list-decimal pl-5 space-y-2">
          <li>Partner with Canadian fee-only financial planners (CFP network: ~17K).</li>
          <li>Embed in credit-union onboarding flows (Meridian, Vancity, Coast Capital).</li>
          <li>Content engine: probate horror stories, $0 will guides, Canadian-tax explainers.</li>
          <li>Referral economics: $25 per activated household, both sides.</li>
        </ol>
      </Section>

      <Section label="07 · Why now" title="Three rails finally exist at once.">
        <ul className="space-y-3">
          <li>
            <strong style={{ color: "var(--forest)" }}>Regulated CAD ↔ stablecoin rails.</strong>{" "}
            Paytrie + Interac make CAD-in/CAD-out feel like e-Transfer.
          </li>
          <li>
            <strong style={{ color: "var(--forest)" }}>Cheap, fast L1.</strong> Solana
            settles vault ops for fractions of a cent in under a second.
          </li>
          <li>
            <strong style={{ color: "var(--forest)" }}>Generational handover.</strong>{" "}
            Boomers are transferring wealth to a digital-native cohort that expects this UX.
          </li>
        </ul>
      </Section>

      <Section label="08 · Competition" title="Adjacent, not overlapping.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ color: "var(--forest)" }}>
            <thead style={{ color: "var(--warm-gray)" }}>
              <tr className="text-left border-b" style={{ borderColor: "rgba(26,46,26,0.12)" }}>
                <th className="py-3 pr-4">Player</th>
                <th className="py-3 pr-4">Strength</th>
                <th className="py-3">Gap we fill</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Willful, Epilogue", "Will drafting", "No funds movement, no execution"],
                ["TD Wealth, RBC Estates", "Trust services", "$1M+ minimums, slow, expensive"],
                ["Crypto inheritance dApps", "On-chain vaults", "No fiat rails, no Canadian KYC"],
              ].map(([a, b, c]) => (
                <tr key={a} className="border-b" style={{ borderColor: "rgba(26,46,26,0.08)" }}>
                  <td className="py-3 pr-4 font-semibold">{a}</td>
                  <td className="py-3 pr-4" style={{ color: "var(--warm-gray)" }}>{b}</td>
                  <td className="py-3" style={{ color: "var(--warm-gray)" }}>{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section label="09 · Traction" title="Devnet live. Hackathon today. Mainnet next.">
        <ul className="space-y-3">
          <li>✅ End-to-end vault flow on Solana devnet (sign-up → wallet → vault → claim).</li>
          <li>✅ Custodial wallet provisioning + on-chain proof-of-life per user.</li>
          <li>✅ Anchor vault program deployed; sweep + payout pipeline operational.</li>
          <li>✅ Open-source repo with full README, CI, security policy.</li>
          <li>🟡 Paytrie merchant integration in sandbox; mainnet pending audit.</li>
        </ul>
      </Section>

      <Section label="10 · Roadmap" title="From devnet to default Canadian estate rail.">
        <ol className="list-decimal pl-5 space-y-2">
          <li><strong style={{ color: "var(--forest)" }}>Q2 2026</strong> — Hackathon launch, advisor pilot (10 firms).</li>
          <li><strong style={{ color: "var(--forest)" }}>Q3 2026</strong> — Third-party Anchor audit, mainnet beta.</li>
          <li><strong style={{ color: "var(--forest)" }}>Q4 2026</strong> — Public launch, first 1,000 vaults funded.</li>
          <li><strong style={{ color: "var(--forest)" }}>2027</strong> — Multi-sig advisor co-approval, French localization, recurring disbursements.</li>
        </ol>
      </Section>

      <Section label="11 · Team" title="Builders who ship, with skin in the game.">
        <p>
          Founding team blends fintech engineering, Solana protocol experience, and
          Canadian wealth-management product. Backed by an advisory bench of estate
          lawyers and financial planners.
        </p>
        <p className="text-sm italic" style={{ color: "var(--warm-gray)" }}>
          Full team bios available on request.
        </p>
      </Section>

      <Section label="12 · Milestones" title="What we ship over the next 12 months.">
        <ul className="space-y-3">
          <li>
            <strong style={{ color: "var(--forest)" }}>Engineering:</strong> third-party
            Anchor audit, mainnet vault program, multi-sig advisor co-approval.
          </li>
          <li>
            <strong style={{ color: "var(--forest)" }}>Distribution:</strong> 10 advisor
            firm pilots, 2 credit-union onboarding integrations, 1,000 funded vaults.
          </li>
          <li>
            <strong style={{ color: "var(--forest)" }}>Unit economics:</strong> $1M AUM
            under management, profitable on transaction + float revenue alone.
          </li>
        </ul>
      </Section>

      {/* CTA */}
      <section className="px-6 lg:px-12 py-20 text-center relative overflow-hidden">
        <Blob className="w-[420px] h-[420px] left-1/2 -translate-x-1/2 top-10" color="var(--honey)" opacity={0.1} />
        <div className="relative z-10 max-w-2xl mx-auto">
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(30px,4vw,44px)",
              fontWeight: 600,
              color: "var(--forest)",
            }}
          >
            The rail Canadian families will inherit on.
          </h2>
          <p className="mt-4" style={{ color: "var(--warm-gray)" }}>
            Try the live devnet demo, or head back to the product to explore the flow end-to-end.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/signup" className="ll-pill ll-pill-primary">Try the demo</Link>
            <Link to="/" className="ll-pill ll-pill-ghost">See the product</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: "var(--forest)" }} className="px-6 lg:px-12 py-10">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs" style={{ color: "rgba(250,250,247,0.65)" }}>
          <span>LegacyLink · Business plan v1.0 · Confidential</span>
          <span>© 2026 LegacyLink. All rights reserved.</span>
        </div>
      </footer>
    </PageShell>
  );
}
