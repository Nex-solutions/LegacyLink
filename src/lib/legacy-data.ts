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
  status: "Active" | "Released" | "Pending" | "Failed" | "Draft";
  condition: VaultCondition;
  beneficiaries: Beneficiary[];
  created_at: string;
  tx_signature?: string | null;
  failure_count?: number;
  last_step?: string | null;
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

// ────────────────────────────────────────────────────────────────────
// Advisor analytics — derived from the mock client book
// ────────────────────────────────────────────────────────────────────

export type AdvisorRisk = {
  id: string;
  clientId: string;
  clientName: string;
  vaultId: string;
  vaultName: string;
  severity: "high" | "medium" | "low";
  kind: "inactivity" | "concentration" | "no-beneficiary";
  message: string;
};

export function advisorRisks(): AdvisorRisk[] {
  const out: AdvisorRisk[] = [];
  for (const c of advisorClients) {
    for (const v of c.vaultDetail) {
      if (v.condition.kind === "inactivity") {
        const days = Math.max(
          0,
          Math.floor((Date.now() - new Date(v.condition.last_checkin).getTime()) / 86400000),
        );
        const pct = days / v.condition.inactivity_days;
        if (pct >= 0.7) {
          out.push({
            id: `${v.id}-inact`,
            clientId: c.id,
            clientName: c.name,
            vaultId: v.id,
            vaultName: v.name,
            severity: pct >= 0.9 ? "high" : "medium",
            kind: "inactivity",
            message: `${Math.round(pct * 100)}% to inactivity threshold (${days}/${v.condition.inactivity_days} days)`,
          });
        }
      }
      if (v.beneficiaries.length === 0) {
        out.push({
          id: `${v.id}-noben`,
          clientId: c.id,
          clientName: c.name,
          vaultId: v.id,
          vaultName: v.name,
          severity: "high",
          kind: "no-beneficiary",
          message: "No beneficiaries assigned",
        });
      } else if (v.beneficiaries.length === 1 && v.amount_cad >= 10000) {
        out.push({
          id: `${v.id}-conc`,
          clientId: c.id,
          clientName: c.name,
          vaultId: v.id,
          vaultName: v.name,
          severity: "low",
          kind: "concentration",
          message: "Single beneficiary on a large vault — consider diversifying",
        });
      }
    }
  }
  return out.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 } as const;
    return order[a.severity] - order[b.severity];
  });
}

export type UpcomingRelease = {
  clientId: string;
  clientName: string;
  vaultId: string;
  vaultName: string;
  amount_cad: number;
  daysAway: number;
  date: string;
  kind: "time" | "inactivity";
};

export function upcomingReleases(windowDays = 90): UpcomingRelease[] {
  const out: UpcomingRelease[] = [];
  const now = Date.now();
  for (const c of advisorClients) {
    for (const v of c.vaultDetail) {
      if (v.condition.kind === "time") {
        const target = new Date(v.condition.unlock_date).getTime();
        const days = Math.floor((target - now) / 86400000);
        if (days >= 0 && days <= windowDays) {
          out.push({
            clientId: c.id, clientName: c.name, vaultId: v.id, vaultName: v.name,
            amount_cad: v.amount_cad, daysAway: days, date: v.condition.unlock_date, kind: "time",
          });
        }
      } else if (v.condition.kind === "inactivity") {
        const last = new Date(v.condition.last_checkin).getTime();
        const target = last + v.condition.inactivity_days * 86400000;
        const days = Math.floor((target - now) / 86400000);
        if (days >= 0 && days <= windowDays) {
          out.push({
            clientId: c.id, clientName: c.name, vaultId: v.id, vaultName: v.name,
            amount_cad: v.amount_cad, daysAway: days,
            date: new Date(target).toISOString().slice(0, 10), kind: "inactivity",
          });
        }
      }
    }
  }
  return out.sort((a, b) => a.daysAway - b.daysAway);
}

export type BookBeneficiary = {
  name: string;
  clientId: string;
  clientName: string;
  vaultId: string;
  vaultName: string;
  amount_cad: number;
  flag?: string;
};

export function allBeneficiaries(): BookBeneficiary[] {
  const out: BookBeneficiary[] = [];
  for (const c of advisorClients) {
    for (const v of c.vaultDetail) {
      const split = v.beneficiaries.length || 1;
      for (const b of v.beneficiaries) {
        out.push({
          name: b.name,
          clientId: c.id,
          clientName: c.name,
          vaultId: v.id,
          vaultName: v.name,
          amount_cad: v.amount_cad / split,
          flag:
            v.beneficiaries.length === 1 && v.amount_cad >= 10000
              ? "Sole beneficiary on large vault"
              : undefined,
        });
      }
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function findClient(id: string): AdvisorClient | undefined {
  return advisorClients.find((c) => c.id === id);
}

export function exportBookCSV(): string {
  const rows: string[][] = [
    ["Client", "Email", "Vault", "Amount CAD", "Status", "Condition", "Beneficiaries"],
  ];
  for (const c of advisorClients) {
    for (const v of c.vaultDetail) {
      const cond =
        v.condition.kind === "time"
          ? `Time · ${v.condition.unlock_date}`
          : v.condition.kind === "inactivity"
            ? `Inactivity · ${v.condition.inactivity_days}d`
            : "Manual";
      rows.push([
        c.name, c.email, v.name, String(v.amount_cad), v.status, cond,
        v.beneficiaries.map((b) => b.name).join("; "),
      ]);
    }
  }
  return rows.map((r) => r.map((x) => `"${x.replace(/"/g, '""')}"`).join(",")).join("\n");
}
