import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthSplit } from "@/components/legacy/AuthSplit";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset your password — LegacyLink" }] }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return toast.error("Enter a valid email.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Check your inbox for the reset link.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't send reset email.");
    } finally { setLoading(false); }
  }

  return (
    <AuthSplit quote="Every legacy deserves a second chance.">
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 36, fontWeight: 600, color: "var(--forest)" }}>
        Forgot your password?
      </h1>
      <p className="mt-2" style={{ color: "var(--warm-gray)" }}>
        Enter your email and we'll send you a link to reset it.
      </p>
      {sent ? (
        <div className="mt-8 p-4 rounded-md text-sm" style={{ background: "var(--sage)", color: "var(--forest)" }}>
          We've sent a password reset link to <strong>{email}</strong>. Check your inbox (and spam folder).
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <label className="ll-label">Email</label>
            <input type="email" className="ll-input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button disabled={loading} type="submit" className="ll-pill ll-pill-primary w-full mt-2" style={{ opacity: loading ? 0.7 : 1 }}>
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
      <p className="mt-6 text-sm text-center" style={{ color: "var(--warm-gray)" }}>
        Remembered it? <Link to="/login" style={{ color: "var(--honey)" }} className="font-medium">Sign in</Link>
      </p>
    </AuthSplit>
  );
}
