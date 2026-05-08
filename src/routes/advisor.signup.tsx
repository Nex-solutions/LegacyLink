import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AdvisorAuthShell } from "@/components/legacy/AdvisorAuthShell";
import { setAdvisor } from "@/lib/legacy-auth";

export const Route = createFileRoute("/advisor/signup")({
  head: () => ({ meta: [{ title: "Create Advisor Account — LegacyLink" }] }),
  component: AdvisorSignup,
});

const PROVINCES = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick",
  "Newfoundland and Labrador", "Nova Scotia", "Ontario", "Prince Edward Island",
  "Quebec", "Saskatchewan", "Northwest Territories", "Nunavut", "Yukon",
  "Outside Canada",
];

const ADVISOR_TYPES = [
  "Financial Advisor", "Estate Planner", "Wealth Manager",
  "Insurance Advisor", "Independent Advisor", "Other",
];

function AdvisorSignup() {
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    firm: "",
    advisorType: "Financial Advisor",
    license: "",
    province: "Ontario",
    password: "",
    confirm: "",
    agree: false,
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName || !form.lastName) return toast.error("Please enter your full name.");
    if (!/.+@.+\..+/.test(form.email)) return toast.error("Enter a valid work email.");
    if (!form.firm) return toast.error("Please add your firm or organization.");
    if (form.password.length < 6) return toast.error("Password must be 6+ characters.");
    if (form.password !== form.confirm) return toast.error("Passwords don't match.");
    if (!form.agree) return toast.error("Please confirm the advisor terms.");

    setLoading(true);
    setTimeout(() => {
      setAdvisor({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        firm: form.firm,
        advisorType: form.advisorType,
        province: form.province,
        license: form.license || undefined,
      });
      toast.success("Welcome to LegacyLink Advisor.");
      navigate({ to: "/advisor/dashboard" });
    }, 2000);
  }

  return (
    <AdvisorAuthShell>
      <span className="inline-block text-xs px-3 py-1 rounded-full font-medium"
        style={{ background: "var(--sage)", color: "var(--forest)" }}>
        For Financial Advisors & Estate Planners
      </span>

      <h1 className="mt-4" style={{ fontFamily: "var(--font-serif)", fontSize: 32, fontWeight: 600, color: "var(--forest)" }}>
        Create Advisor Account
      </h1>
      <p className="mt-2 text-base" style={{ color: "var(--warm-gray)" }}>
        Monitor your clients' estate vaults, track releases, and invite new clients —
        all from one dashboard.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="ll-label">First Name</label>
            <input className="ll-input" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
          </div>
          <div>
            <label className="ll-label">Last Name</label>
            <input className="ll-input" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
          </div>
        </div>

        <div>
          <label className="ll-label">Work Email</label>
          <input type="email" className="ll-input" placeholder="you@yourfirm.com"
            value={form.email} onChange={(e) => update("email", e.target.value)} />
          <p className="mt-1.5 text-xs" style={{ color: "rgba(74,74,74,0.65)" }}>Use your professional email</p>
        </div>

        <div>
          <label className="ll-label">Firm or Organization</label>
          <input className="ll-input" placeholder="e.g. Raymond James, Edward Jones, Independent Practice"
            value={form.firm} onChange={(e) => update("firm", e.target.value)} />
          <p className="mt-1.5 text-xs" style={{ color: "rgba(74,74,74,0.65)" }}>Independent advisors welcome</p>
        </div>

        <div>
          <label className="ll-label">Advisor Type</label>
          <select className="ll-input" value={form.advisorType} onChange={(e) => update("advisorType", e.target.value)}>
            {ADVISOR_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="ll-label">License Number <span style={{ color: "rgba(74,74,74,0.55)" }}>(optional)</span></label>
          <input className="ll-input" placeholder="e.g. CFP-XXXXX"
            value={form.license} onChange={(e) => update("license", e.target.value)} />
          <p className="mt-1.5 text-xs" style={{ color: "rgba(74,74,74,0.65)" }}>Helps verify your credentials with clients</p>
        </div>

        <div>
          <label className="ll-label">Province</label>
          <select className="ll-input" value={form.province} onChange={(e) => update("province", e.target.value)}>
            {PROVINCES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>

        <div>
          <label className="ll-label">Password</label>
          <div className="relative">
            <input type={showPw ? "text" : "password"} className="ll-input pr-16"
              value={form.password} onChange={(e) => update("password", e.target.value)} />
            <button type="button" onClick={() => setShowPw((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
              style={{ color: "var(--honey)" }}>
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div>
          <label className="ll-label">Confirm Password</label>
          <input type={showPw ? "text" : "password"} className="ll-input"
            value={form.confirm} onChange={(e) => update("confirm", e.target.value)} />
        </div>

        <label className="flex items-start gap-3 mt-2 cursor-pointer">
          <input type="checkbox" className="mt-1 accent-[var(--honey)] w-4 h-4"
            checked={form.agree} onChange={(e) => update("agree", e.target.checked)} />
          <span className="text-sm" style={{ color: "var(--warm-gray)" }}>
            I confirm I am a licensed financial professional and agree to the
            LegacyLink Advisor Terms of Service.
          </span>
        </label>

        <button disabled={loading} type="submit"
          className="ll-pill ll-pill-primary w-full mt-2"
          style={{ height: 52, opacity: loading ? 0.7 : 1 }}>
          {loading ? "Setting up your portal…" : "Create Advisor Account"}
        </button>
      </form>

      <p className="mt-6 text-sm text-center" style={{ color: "var(--warm-gray)" }}>
        Already have an account?{" "}
        <Link to="/advisor/login" style={{ color: "var(--honey)", fontWeight: 500 }}>
          Sign in →
        </Link>
      </p>
      <p className="mt-3 text-xs text-center" style={{ color: "var(--warm-gray)" }}>
        Are you an individual?{" "}
        <Link to="/signup" style={{ color: "var(--honey)", fontWeight: 500 }}>
          Create an individual account →
        </Link>
      </p>
      <p className="mt-6 text-xs text-center" style={{ color: "rgba(74,74,74,0.6)" }}>
        🔒 Advisor accounts are for licensed financial professionals only.
      </p>
    </AdvisorAuthShell>
  );
}
