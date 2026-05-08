export type User = { name: string; email: string };
const KEY = "legacylink:user";
const ADVISOR_KEY = "legacylink:advisor";

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as User) : null;
}
export function setUser(u: User) {
  localStorage.setItem(KEY, JSON.stringify(u));
}
export function clearUser() {
  localStorage.removeItem(KEY);
}
export function getAdvisor(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(ADVISOR_KEY);
  return raw ? JSON.parse(raw) : null;
}
export function setAdvisor(u: User) {
  localStorage.setItem(ADVISOR_KEY, JSON.stringify(u));
}
export function clearAdvisor() {
  localStorage.removeItem(ADVISOR_KEY);
}
