import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AuthSplit } from "@/components/legacy/AuthSplit";
import { supabase } from "@/integrations/supabase/client";
import { submitKyc, getMyKycStatus } from "@/lib/paytrie-onboarding.functions";

export const Route = createFileRoute("/signup_/kyc")({
  head: () => ({ meta: [{ title: "Verify your identity — LegacyLink" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ reason: typeof s.reason === "string" ? s.reason : undefined }),
  component: SignupKyc,
});

const PROVINCES = [
  ["AB", "Alberta"], ["BC", "British Columbia"], ["MB", "Manitoba"],
  ["NB", "New Brunswick"], ["NL", "Newfoundland and Labrador"],
  ["NS", "Nova Scotia"], ["ON", "Ontario"], ["PE", "Prince Edward Island"],
  ["QC", "Quebec"], ["SK", "Saskatchewan"], ["NT", "Northwest Territories"],
  ["NU", "Nunavut"], ["YT", "Yukon"],
] as const;

function SignupKyc() {
  const navigate = useNavigate();
  const submit = useServerFn(submitKyc);
  const status = useServerFn(getMyKycStatus);
  const [loading, setLoading] = useState(false);
  const [verificationLink, setVerificationLink] = useState<string | null>(null);
  const [simulated, setSimulated] = useState(false);
  const [form, setForm] = useState({
    first_name: "", last_name: "", phone: "", dob: "",
    address1: "", address2: "", city: "", province: "ON",
    postal: "", occupation: "", pep: false, tpd: false,
  });

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) { navigate({ to: "/login" }); return; }
      const meta = sess.session.user.user_metadata as { display_name?: string } | undefined;
      const fallback = (meta?.display_name ?? "").trim();
      const [fbFirst, ...fbRest] = fallback.split(/\s+/);
      const fbLast = fbRest.join(" ");
      try {
        const s = await status({ data: undefined } as never);
        setForm((f) => ({
          ...f,
          first_name: s.firstName || fbFirst || f.first_name,
          last_name: s.lastName || fbLast || f.last_name,
        }));
        if (s.verificationLink) setVerificationLink(s.verificationLink);
      } catch {
        if (fbFirst) setForm((f) => ({ ...f, first_name: fbFirst, last_name: fbLast }));
      }
    })();
  }, [navigate, status]);

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.first_name || !form.last_name) return toast.error("Please enter your full legal name.");
    if (!form.dob) return toast.error("Date of birth is required.");
    if (!form.address1 || !form.city || !form.postal) return toast.error("Please complete your address.");
    if (!form.occupation) return toast.error("Occupation is required.");
    setLoading(true);
    try {
      const r = await submit({ data: form });
      setVerificationLink(r.verificationLink);
      setSimulated(r.simulated);
      toast.success("Identity verification link ready.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't submit KYC.");
    } finally { setLoading(false); }
  }

  if (verificationLink) {
    return (
      <AuthSplit quote="Identity verified once. Trusted forever.">
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 36, fontWeight: 600, color: "var(--forest)" }}>
          One last step
        </h1>
        <p className="mt-3" style={{ color: "var(--warm-gray)" }}>
          Click below to complete identity verification with our compliance partner. It usually takes under 3 minutes.
        </p>
        {simulated && (
          <div className="mt-4 text-xs px-3 py-2 rounded" style={{ background: "var(--sage)", color: "var(--forest)" }}>
            Dev mode — Paytrie credentials not configured. This link is simulated.
          </div>
        )}
        <a href={verificationLink} target="_blank" rel="noreferrer"
           className="ll-pill ll-pill-primary w-full mt-6 inline-flex items-center justify-center"
           style={{ height: 52 }}>
          Verify my identity →
        </a>
        <button onClick={() => navigate({ to: "/dashboard" })}
                className="mt-4 w-full text-sm" style={{ color: "var(--warm-gray)" }}>
          Skip for now — I'll verify before creating a trust
        </button>
      </AuthSplit>
    );
  }

  return (
    <AuthSplit quote="A verified identity protects every legacy you build.">
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 32, fontWeight: 600, color: "var(--forest)" }}>
        Now let's get to know you better
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--warm-gray)" }}>
        Required by Canadian regulations to fund your vault. Takes 2 minutes.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="ll-label">Legal first name</label>
            <input className="ll-input" value={form.first_name} onChange={(e) => update("first_name", e.target.value)} /></div>
          <div><label className="ll-label">Legal last name</label>
            <input className="ll-input" value={form.last_name} onChange={(e) => update("last_name", e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="ll-label">Date of birth</label>
            <input type="date" className="ll-input" value={form.dob} onChange={(e) => update("dob", e.target.value)} /></div>
          <div><label className="ll-label">Phone</label>
            <input className="ll-input" placeholder="4165551234" value={form.phone} onChange={(e) => update("phone", e.target.value)} /></div>
        </div>
        <div><label className="ll-label">Address</label>
          <input className="ll-input" placeholder="123 Main Street" value={form.address1} onChange={(e) => update("address1", e.target.value)} /></div>
        <div><label className="ll-label">Apartment / Unit (optional)</label>
          <input className="ll-input" value={form.address2} onChange={(e) => update("address2", e.target.value)} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="ll-label">City</label>
            <input className="ll-input" value={form.city} onChange={(e) => update("city", e.target.value)} /></div>
          <div><label className="ll-label">Province</label>
            <select className="ll-input" value={form.province} onChange={(e) => update("province", e.target.value)}>
              {PROVINCES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select></div>
          <div><label className="ll-label">Postal</label>
            <input className="ll-input" placeholder="M5V1A1" value={form.postal} onChange={(e) => update("postal", e.target.value)} /></div>
        </div>
        <div><label className="ll-label">Occupation</label>
          <input className="ll-input" placeholder="Software Engineer" value={form.occupation} onChange={(e) => update("occupation", e.target.value)} /></div>
        <label className="flex items-start gap-2 text-sm pt-1" style={{ color: "var(--warm-gray)" }}>
          <input type="checkbox" className="mt-1 accent-[var(--honey)]" checked={form.pep} onChange={(e) => update("pep", e.target.checked)} />
          I am a Politically Exposed Person (PEP).
        </label>
        <label className="flex items-start gap-2 text-sm" style={{ color: "var(--warm-gray)" }}>
          <input type="checkbox" className="mt-1 accent-[var(--honey)]" checked={form.tpd} onChange={(e) => update("tpd", e.target.checked)} />
          I am acting on behalf of a third party.
        </label>

        <button disabled={loading} type="submit" className="ll-pill ll-pill-primary w-full mt-2" style={{ height: 52, opacity: loading ? 0.7 : 1 }}>
          {loading ? "Preparing verification…" : "Continue"}
        </button>
        <Link to="/dashboard" className="block text-center text-xs mt-2" style={{ color: "var(--warm-gray)" }}>
          Skip for now — I'll verify before creating a trust
        </Link>
      </form>
    </AuthSplit>
  );
}
