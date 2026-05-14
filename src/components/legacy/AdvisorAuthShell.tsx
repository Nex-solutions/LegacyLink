import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

const credentials = [
  "Secure read-only client vault access",
  "Real-time portfolio monitoring",
  "Direct client invitation tools",
  "Works alongside any wealth practice",
];

export function AdvisorAuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2" style={{ background: "var(--cream)" }}>
      {/* Left forest panel */}
      <div
        className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden"
        style={{ background: "var(--forest)" }}
      >
        <div
          className="ll-blob ll-drift"
          style={{
            width: 460,
            height: 460,
            top: -140,
            right: -120,
            background: "var(--honey)",
            opacity: 0.16,
          }}
        />
        <div
          className="ll-blob ll-drift"
          style={{
            width: 360,
            height: 360,
            bottom: -120,
            left: -100,
            background: "var(--sage)",
            opacity: 0.2,
          }}
        />

        <Link to="/advisor" className="relative z-10 flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center"
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
              fontSize: 22,
              fontWeight: 600,
            }}
          >
            LegacyLink Advisor
          </span>
        </Link>

        {/* Center illustration */}
        <div className="relative z-10 max-w-lg">
          <svg viewBox="0 0 400 240" className="w-full max-w-md">
            <defs>
              <linearGradient id="briefcase" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#E8A020" />
                <stop offset="100%" stopColor="#7FA882" />
              </linearGradient>
            </defs>
            {/* Briefcase body */}
            <path
              d="M70 95 Q 70 75 90 75 L 310 75 Q 330 75 330 95 L 330 200 Q 330 220 310 220 L 90 220 Q 70 220 70 200 Z"
              fill="url(#briefcase)"
              opacity="0.88"
            />
            {/* Handle */}
            <path
              d="M160 75 Q 160 45 200 45 Q 240 45 240 75"
              fill="none"
              stroke="#FAFAF7"
              strokeWidth="6"
              opacity="0.9"
              strokeLinecap="round"
            />
            {/* Center seam */}
            <rect x="190" y="135" width="20" height="14" rx="3" fill="#1A2E1A" opacity="0.35" />
            <line
              x1="70"
              y1="142"
              x2="190"
              y2="142"
              stroke="#1A2E1A"
              strokeWidth="1.5"
              opacity="0.3"
            />
            <line
              x1="210"
              y1="142"
              x2="330"
              y2="142"
              stroke="#1A2E1A"
              strokeWidth="1.5"
              opacity="0.3"
            />
            {/* Soft accent dots */}
            <circle cx="120" cy="180" r="4" fill="#FAFAF7" opacity="0.5" />
            <circle cx="160" cy="195" r="3" fill="#FAFAF7" opacity="0.4" />
            <circle cx="270" cy="180" r="4" fill="#FAFAF7" opacity="0.5" />
          </svg>

          <p
            className="mt-10"
            style={{
              fontFamily: "var(--font-serif)",
              color: "var(--cream)",
              fontSize: 32,
              lineHeight: 1.18,
              fontWeight: 500,
              fontStyle: "italic",
            }}
          >
            Help your clients leave nothing to chance.
          </p>

          <ul className="mt-10 space-y-3">
            {credentials.map((c) => (
              <li
                key={c}
                className="flex items-center gap-3 text-sm"
                style={{ color: "rgba(250,250,247,0.72)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--honey)" }} />
                {c}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 text-xs" style={{ color: "rgba(250,250,247,0.55)" }}>
          © LegacyLink · For Canadian financial professionals
        </div>
      </div>

      {/* Right cream panel */}
      <div
        className="flex flex-col justify-center px-6 sm:px-12 py-12 relative"
        style={{ background: "var(--cream)" }}
      >
        <div className="lg:hidden mb-8">
          <Link to="/advisor" className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "var(--forest)" }}
            >
              <span
                style={{ color: "var(--honey)", fontFamily: "var(--font-serif)", fontWeight: 700 }}
              >
                L
              </span>
            </div>
            <span
              style={{
                fontFamily: "var(--font-serif)",
                color: "var(--forest)",
                fontSize: 20,
                fontWeight: 600,
              }}
            >
              LegacyLink Advisor
            </span>
          </Link>
        </div>
        <div className="w-full max-w-md mx-auto">{children}</div>
      </div>
    </div>
  );
}
