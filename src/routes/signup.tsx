import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AuthSplit } from "@/components/legacy/AuthSplit";
import { signUp } from "@/lib/legacy-auth";
import { provisionWallet } from "@/lib/wallet.functions";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [
    { title: "Create your account — LegacyLink" },
    { name: "description", content: "Create your secure LegacyLink vault in minutes." },
  ] }),
  component: Signup,
});

const FIRST = ["James", "Amara", "Noah", "Ada", "Liam", "Zara", "Ethan", "Maya", "Jordan", "Sofia", "Kai", "Naomi"];
const LAST = ["Okafor", "Adeyemi", "Chen", "Patel", "Nguyen", "Morgan", "Rivera", "Brooks", "Hassan", "Klein"];
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function makeFake() {
  const first = pick(FIRST);
  const last = pick(LAST);
  const num = Math.floor(100 + Math.random() * 9000);
  return {
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}${num}@demo.legacylink.app`,
    password: "demo1234!",
    confirm: "demo1234!",
  };
}

function Signup() {
  const navigate = useNavigate();
  const provision = useServerFn(provisionWallet);
  const [form, setForm] = useState(() => makeFake());
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.includes("@") || form.password.length < 6) return toast.error("Please enter a valid email and a password of 6+ characters.");
    if (form.password !== form.confirm) return toast.error("Passwords do not match.");
    setLoading(true);
    try {
      const { session } = await signUp(form.name || form.email.split("@")[0], form.email, form.password);
      if (!session) {
        toast.success("Check your email to confirm your account, then sign in.");
        navigate({ to: "/login" });
        return;
      }
      try { await provision({ data: undefined } as never); } catch (e) { console.warn("wallet provisioning", e); }
      toast.success("Account created. Let's verify your identity.");
      navigate({ to: "/signup/kyc" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign up failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
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
      <p className="mt-3 text-xs text-center" style={{ color: "var(--warm-gray)" }}>
        Are you an advisor? <Link to="/advisor/signup" style={{ color: "var(--honey)" }} className="font-medium">Create an advisor account →</Link>
      </p>
      <p className="mt-8 text-xs text-center" style={{ color: "var(--warm-gray)" }}>
        Your vault is created the moment you sign up — protected, private, and yours alone.
      </p>
    </AuthSplit>
  );
}
