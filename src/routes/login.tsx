import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AuthSplit } from "@/components/legacy/AuthSplit";
import { signIn } from "@/lib/legacy-auth";
import { provisionWallet } from "@/lib/wallet.functions";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "/dashboard",
  }),
  head: () => ({ meta: [{ title: "Sign in — LegacyLink" }] }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const provision = useServerFn(provisionWallet);
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.includes("@") || form.password.length < 6) {
      return toast.error("Enter a valid email and 6+ char password.");
    }
    setLoading(true);
    try {
      await signIn(form.email, form.password);
      // Provision custodial Solana wallet if it doesn't exist yet.
      try { await provision({ data: undefined } as never); } catch (e) { console.warn("wallet provisioning", e); }
      toast.success("Welcome back.");
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplit quote="The greatest gift you leave behind is certainty.">
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 44, fontWeight: 600, color: "var(--forest)" }}>Welcome back</h1>
      <p className="mt-2" style={{ color: "var(--warm-gray)" }}>Sign in to manage your legacy.</p>
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
      <p className="mt-6 text-sm text-center" style={{ color: "var(--warm-gray)" }}>
        New to LegacyLink? <Link to="/signup" style={{ color: "var(--honey)" }} className="font-medium">Create an account</Link>
      </p>
    </AuthSplit>
  );
}
