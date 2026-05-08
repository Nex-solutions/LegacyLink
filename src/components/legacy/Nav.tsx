import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { clearUser, getUser, type User } from "@/lib/legacy-auth";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center"
        style={{ background: light ? "var(--honey)" : "var(--forest)" }}
      >
        <span style={{ color: light ? "var(--forest)" : "var(--honey)", fontFamily: "var(--font-serif)", fontWeight: 700 }}>L</span>
      </div>
      <span
        className="text-xl"
        style={{ fontFamily: "var(--font-serif)", color: light ? "var(--cream)" : "var(--forest)", fontWeight: 600 }}
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
          className="hidden sm:inline-flex items-center gap-1.5 text-sm tracking-tight"
          style={{ color: "var(--warm-gray)" }}
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
