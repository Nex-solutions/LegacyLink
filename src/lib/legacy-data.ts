// LegacyLink mock data layer.
// Vault, beneficiary, client, activity types — designed so the shape mirrors
// what the future backend (Solana program accounts + a Postgres mirror) will
// return. All write ops go through these helpers so swapping to a real
// service later is a one-file change.

export type Beneficiary = { name: string; email: string; pct: number };

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
};

const STORAGE_KEY = "legacylink:vaults";

const defaultVaults: Vault[] = [
  {
    id: "vault-001",
    name: "Family Trust Alpha",
    amount_cad: 4200,
    status: "Active",
    condition: { kind: "time", unlock_date: "2026-12-01" },
    beneficiaries: [
      { name: "Amara Okafor", email: "amara@email.com", pct: 60 },
      { name: "Tobias Okafor", email: "tobias@email.com", pct: 40 },
    ],
    created_at: "2026-02-12",
  },
  {
    id: "vault-002",
    name: "Kids Education Fund",
    amount_cad: 2700,
    status: "Active",
    condition: { kind: "inactivity", inactivity_days: 180, last_checkin: "2026-04-15" },
    beneficiaries: [{ name: "Amara Okafor", email: "amara@email.com", pct: 100 }],
    created_at: "2026-03-02",
  },
  {
    id: "vault-003",
    name: "Emergency Reserve",
    amount_cad: 1550,
    status: "Active",
    condition: { kind: "manual" },
    beneficiaries: [
      { name: "Ngozi Okafor", email: "ngozi@email.com", pct: 50 },
      { name: "Emeka Oriaku", email: "emeka@email.com", pct: 30 },
      { name: "Tobias Okafor", email: "tobias@email.com", pct: 20 },
    ],
    created_at: "2026-01-20",
  },
];

export function getVaults(): Vault[] {
  if (typeof window === "undefined") return defaultVaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultVaults));
      return defaultVaults;
    }
    return JSON.parse(raw) as Vault[];
  } catch { return defaultVaults; }
}

export function saveVaults(vaults: Vault[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vaults));
}

export function getVault(id: string): Vault | undefined {
  return getVaults().find((v) => v.id === id);
}

export function updateVault(id: string, patch: Partial<Vault>) {
  const vaults = getVaults().map((v) => (v.id === id ? { ...v, ...patch } : v));
  saveVaults(vaults);
}

export function addVault(v: Vault) {
  const vaults = [v, ...getVaults()];
  saveVaults(vaults);
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
