## Goal

Make the advisor side a "wow, this is what I actually need" tool: deepen client visibility, add the workflow features advisors keep asking for, and ship a real read-only client + vault detail page (today the "View Full Detail →" just toasts "coming soon").

## What advisors actually wish they had

Talking to estate planners / wealth advisors, the recurring asks are:

1. **A real read-only client view** — full vault details, beneficiaries, condition timeline, audit trail, all without being able to mutate anything.
2. **Risk + compliance signals at a glance** — who's at risk of inactivity release, who hasn't checked in, who has unfunded vaults, who has beneficiary issues (no email, 100% concentration, missing wallet).
3. **Tasks / follow-ups** — "Remind me to call the Okafors next Tuesday", with a small task list per client.
4. **Document & note vault** — private advisor-only notes per client (KYC summary, meeting notes, planning rationale). Read-only as far as the client is concerned, never shown to them.
5. **Beneficiary roster across the book** — one place to see every beneficiary across all clients, with search and concentration warnings.
6. **Pipeline of upcoming releases** — chronological list of "what fires in the next 90 days" across the whole book.
7. **Export & reporting** — per-client PDF summary they can email a lawyer/accountant, plus a CSV book export.
8. **Client check-in nudges** — one-click "send check-in reminder" for inactivity-triggered vaults that are >70% to threshold.
9. **AI assist (optional)** — "Summarize this client's estate plan in 4 bullets I can paste into my CRM."

## Plan

### 1. Read-only client + vault detail page (the missing primary flow)

New route: `/advisor/client/$clientId` — built from the existing mock `advisorClients` data, no schema changes.

Layout:
- Header: client avatar, name, email, status pill, "Since {date}", advisor-only badge "Read-only access"
- Summary strip: total protected, vaults, beneficiaries, last activity, next release
- Tabs: **Vaults** · **Beneficiaries** · **Activity** · **Notes** · **Tasks**
- All buttons are inert except advisor-private ones (notes, tasks). No check-in, no funding, no edits — every potentially-mutating control is replaced with a "Read-only · ask client" tooltip.

New route: `/advisor/client/$clientId/vault/$vaultId` — full vault read-only view:
- Vault name, amount, status, condition (with countdown), letter preview (if any), beneficiaries with %, claim status, on-chain refs (PDA, init tx) shown as muted mono text with copy buttons, full event timeline.
- Top-right: "Download vault summary (PDF)" + "Message client about this vault".

Wire the existing "View Portfolio →" expansion's "View Full Detail →" button (currently just toasts) to link into this page.

### 2. Advisor dashboard upgrades

In `src/routes/advisor.dashboard.tsx`:

- **Risk panel** (new card in right column, above Recent Activity): "Needs your attention" — auto-derived list:
  - Inactivity vaults >70% to threshold → "Nudge {client} to check in" button
  - Vaults with 0 beneficiaries or 100% to one beneficiary → "Concentration risk"
  - Unfunded / pending vaults older than 7 days
  - Released vaults with unclaimed beneficiaries >30 days
- **Upcoming releases timeline** (new section, full width below client list): horizontal 90-day strip with markers per release, click → opens that vault's read-only detail.
- **Book-wide beneficiaries** (new tab toggle on the client list: `Clients | Beneficiaries`): table of every beneficiary across the book, with their client, %, and a flag column.
- **Quick-action additions**: "Send check-in reminder", "Open beneficiary roster", "Export book (CSV)".
- **Per-client inline actions** on the client card: "Open detail" (links to new route), "Add note", "Add task", "Message".

### 3. Advisor-private notes & tasks

New module `src/lib/advisor-workspace.ts` (localStorage-backed, mirrors the existing legacy-data pattern):
- `getNotes(clientId)`, `addNote(clientId, body)`, `deleteNote(noteId)`
- `getTasks(clientId?)`, `addTask({clientId, title, due})`, `toggleTask(id)`, `deleteTask(id)`

These are advisor-local — never shown on the family dashboard. Surfaced in the client detail page (Notes & Tasks tabs) and a global "My Tasks" widget on the advisor dashboard.

### 4. Per-client PDF summary

Reuse `src/lib/beneficiary-pdf.ts` patterns to add `src/lib/client-summary-pdf.ts`:
- Client name, advisor name, date, total protected, vault table (name, amount, condition, beneficiaries), open risks. One-pager. Triggered from client detail header and from the existing "Download Client Report" modal (which currently just calls `window.print()`).

### 5. Optional AI summary (Lovable AI)

Add a "Summarize plan" button on the client detail page that calls a `createServerFn` using Lovable AI Gateway (`google/gemini-2.5-flash`) with the client's vaults/beneficiaries as input and returns 4 bullets. Pure read-only, advisor-only output, copyable. No DB writes.

### Files

New:
- `src/routes/advisor.client.$clientId.tsx`
- `src/routes/advisor.client.$clientId.vault.$vaultId.tsx`
- `src/lib/advisor-workspace.ts`
- `src/lib/client-summary-pdf.ts`
- `src/lib/advisor-ai.functions.ts` (only if AI summary is included)

Edited:
- `src/routes/advisor.dashboard.tsx` — risk panel, upcoming-releases strip, beneficiaries tab, new quick actions, link "View Full Detail →" to the new route
- `src/lib/legacy-data.ts` — add a couple of derived helpers (risk computation, upcoming-90-day list, all-beneficiaries roll-up) on top of existing mock data

### Out of scope (intentionally)

- No DB schema changes — everything rides on existing `advisorClients` mock + localStorage for advisor-private workspace.
- No write access to client vaults from the advisor side, ever. Read-only is enforced by simply not rendering mutating controls.

## Questions before I build

1. Should I include the **Lovable AI "Summarize plan"** button, or skip AI for now?
2. For **Notes & Tasks**, localStorage-only is fine for the demo — confirm, or do you want them persisted in the database (new tables + RLS)?
3. Anything in the "wishlist" above you want me to **drop** to keep it tight, or is "ship them all" the right call?
