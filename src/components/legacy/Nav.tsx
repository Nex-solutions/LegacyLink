import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { clearUser, getUser, type User } from "@/lib/legacy-auth";
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
  useEffect(() => { setUserState(getUser()); }, []);
  return (
    <header className="relative z-10 px-6 lg:px-12 py-5 flex items-center justify-between">
      <Logo />
      <nav className="flex items-center gap-3 lg:gap-5">
        <Link
          to="/advisor"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm tracking-tight rounded-full px-3 py-1.5 transition-colors"
          style={{ color: "var(--forest)", background: "rgba(232,160,32,0.14)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--honey)" }} />
          For Advisors
        </Link>
        <span className="hidden sm:inline-block h-4 w-px" style={{ background: "rgba(26,46,26,0.14)" }} />
        {user ? (
          <>
            <Link to="/dashboard" className="hidden sm:inline text-sm" style={{ color: "var(--forest)" }}>Dashboard</Link>
            <button
              onClick={() => { clearUser(); navigate({ to: "/" }); }}
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
