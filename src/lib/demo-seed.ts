// Resets the demo to a curated, judge-friendly scenario:
//  • Vault A — time-locked, unlocks in 12 days (urgency)
//  • Vault B — inactivity, 175 of 180 days elapsed (warning)
//  • Vault C — manual, ready to release
//  • Vault D — already Released, awaiting beneficiary claim

import { saveVaults, type Vault } from "./legacy-data";

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoDaysAgo(days: number): string {
  return isoDaysFromNow(-days);
}

export function buildDemoVaults(): Vault[] {
  return [
    {
      id: "vault-demo-time",
      name: "Family Trust Alpha",
      amount_cad: 12000,
      status: "Active",
      condition: { kind: "time", unlock_date: isoDaysFromNow(12) },
      beneficiaries: [
        { name: "Amara Okafor", email: "amara@email.com", pct: 60 },
        { name: "Tobias Okafor", email: "tobias@email.com", pct: 40 },
      ],
      created_at: isoDaysAgo(120),
    },
    {
      id: "vault-demo-inactivity",
      name: "Kids Education Fund",
      amount_cad: 6200,
      status: "Active",
      condition: { kind: "inactivity", inactivity_days: 180, last_checkin: isoDaysAgo(175) },
      beneficiaries: [{ name: "Amara Okafor", email: "amara@email.com", pct: 100 }],
      created_at: isoDaysAgo(200),
    },
    {
      id: "vault-demo-manual",
      name: "Emergency Reserve",
      amount_cad: 2500,
      status: "Active",
      condition: { kind: "manual" },
      beneficiaries: [
        { name: "Ngozi Okafor", email: "ngozi@email.com", pct: 50 },
        { name: "Emeka Oriaku", email: "emeka@email.com", pct: 30 },
        { name: "Tobias Okafor", email: "tobias@email.com", pct: 20 },
      ],
      created_at: isoDaysAgo(60),
    },
    {
      id: "vault-demo-released",
      name: "Wedding Gift for Ada",
      amount_cad: 4500,
      status: "Released",
      condition: { kind: "manual" },
      beneficiaries: [{ name: "Ada Okafor", email: "ada@email.com", pct: 100 }],
      created_at: isoDaysAgo(30),
    },
  ];
}

export function resetDemo() {
  saveVaults(buildDemoVaults());
}
