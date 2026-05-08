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
  } catch {
    return defaultVaults;
  }
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

export const advisorClients = [
  { id: "c1", name: "Sarah Chen", email: "sarah@email.com", vaults: 3, total: 20700, last: "2 days ago" },
  { id: "c2", name: "Michael Okafor", email: "m.okafor@email.com", vaults: 1, total: 8000, last: "1 week ago" },
  { id: "c3", name: "Priya Sharma", email: "priya@email.com", vaults: 2, total: 15300, last: "Today" },
];

export function formatCAD(n: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(n) + " CAD";
}
