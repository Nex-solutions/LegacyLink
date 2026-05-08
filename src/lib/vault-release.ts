// Auto-release evaluator. Runs on dashboard / vault load and flips any vault
// whose condition has been met to "Released" in localStorage. Keeps the demo
// honest: time vaults release on their unlock_date, inactivity vaults release
// when the silence window has been exceeded.

import { differenceInDays, parseISO } from "date-fns";
import { getVaults, saveVaults, type Vault } from "./legacy-data";

export function shouldRelease(v: Vault): boolean {
  if (v.status !== "Active") return false;
  const c = v.condition;
  if (c.kind === "time") {
    return new Date() >= parseISO(c.unlock_date);
  }
  if (c.kind === "inactivity") {
    const elapsed = differenceInDays(new Date(), parseISO(c.last_checkin));
    return elapsed >= c.inactivity_days;
  }
  return false;
}

// Walks all vaults, releases any that meet their condition. Returns the IDs
// of vaults that were just released (so callers can toast).
export function evaluateReleases(): string[] {
  const vaults = getVaults();
  const released: string[] = [];
  const next = vaults.map((v) => {
    if (shouldRelease(v)) {
      released.push(v.id);
      return { ...v, status: "Released" as const };
    }
    return v;
  });
  if (released.length) saveVaults(next);
  return released;
}

// Plain-English summary of when/how a vault releases.
export function conditionSummary(v: Vault): string {
  const c = v.condition;
  if (c.kind === "time") return `Releases on ${c.unlock_date}`;
  if (c.kind === "inactivity")
    return `Releases after ${c.inactivity_days} days without a check-in`;
  return "Released manually by the owner";
}
