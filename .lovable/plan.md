## Goal
Let the vault creator write a "will/letter" message that is anchored on Solana (devnet) at vault creation, and revealed to the beneficiary on the claim screen while funds are being on-ramped. Show the on-chain memo tx (Solscan link) on both the creation success screen and the vault card.

Yes — this is a strong addition. It is cheap (one extra memo tx using the SPL Memo program), gives reviewers a second on-chain artifact, and adds emotional payoff to the claim flow.

## What changes

### 1. Capture the message at creation
- `src/routes/create.tsx`: add an optional textarea "Letter to your beneficiary" (max ~280 chars to keep memo tx cheap). Pass it into `createVault({ data: { ..., letter_message } })`.
- `src/lib/vault.functions.ts` (`createVault`): accept `letter_message` in the input validator, persist it on the `vaults` row (column already exists), and trigger the memo anchor below.

### 2. Anchor the message on-chain
- `src/lib/proof-tx.server.ts`: add `anchorLetterMessage({ userId, vaultId, message })` that:
  - loads the user's custodial wallet (already used for sweep),
  - builds a tx with a single SPL Memo program instruction (`MemoSig1111...`) containing a small JSON payload `{ v: vaultId, m: message }`,
  - signs with the user's system wallet (so the memo lives "in their wallet"),
  - sends with the same fresh-blockhash + retry pattern we already use for sweeps,
  - returns the signature.
- Save the signature to a new column `letter_tx_signature` on `vaults` (migration, see below).
- Insert a `vault_events` row of kind `fund` (or new `letter`) with `tx_signature` so it appears in history.

### 3. Show it back to the user
- `src/routes/create.tsx` success screen: if `letter_tx_signature` returned, show "Letter anchored on-chain · View on Solscan ↗".
- `src/components/legacy/VaultCard.tsx`: add a small "Letter tx ↗" pill next to the existing claim/payout pills.

### 4. Reveal at claim
- `src/lib/vault.functions.ts` (`getClaimByToken` / equivalent loader): include `letter_message` and `letter_tx_signature` in the claim payload.
- `src/routes/claim.tsx`: after successful claim, while the on-ramp progress is shown, render the letter in a serif card titled "A message from {owner}" with a "Verify on Solana ↗" link to the memo tx.

### 5. Database
Migration adds one nullable column:
- `vaults.letter_tx_signature text`

(`letter_message` already exists on the table.)

## Failure handling
The memo tx is non-critical. If it fails, vault creation still succeeds — we log the error, leave `letter_tx_signature` null, and the claim screen falls back to showing the letter without the Solscan link. No retry loop is added to keep the create flow snappy.

## Out of scope
- Encrypting the message (devnet demo, plaintext memo is intentional so reviewers can read it on Solscan).
- Editing the letter after creation.
- Long letters (>280 chars) — we cap in the UI.
