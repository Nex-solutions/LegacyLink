import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthSplit } from "@/components/legacy/AuthSplit";
import { setAdvisor } from "@/lib/legacy-auth";

export const Route = createFileRoute("/advisor/login")({
  head: () => ({ meta: [{ title: "IGWM Advisor Portal — LegacyLink" }] }),
  component: AdvisorLogin,
});

function AdvisorLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "advisor@igwm.ca", password: "" });
  const [loading, setLoading] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 6) return toast.error("Password must be 6+ characters.");
    setLoading(true);
    setTimeout(() => {
      setAdvisor({ name: "Advisor", email: form.email });
      navigate({ to: "/advisor" });
    }, 2000);
  }

  return (
    <AuthSplit quote="Trust, transferred with precision.">
      <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--honey)" }}>IGWM Advisor Portal</p>
      <h1 className="mt-3" style={{ fontFamily: "var(--font-serif)", fontSize: 40, fontWeight: 600, color: "var(--forest)" }}>Welcome, Advisor</h1>
      <p className="mt-2" style={{ color: "var(--warm-gray)" }}>Sign in to manage your client portfolios.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label className="ll-label">Email</label>
          <input type="email" className="ll-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="ll-label">Password</label>
          <input type="password" className="ll-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <button disabled={loading} type="submit" className="ll-pill ll-pill-primary w-full mt-2" style={{ opacity: loading ? 0.7 : 1 }}>
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
      <p className="mt-6 text-sm text-center"><Link to="/" style={{ color: "var(--honey)" }}>← Back to LegacyLink</Link></p>
    </AuthSplit>
  );
}
