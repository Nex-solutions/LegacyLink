import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AdvisorAuthShell } from "@/components/legacy/AdvisorAuthShell";
import { setAdvisor } from "@/lib/legacy-auth";

export const Route = createFileRoute("/advisor/login")({
  head: () => ({ meta: [{ title: "Advisor Sign In — LegacyLink" }] }),
  component: AdvisorLogin,
});

function AdvisorLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/.+@.+\..+/.test(form.email)) return toast.error("Enter a valid email.");
    if (form.password.length < 6) return toast.error("Password must be 6+ characters.");
    setLoading(true);
    setTimeout(() => {
      const handle = form.email.split("@")[0];
      const firstName = handle.charAt(0).toUpperCase() + handle.slice(1);
      setAdvisor({
        firstName,
        lastName: "",
        email: form.email,
        firm: "Your Practice",
        advisorType: "Financial Advisor",
        province: "Ontario",
      });
      navigate({ to: "/advisor/dashboard" });
    }, 1400);
  }

  return (
    <AdvisorAuthShell>
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 32, fontWeight: 600, color: "var(--forest)" }}>
        Advisor Sign In
      </h1>
      <p className="mt-2 text-base" style={{ color: "var(--warm-gray)" }}>
        Welcome back to your portal.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label className="ll-label">Email</label>
          <input type="email" className="ll-input" placeholder="you@yourfirm.com"
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="ll-label">Password</label>
          <input type="password" className="ll-input" placeholder="••••••••"
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <div className="mt-2 text-right">
            <button type="button" onClick={() => toast.success("Password reset email sent.")}
              className="text-xs" style={{ color: "var(--honey)" }}>
              Forgot password?
            </button>
          </div>
        </div>
        <button disabled={loading} type="submit"
          className="ll-pill ll-pill-primary w-full mt-2"
          style={{ height: 52, opacity: loading ? 0.7 : 1 }}>
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <p className="mt-8 text-sm text-center" style={{ color: "var(--warm-gray)" }}>
        New advisor?{" "}
        <Link to="/advisor/signup" style={{ color: "var(--honey)", fontWeight: 500 }}>
          Create your account →
        </Link>
      </p>
      <p className="mt-3 text-xs text-center">
        <Link to="/" style={{ color: "var(--warm-gray)" }}>← Back to LegacyLink</Link>
      </p>
    </AdvisorAuthShell>
  );
}
