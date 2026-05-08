import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthSplit } from "@/components/legacy/AuthSplit";
import { setUser } from "@/lib/legacy-auth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — LegacyLink" }] }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.includes("@") || form.password.length < 6) return toast.error("Enter a valid email and 6+ char password.");
    setLoading(true);
    setTimeout(() => {
      setUser({ name: "James Okafor", email: form.email });
      toast.success("Welcome back, James.");
      navigate({ to: "/dashboard" });
    }, 2000);
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
