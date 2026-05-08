## Goal

Ship a hackathon-ready demo of LegacyLink by closing the biggest gaps: real backend persistence, end-to-end release → claim flow, demo seed data, landing polish, and a downloadable "legacy letter" PDF per vault. **Skip Solana / on-chain wallet wiring for now** — leave the existing UI mentions in place but don't build wallet connect.

## Scope (in order of demo impact)

### 1. Wire vaults + auth to Lovable Cloud (replace localStorage)

Backend tables already exist (`vaults`, `beneficiaries`, `vault_events`, `profiles`, `user_roles`, `advisor_clients`) with RLS. The app currently stores everything in `localStorage` via `legacy-data.ts` and a fake `legacy-auth.ts`.

- Replace `legacy-auth.ts` with real Supabase auth (email + password, plus Google). Keep the same exported function names (`getUser`, `setUser`, `clearUser`) so call sites don't churn — they become thin wrappers around `supabase.auth`.
- Rewrite `legacy-data.ts` helpers (`getVaults`, `getVault`, `updateVault`, `addVault`) to read/write the `vaults` + `beneficiaries` tables. Map the Postgres row shape (`condition_kind` + `unlock_date` + `inactivity_days` + `last_checkin`) into the existing `VaultCondition` discriminated union so UI components don't change.
- Convert activity timeline to real `vault_events` inserts (`fund`, `checkin`, `release`, `condition_update`, etc.).
- Update `signup.tsx`, `login.tsx`, `advisor.signup.tsx`, `advisor.login.tsx` to call Supabase. Advisor role is set via `user_roles` (the `handle_new_user` trigger defaults to `family`, so advisor signup will need a follow-up insert into `user_roles`).
- Add `_authenticated` layout route guard (TanStack pattern) so `/dashboard`, `/vault/$id`, `/messages`, `/advisor/dashboard`, etc. redirect to login when signed out.

### 2. End-to-end release → claim flow

- **Release trigger**: on dashboard load and vault detail load, evaluate each active vault's condition client-side. If `time` and `unlock_date <= today`, OR `inactivity` and `now - last_checkin >= inactivity_days`, flip status to `Released` (writes `vault_events` row of kind `release`). Manual vaults get a "Release now" button on the detail page.
- **Inactivity check-in button** on vault detail (visible only for inactivity vaults): resets `last_checkin = now()`, logs `checkin` event, toast confirmation.
- **Claim flow**: rebuild `/claim` so a beneficiary can enter their email + a vault ID (or follow a link `/claim?vault=...`). If they're listed in `beneficiaries` and the vault is `Released`, show their share, a "claimed" confirmation step, and write a `payout_tx_signature` placeholder (`demo-{uuid}`) on the beneficiary row. After claim: small celebratory screen.

### 3. Demo seed + reset

- A "Reset demo data" button (dev-only, behind a tiny gear icon on the dashboard footer) that: signs in a demo family account, wipes their vaults, and inserts a curated scenario:
  - Vault A: time-locked, unlocks in 12 days (shows urgency banner)
  - Vault B: inactivity, last check-in 175 days ago, 180-day window (shows warning)
  - Vault C: manual, ready to release
  - Vault D: already `Released`, awaiting beneficiary claim (drives the demo's claim story)
- Optional second seed for the advisor account so `/advisor/dashboard` has live clients.

### 4. Legacy letter PDF (per vault)

- New "Download legacy letter" button on the vault detail page.
- Generated client-side with `pdf-lib` (Worker-safe). Contains: vault name, owner name, condition summary in plain English, beneficiary list with percentages, created date, and a heartfelt template message the owner can edit before download.
- Add an inline textarea above the button so the owner can customize the message; current text is saved to a new `letter_message` column on `vaults` (migration).

### 5. Landing page polish (`/`)

- Real hero with one strong sentence + sub, single screenshot of the dashboard, "How it works" 3-step strip (Create → Fund → Release to family), and a clearer CTA pair (Get started / Advisor portal).
- Update meta tags (title/description/og) on `/`, `/dashboard`, `/vault/$id`, `/advisor/dashboard`.

### 6. Hold for later (explicitly out of scope)

- Solana wallet connect, on-chain vault PDA, payout tx signing, Anchor program calls. Existing `solana_pubkey` / `tx_signature` columns stay nullable and untouched. UI keeps the existing mentions but no wiring.

## Files touched

**New**
- `src/routes/_authenticated.tsx` (auth guard layout)
- `src/routes/reset-password.tsx` (required for password reset flow)
- `src/lib/vault-release.ts` (condition evaluation + auto-release)
- `src/lib/legacy-letter.ts` (pdf-lib generation)
- `src/lib/demo-seed.ts` (reset demo button logic)

**Rewritten**
- `src/lib/legacy-auth.ts` → Supabase wrapper
- `src/lib/legacy-data.ts` → Supabase queries
- `src/routes/login.tsx`, `signup.tsx`, `advisor.login.tsx`, `advisor.signup.tsx` → real auth
- `src/routes/claim.tsx` → real claim flow
- `src/routes/index.tsx` → polished landing

**Edited**
- `src/routes/vault.$id.tsx` → check-in button, manual release button, PDF letter section, message editor
- `src/routes/dashboard.tsx` → release evaluation on load, demo reset button
- `src/routes/advisor.dashboard.tsx` → real client list from `advisor_clients`

**DB migration**
- Add `letter_message text` to `vaults`
- Add `claimed_at timestamptz` to `beneficiaries`
- Add a SQL function `seed_demo_for_user(uuid)` that wipes + inserts the demo scenario (called from the reset button via RPC)

## Order of execution

1. DB migration (letter_message, claimed_at, seed RPC)
2. Real auth + `_authenticated` guard + Google sign-in
3. `legacy-data.ts` rewrite against Supabase, keeping the public API stable
4. Release evaluator + check-in + manual release UI
5. Claim flow rebuild
6. Demo seed button
7. Legacy letter PDF
8. Landing polish + meta tags

Each step ends in a working app — we can stop early if time runs out and still have a stronger demo than today.

## Notes on auth

- Default to email/password + Google per Lovable Cloud guidance.
- Do **not** enable auto-confirm email; users verify email before login (standard).
- Advisor signup writes an extra row to `user_roles` with role `advisor` after the signup callback.
- Password reset gets `/reset-password` page (required to avoid the silent auto-login bug).
