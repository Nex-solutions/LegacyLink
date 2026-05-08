// LegacyLink mock data layer.
// Vault, beneficiary, client, activity types — designed so the shape mirrors
// what the future backend (Solana program accounts + a Postgres mirror) will
// return. All write ops go through these helpers so swapping to a real
// service later is a one-file change.

export type Beneficiary = {
  name: string;
  email: string;
  pct: number;
  id?: string;
  claimed_at?: string | null;
  claim_token?: string | null;
};

export type VaultCondition =
  | { kind: "time"; unlock_date: string }
  | { kind: "inactivity"; inactivity_days: number; last_checkin: string }
  | { kind: "manual" };

export type Vault = {
  id: string;
  name: string;
  amount_cad: number;
  status: "Active" | "Released" | "Pending";
  condition: VaultCondition;
  beneficiaries: Beneficiary[];
  created_at: string;
  // Per-vault advisor access. Owners must explicitly grant — advisors never
  // see a vault unless their email is in this list. Mirrors the future
  // `vault_advisors` join table on the backend.
  advisor_emails?: string[];
};

// In-memory cache of vaults, hydrated from the real backend by
// `hydrateVaultsFromServer()` (called from page loaders). All sync
// readers (`getVaults`, `getVault`) continue to work — they just hit
// the cache. Writes that need to persist call server functions; they
// also patch the cache so the UI stays responsive.

let _cache: Vault[] = [];
const _listeners = new Set<() => void>();

function notify() { _listeners.forEach((fn) => fn()); }

export function subscribeVaults(fn: () => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function setVaultsCache(next: Vault[]) {
  _cache = next;
  notify();
}

export function getVaults(): Vault[] {
  return _cache;
}

export function getVault(id: string): Vault | undefined {
  return _cache.find((v) => v.id === id);
}

export function updateVault(id: string, patch: Partial<Vault>) {
  _cache = _cache.map((v) => (v.id === id ? { ...v, ...patch } : v));
  notify();
}

export function addVault(v: Vault) {
  _cache = [v, ..._cache];
  notify();
}

export function saveVaults(vaults: Vault[]) {
  setVaultsCache(vaults);
}

// ────────────────────────────────────────────────────────────────────
// Advisor portfolio (mock book of clients)
// ────────────────────────────────────────────────────────────────────

export type ClientStatus = "active" | "quiet" | "inactive";

export type ClientVault = {
  id: string;
  name: string;
  amount_cad: number;
  status: "Active" | "Released" | "Pending";
  condition: VaultCondition;
  beneficiaries: { name: string }[];
};

export type AdvisorClient = {
  id: string;
  name: string;
  email: string;
  vaults: number;
  total: number;
  since: string;            // e.g. "Aug 2024"
  lastActiveDays: number;   // days since last check-in / activity
  status: ClientStatus;
  alert?: string;
  conditionTypes: Array<"time" | "inactivity" | "manual">;
  vaultDetail: ClientVault[];
};

export const advisorClients: AdvisorClient[] = [
  {
    id: "c1",
    name: "Sarah Chen",
    email: "sarah@email.com",
    vaults: 3,
    total: 20700,
    since: "Aug 2024",
    lastActiveDays: 0,
    status: "active",
    alert: "1 vault releasing in 12 days — review recommended",
    conditionTypes: ["time", "inactivity", "manual"],
    vaultDetail: [
      {
        id: "sc-1", name: "Family Trust Alpha", amount_cad: 12000, status: "Active",
        condition: { kind: "time", unlock_date: "2026-05-20" },
        beneficiaries: [{ name: "Amara Chen" }, { name: "Leo Chen" }],
      },
      {
        id: "sc-2", name: "Kids Education", amount_cad: 6200, status: "Active",
        condition: { kind: "inactivity", inactivity_days: 180, last_checkin: "2026-05-01" },
        beneficiaries: [{ name: "Amara Chen" }],
      },
      {
        id: "sc-3", name: "Emergency Reserve", amount_cad: 2500, status: "Active",
        condition: { kind: "manual" },
        beneficiaries: [{ name: "Daniel Chen" }],
      },
    ],
  },
  {
    id: "c2",
    name: "Michael Okafor",
    email: "m.okafor@email.com",
    vaults: 1,
    total: 8000,
    since: "Jan 2025",
    lastActiveDays: 3,
    status: "active",
    conditionTypes: ["time"],
    vaultDetail: [
      {
        id: "mo-1", name: "Daughter's Wedding Fund", amount_cad: 8000, status: "Active",
        condition: { kind: "time", unlock_date: "2027-06-01" },
        beneficiaries: [{ name: "Ngozi Okafor" }],
      },
    ],
  },
  {
    id: "c3",
    name: "Priya Sharma",
    email: "priya@email.com",
    vaults: 2,
    total: 15300,
    since: "Mar 2024",
    lastActiveDays: 34,
    status: "inactive",
    alert: "Client has been inactive for 34 days",
    conditionTypes: ["inactivity", "manual"],
    vaultDetail: [
      {
        id: "ps-1", name: "Retirement Bridge", amount_cad: 11000, status: "Active",
        condition: { kind: "inactivity", inactivity_days: 90, last_checkin: "2026-04-04" },
        beneficiaries: [{ name: "Aarav Sharma" }, { name: "Maya Sharma" }],
      },
      {
        id: "ps-2", name: "Charitable Gift", amount_cad: 4300, status: "Active",
        condition: { kind: "manual" },
        beneficiaries: [{ name: "BC Children's Hospital" }],
      },
    ],
  },
];

export type ActivityKind = "fund" | "checkin" | "release" | "warning" | "beneficiary";

export type ActivityEvent = {
  id: string;
  client: string;
  title: string;
  detail: string;
  when: string;
  kind: ActivityKind;
};

export const activityFeed: ActivityEvent[] = [
  { id: "e1", client: "Sarah Chen", title: "Sarah Chen funded a new vault", detail: "$4,200 CAD · Family Trust Alpha", when: "3 days ago", kind: "fund" },
  { id: "e2", client: "Michael Okafor", title: "Michael Okafor checked in", detail: "Emergency Reserve", when: "1 week ago", kind: "checkin" },
  { id: "e3", client: "Priya Sharma", title: "Inactivity warning triggered", detail: "Retirement Bridge · 30 day threshold", when: "1 week ago", kind: "warning" },
  { id: "e4", client: "Priya Sharma", title: "Priya Sharma added a beneficiary", detail: "Retirement Bridge", when: "2 weeks ago", kind: "beneficiary" },
  { id: "e5", client: "Sarah Chen", title: "Sarah Chen created a new vault", detail: "Education Fund", when: "1 month ago", kind: "fund" },
];

export function formatCAD(n: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n) + " CAD";
}

export function advisorTotals() {
  const clients = advisorClients.length;
  const aum = advisorClients.reduce((a, c) => a + c.total, 0);
  const vaults = advisorClients.reduce((a, c) => a + c.vaults, 0);
  const upcoming = advisorClients.filter((c) => c.alert?.includes("releasing")).length;
  return { clients, aum, vaults, upcoming };
}
