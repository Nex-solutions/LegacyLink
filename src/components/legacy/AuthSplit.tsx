import type { ReactNode } from "react";
import { Logo } from "./Nav";

export function AuthSplit({ children, quote }: { children: ReactNode; quote: string }) {
  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2" style={{ background: "var(--cream)" }}>
      {/* Left side */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden" style={{ background: "var(--forest)" }}>
        <div className="ll-blob ll-drift" style={{ width: 480, height: 480, top: -120, right: -160, background: "var(--honey)", opacity: 0.18 }} />
        <div className="ll-blob ll-drift" style={{ width: 360, height: 360, bottom: -120, left: -100, background: "var(--sage)", opacity: 0.22 }} />
        <div className="relative z-10">
          <Logo light />
        </div>
        <div className="relative z-10 max-w-lg">
          <p style={{ fontFamily: "var(--font-serif)", color: "var(--cream)", fontSize: 44, lineHeight: 1.15, fontWeight: 500 }}>
            "{quote}"
          </p>
          {/* Organic SVG */}
          <svg viewBox="0 0 400 240" className="mt-12 w-full max-w-md">
            <defs>
              <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#E8A020" />
                <stop offset="100%" stopColor="#7FA882" />
              </linearGradient>
            </defs>
            <path
              d="M40 200 C 60 80, 200 20, 380 60 C 320 160, 200 220, 40 200 Z"
              fill="url(#leaf)"
              opacity="0.85"
            />
            <path
              d="M60 200 C 120 140, 220 110, 340 110"
              fill="none"
              stroke="#1A2E1A"
              strokeWidth="2"
              opacity="0.45"
            />
            <circle cx="120" cy="170" r="6" fill="#1A2E1A" opacity="0.5" />
            <circle cx="220" cy="140" r="5" fill="#1A2E1A" opacity="0.5" />
            <circle cx="300" cy="120" r="4" fill="#1A2E1A" opacity="0.5" />
          </svg>
        </div>
        <div className="relative z-10 text-xs" style={{ color: "rgba(250,250,247,0.6)" }}>
          © LegacyLink · Built for Canadian families
        </div>
      </div>

      {/* Right side */}
      <div className="flex flex-col justify-center px-6 sm:px-12 py-12 relative">
        <div className="lg:hidden mb-8"><Logo /></div>
        <div className="w-full max-w-md mx-auto">{children}</div>
      </div>
    </div>
  );
}
