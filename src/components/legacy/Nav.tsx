import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { clearAdvisor, getUser, getAdvisor, signOut, type User, type Advisor } from "@/lib/legacy-auth";
import legacyMark from "@/assets/legacy-mark.png";

export function Logo({ light = false, to = "/" }: { light?: boolean; to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 group">
      <span
        className="inline-flex items-center justify-center rounded-full transition-transform group-hover:scale-[1.04]"
        style={{
          width: 36,
          height: 36,
          background: light ? "rgba(250,250,247,0.08)" : "rgba(26,46,26,0.04)",
          padding: 4,
        }}
      >
        <img
          src={legacyMark}
          alt="LegacyLink"
          width={28}
          height={28}
          style={{ display: "block", filter: light ? "brightness(0) invert(1)" : "none" }}
        />
      </span>
      <span
        className="text-xl tracking-tight"
        style={{ fontFamily: "var(--font-serif)", color: light ? "var(--cream)" : "var(--forest)", fontWeight: 600, letterSpacing: "-0.01em" }}
      >
        LegacyLink
      </span>
    </Link>
  );
}

export function AppHeader() {
  const navigate = useNavigate();
  const [user, setUserState] = useState<User | null>(null);
  const [advisor, setAdvisorState] = useState<Advisor | null>(null);
  useEffect(() => {
    setUserState(getUser());
    setAdvisorState(getAdvisor());
  }, []);
  const signedIn = !!user || !!advisor;
  return (
    <header className="relative z-10 px-6 lg:px-12 py-5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Logo />
        <span
          title="This is a hackathon devnet build. Funds shown are simulated USDC on Solana devnet — no real CAD moves."
          className="hidden sm:inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] px-2 py-1 rounded-full"
          style={{ background: "rgba(232,160,32,0.16)", color: "var(--honey)", border: "1px solid rgba(232,160,32,0.35)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--honey)" }} />
          Devnet · test mode
        </span>
      </div>
      <nav className="flex items-center gap-3 lg:gap-5">
        {!signedIn && (
          <>
            <Link
              to="/advisor"
              title="Open the advisor portal"
              aria-label="Open the advisor portal"
              className="group inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold tracking-tight rounded-full px-3.5 py-1.5 border transition-all hover:shadow-sm hover:-translate-y-px"
              style={{ color: "var(--forest)", background: "rgba(232,160,32,0.18)", borderColor: "rgba(232,160,32,0.55)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--honey)" }} />
              For Advisors
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
            <span className="hidden sm:inline-block h-4 w-px" style={{ background: "rgba(26,46,26,0.14)" }} />
          </>
        )}
        {user ? (
          <>
            <Link to="/messages" className="hidden sm:inline text-sm" style={{ color: "var(--forest)" }}>Messages</Link>
            <Link to="/dashboard" className="hidden sm:inline text-sm" style={{ color: "var(--forest)" }}>Dashboard</Link>
            <button
              onClick={async () => { setUserState(null); setAdvisorState(null); navigate({ to: "/" }); await signOut(); }}
              className="ll-pill ll-pill-ghost text-sm"
              style={{ padding: "0.5rem 1rem" }}
            >
              Sign out
            </button>
          </>
        ) : advisor ? (
          <>
            <Link to="/advisor/messages" className="hidden sm:inline text-sm" style={{ color: "var(--forest)" }}>Messages</Link>
            <Link to="/advisor/dashboard" className="hidden sm:inline text-sm" style={{ color: "var(--forest)" }}>Dashboard</Link>
            <button
              onClick={() => { clearAdvisor(); navigate({ to: "/" }); }}
              className="ll-pill ll-pill-ghost text-sm"
              style={{ padding: "0.5rem 1rem" }}
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="text-sm" style={{ color: "var(--forest)" }}>Sign in</Link>
            <Link to="/signup" className="ll-pill ll-pill-primary text-sm" style={{ padding: "0.5rem 1.1rem" }}>
              Get Started
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
