## Goal

Let families edit a vault's release condition after it's created — change the unlock date, the inactivity window, or switch between condition types entirely (time / inactivity / manual).

## Where it lives

A new **"Release Conditions"** card in `src/routes/vault.$id.tsx`, sitting in the right column above the existing **Actions** card (next to the Trustees panel). Read-only by default with a **Change** button that flips it into edit mode — same pattern as the Trustees panel.

## Edit modes

Three tabs inside the editor matching the three condition kinds:

1. **Time-locked** — Shadcn date picker for unlock date. Validation: must be at least 1 day in the future.
2. **Inactivity** — number input for days (7–3650 range) + read-only "last check-in" line. Switching *into* inactivity from another type seeds `last_checkin` to today.
3. **Manual** — no inputs; just a confirmation that the owner controls release.

## Rules

- Only available when `vault.status === "Active"`.
- On save: writes via `updateVault(vault.id, { condition: ... })`, refreshes local state, toast confirmation, and appends an activity entry of kind `condition_update` (added to the existing in-memory timeline list).
- Can't shorten an inactivity window below the days already elapsed since last check-in (would cause an instant release) — show inline warning.
- Cancel reverts edits.

## Files touched

- `src/routes/vault.$id.tsx` — add `ConditionPanel` component, render it, wire `onChange` to `updateVault`. The hero subtitle and the existing `TimeCondition` / `InactivityCondition` cards already read from `vault.condition`, so they'll update automatically.

No data-layer or schema changes — `Vault.condition` already supports all three kinds in `legacy-data.ts`. (Backend wiring to Supabase is still tracked separately.)
