// Auth/session layer for LegacyLink.
// Backed by real Supabase auth. We mirror a tiny {name,email} blob in
// localStorage so the existing sync `getUser()` callsites keep working —
// the source of truth is the Supabase session.

import { supabase } from "@/integrations/supabase/client";

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

export function getUser(): User | null {
  return read<User>(KEY);
}
export function setUser(u: User) {
  localStorage.setItem(KEY, JSON.stringify(u));
}
export function clearUser() {
  localStorage.removeItem(KEY);
}

export function getAdvisor(): Advisor | null {
  return read<Advisor>(ADVISOR_KEY);
}
export function setAdvisor(a: Advisor) {
  localStorage.setItem(ADVISOR_KEY, JSON.stringify(a));
}
export function clearAdvisor() {
  localStorage.removeItem(ADVISOR_KEY);
}

export function advisorDisplayName(a: Advisor) {
  return `${a.firstName} ${a.lastName}`.trim() || a.email.split("@")[0];
}

export function advisorInitials(a: Advisor) {
  const f = (a.firstName?.[0] || a.email[0] || "A").toUpperCase();
  const l = (a.lastName?.[0] || "").toUpperCase();
  return (f + l).slice(0, 2);
}

// ─── Supabase wrappers ────────────────────────────────────────────────

export async function signUp(name: string, email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/dashboard`,
      data: { display_name: name },
    },
  });
  if (error) throw error;
  if (data.session) setUser({ name, email });
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const name =
    (data.user?.user_metadata?.display_name as string | undefined) ?? email.split("@")[0];
  setUser({ name, email });
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
  clearUser();
  clearAdvisor();
}

// Hydrate the local mirror from the live Supabase session (called once on app
// boot via __root.tsx). Keeps the existing sync `getUser()` API correct.
export async function hydrateUserFromSession(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.user) {
    clearUser();
    return null;
  }
  const email = session.user.email ?? "";
  const name =
    (session.user.user_metadata?.display_name as string | undefined) ?? email.split("@")[0];
  const u = { name, email };
  setUser(u);
  return u;
}
