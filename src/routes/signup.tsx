import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthSplit } from "@/components/legacy/AuthSplit";
import { setUser } from "@/lib/legacy-auth";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create your account — LegacyLink" }, { name: "description", content: "Create your secure LegacyLink vault in minutes." }] }),
  component: Signup,
});

function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.includes("@") || form.password.length < 6) return toast.error("Please enter a valid email and a password of 6+ characters.");
    if (form.password !== form.confirm) return toast.error("Passwords do not match.");
    setLoading(true);
    setTimeout(() => {
      setUser({ name: form.name || form.email.split("@")[0], email: form.email });
      toast.success("Welcome to LegacyLink.");
      navigate({ to: "/dashboard" });
    }, 2000);
  }

  return (
    <AuthSplit quote="The greatest gift you leave behind is certainty.">
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 40, fontWeight: 600, color: "var(--forest)" }}>Create your account</h1>
      <p className="mt-2" style={{ color: "var(--warm-gray)" }}>Begin protecting what matters in under 10 minutes.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label className="ll-label">Full Name</label>
          <input className="ll-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="James Okafor" />
        </div>
        <div>
          <label className="ll-label">Email</label>
          <input type="email" className="ll-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" />
        </div>
        <div>
          <label className="ll-label">Password</label>
          <input type="password" className="ll-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 6 characters" />
        </div>
        <div>
          <label className="ll-label">Confirm Password</label>
          <input type="password" className="ll-input" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        </div>
        <button disabled={loading} type="submit" className="ll-pill ll-pill-primary w-full mt-2" style={{ opacity: loading ? 0.7 : 1 }}>
          {loading ? "Creating your vault…" : "Create Account"}
        </button>
      </form>
      <p className="mt-6 text-sm text-center" style={{ color: "var(--warm-gray)" }}>
        Already have an account? <Link to="/login" style={{ color: "var(--honey)" }} className="font-medium">Sign in</Link>
      </p>
      <p className="mt-8 text-xs text-center" style={{ color: "var(--warm-gray)" }}>
        Your vault is created the moment you sign up — protected, private, and yours alone.
      </p>
    </AuthSplit>
  );
}
