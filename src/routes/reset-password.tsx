import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthSplit } from "@/components/legacy/AuthSplit";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set a new password — LegacyLink" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase handles the recovery hash automatically and emits PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Also accept existing session (e.g. clicked link, then refreshed)
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) return toast.error("Password must be 6+ characters.");
    if (pw !== confirm) return toast.error("Passwords don't match.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      toast.success("Password updated. You're signed in.");
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't update password.");
    } finally { setLoading(false); }
  }

  return (
    <AuthSplit quote="A fresh start, secured.">
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 36, fontWeight: 600, color: "var(--forest)" }}>
        Set a new password
      </h1>
      <p className="mt-2" style={{ color: "var(--warm-gray)" }}>
        {ready ? "Choose a strong password you haven't used before." : "Verifying your reset link…"}
      </p>
      {ready && (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <label className="ll-label">New password</label>
            <input type="password" className="ll-input" value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <div>
            <label className="ll-label">Confirm password</label>
            <input type="password" className="ll-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <button disabled={loading} type="submit" className="ll-pill ll-pill-primary w-full mt-2" style={{ opacity: loading ? 0.7 : 1 }}>
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
    </AuthSplit>
  );
}
