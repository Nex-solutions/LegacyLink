import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Blob, PageShell } from "@/components/legacy/PageShell";
import { getAdvisor, setAdvisor, advisorInitials, type Advisor } from "@/lib/legacy-auth";

export const Route = createFileRoute("/advisor/profile")({
  head: () => ({ meta: [{ title: "Advisor Profile — LegacyLink" }] }),
  component: AdvisorProfile,
});

const PROVINCES = [
  "Alberta",
  "British Columbia",
  "Manitoba",
  "New Brunswick",
  "Newfoundland and Labrador",
  "Nova Scotia",
  "Ontario",
  "Prince Edward Island",
  "Quebec",
  "Saskatchewan",
  "Northwest Territories",
  "Nunavut",
  "Yukon",
  "Outside Canada",
];

const ADVISOR_TYPES = [
  "Financial Advisor",
  "Estate Planner",
  "Wealth Manager",
  "Insurance Advisor",
  "Independent Advisor",
  "Other",
];

const NOTIFICATIONS = [
  { key: "vault_created", label: "Client creates a vault", default: true },
  { key: "vault_released", label: "Vault releases automatically", default: true },
  { key: "client_inactive", label: "Client inactive 30+ days", default: true },
  { key: "beneficiary_added", label: "Client adds beneficiaries", default: false },
  { key: "weekly_summary", label: "Weekly portfolio summary email", default: true },
] as const;

function AdvisorProfile() {
  const navigate = useNavigate();
  const [advisor, setAdvisorState] = useState<Advisor | null>(null);
  const [notifs, setNotifs] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTIFICATIONS.map((n) => [n.key, n.default])),
  );

  useEffect(() => {
    const a = getAdvisor();
    if (!a) navigate({ to: "/advisor/login" });
    else setAdvisorState(a);
  }, [navigate]);

  if (!advisor) return null;

  function update<K extends keyof Advisor>(k: K, v: Advisor[K]) {
    setAdvisorState((a) => (a ? { ...a, [k]: v } : a));
  }

  function save() {
    if (advisor) setAdvisor(advisor);
    toast.success("Profile saved.");
  }

  return (
    <PageShell>
      <header
        className="px-6 lg:px-12 py-5 flex items-center justify-between"
        style={{ background: "var(--forest)" }}
      >
        <Link to="/advisor/dashboard" className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "var(--honey)" }}
          >
            <span
              style={{ color: "var(--forest)", fontFamily: "var(--font-serif)", fontWeight: 700 }}
            >
              L
            </span>
          </div>
          <span
            style={{
              fontFamily: "var(--font-serif)",
              color: "var(--cream)",
              fontSize: 20,
              fontWeight: 600,
            }}
          >
            LegacyLink
          </span>
        </Link>
        <Link
          to="/advisor/dashboard"
          className="text-sm"
          style={{ color: "rgba(250,250,247,0.8)" }}
        >
          ← Back to dashboard
        </Link>
      </header>

      <section className="relative max-w-4xl mx-auto px-6 lg:px-12 py-14">
        <Blob
          className="w-[420px] h-[420px] -top-32 -right-20"
          color="var(--sage)"
          opacity={0.08}
        />
        <div className="relative z-10">
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 38,
              fontWeight: 600,
              color: "var(--forest)",
            }}
          >
            My Profile
          </h1>
          <p className="mt-2" style={{ color: "var(--warm-gray)" }}>
            Manage how clients see you and what you get notified about.
          </p>

          {/* Identity card */}
          <div className="ll-card p-8 mt-8">
            <div className="flex items-center gap-5">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-semibold"
                style={{
                  background: "var(--honey)",
                  color: "var(--forest)",
                  fontFamily: "var(--font-serif)",
                }}
              >
                {advisorInitials(advisor)}
              </div>
              <div>
                <button
                  onClick={() => toast("Photo upload available soon.")}
                  className="text-sm font-medium"
                  style={{ color: "var(--honey)" }}
                >
                  Upload Photo
                </button>
                <p className="text-[12px] mt-1" style={{ color: "var(--warm-gray)" }}>
                  JPG or PNG, up to 4MB
                </p>
              </div>
            </div>

            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              <Field
                label="First Name"
                value={advisor.firstName}
                onChange={(v) => update("firstName", v)}
              />
              <Field
                label="Last Name"
                value={advisor.lastName}
                onChange={(v) => update("lastName", v)}
              />
              <Field label="Email" value={advisor.email} onChange={(v) => update("email", v)} />
              <Field
                label="Firm or Organization"
                value={advisor.firm}
                onChange={(v) => update("firm", v)}
              />
              <SelectField
                label="Advisor Type"
                value={advisor.advisorType}
                options={ADVISOR_TYPES}
                onChange={(v) => update("advisorType", v)}
              />
              <SelectField
                label="Province"
                value={advisor.province}
                options={PROVINCES}
                onChange={(v) => update("province", v)}
              />
              <Field
                label="License Number"
                value={advisor.license || ""}
                onChange={(v) => update("license", v)}
              />
            </div>
          </div>

          {/* Notifications */}
          <div className="ll-card p-8 mt-6">
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 22,
                fontWeight: 600,
                color: "var(--forest)",
              }}
            >
              Notification preferences
            </h2>
            <div className="mt-5 divide-y" style={{ borderColor: "rgba(26,46,26,0.08)" }}>
              {NOTIFICATIONS.map((n) => (
                <div key={n.key} className="flex items-center justify-between py-4">
                  <span className="text-sm" style={{ color: "var(--forest)" }}>
                    {n.label}
                  </span>
                  <Toggle
                    on={notifs[n.key]}
                    onChange={(v) => setNotifs((p) => ({ ...p, [n.key]: v }))}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button onClick={save} className="ll-pill ll-pill-secondary">
              Save Changes
            </button>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="ll-label">{label}</label>
      <input className="ll-input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="ll-label">{label}</label>
      <select className="ll-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      type="button"
      className="relative w-11 h-6 rounded-full transition-colors"
      style={{ background: on ? "var(--honey)" : "rgba(26,46,26,0.18)" }}
      aria-pressed={on}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
        style={{ left: on ? "calc(100% - 22px)" : "2px", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}
      />
    </button>
  );
}
