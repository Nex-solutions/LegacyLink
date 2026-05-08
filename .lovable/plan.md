# Plan: Confirm-funding step + Send PDF to beneficiaries

## 1. Funding flow — require explicit confirmation

In `src/routes/create.tsx` (Step 0):

- Selecting a method (Card / Interac) only sets `funding` — it does NOT start processing or mark `funded`.
- Below the method tiles, show a payment confirmation panel once `funding` is selected:
  - Shows: amount, method, "This is a simulated payment for demo purposes."
  - Primary button: **"Confirm payment of $X"** → runs the existing 2s mock then sets `funded = true`.
  - Secondary button: **"Change method"** → clears `funding`.
- "Continue →" remains disabled until `funded === true`.
- Tile click no longer auto-fires `fund()`.

## 2. PDF generation (legacy letter + claim instructions)

- Add `jspdf` dependency (pure JS, Worker-friendly — but PDF will be generated **client-side** in the browser to keep server simple).
- New file `src/lib/beneficiary-pdf.ts` exporting `generateBeneficiaryPdf({ ownerName, vaultName, amountCAD, condition, beneficiary, claimUrl, letterMessage })` → returns a `Blob`.
- Layout (one PDF per beneficiary):
  - Header: "LegacyLink — A message for {beneficiary.name}"
  - Personal letter body (from `vaults.letter_message`, fallback to a default message)
  - "Your share: {pct}% of CA${amount} = CA${their amount}"
  - Release condition summary
  - Claim instructions: "Visit {claimUrl} and enter your claim token: {token}"
  - Footer with vault ID

## 3. "Send PDF" action on dashboard

- On each `VaultCard` (in `src/components/legacy/VaultCard.tsx`) and on `src/routes/vault.$id.tsx`, add a **"Send PDF to beneficiaries"** button (visible to the owner).
- Click flow:
  1. Calls a new server fn `getVaultPdfData(vaultId)` returning vault + beneficiaries (incl. claim_token, generating one if missing via existing token flow).
  2. For each beneficiary, generate the PDF in the browser, then trigger a download (`<a download="LegacyLink-{name}.pdf">`).
  3. Toast: "PDFs ready — {n} files downloaded. Forward each to its beneficiary."
- Note: actual emailing is out of scope for this turn (no email infra wired yet); user gets downloadable PDFs to share manually. If the user later wants automated email, we can add transactional email next.

## 4. Server function — `getVaultPdfData`

In `src/lib/vault.functions.ts`:
- Auth-protected, owner-only.
- Returns `{ vault, beneficiaries }` where each beneficiary has a guaranteed `claim_token` (generate + persist with `crypto.randomUUID()` if null).

## Technical details

- Files touched:
  - `src/routes/create.tsx` — Step 0 confirm UI
  - `src/lib/beneficiary-pdf.ts` (new)
  - `src/lib/vault.functions.ts` — add `getVaultPdfData`
  - `src/components/legacy/VaultCard.tsx` — add button + handler
  - `src/routes/vault.$id.tsx` — add button + handler
- Dependency: `bun add jspdf`
- Claim URL pattern: `${window.location.origin}/claim?vault={vaultId}&token={token}`
- No DB schema change required (uses existing `claim_token` and `letter_message` columns).
