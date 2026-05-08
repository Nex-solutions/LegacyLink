// Auth/session layer for LegacyLink.
// Currently localStorage-backed mock. Designed so the same shape can be
// served by a real backend (Solana program reads + Supabase profile rows)
// without changing call sites.

export type User = { name: string; email: string };

export type Advisor = {
  firstName: string;
  lastName: string;
  email: string;
  firm: string;
  advisorType: string;
  province: string;
  license?: string;
};

const KEY = "legacylink:user";
const ADVISOR_KEY = "legacylink:advisor";

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export function getUser(): User | null { return read<User>(KEY); }
export function setUser(u: User) { localStorage.setItem(KEY, JSON.stringify(u)); }
export function clearUser() { localStorage.removeItem(KEY); }

export function getAdvisor(): Advisor | null { return read<Advisor>(ADVISOR_KEY); }
export function setAdvisor(a: Advisor) { localStorage.setItem(ADVISOR_KEY, JSON.stringify(a)); }
export function clearAdvisor() { localStorage.removeItem(ADVISOR_KEY); }

export function advisorDisplayName(a: Advisor) {
  return `${a.firstName} ${a.lastName}`.trim() || a.email.split("@")[0];
}

export function advisorInitials(a: Advisor) {
  const f = (a.firstName?.[0] || a.email[0] || "A").toUpperCase();
  const l = (a.lastName?.[0] || "").toUpperCase();
  return (f + l).slice(0, 2);
}
