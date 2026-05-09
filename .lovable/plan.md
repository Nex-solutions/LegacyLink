## Goal

When judges click the "View on Solana Explorer" link after KYC, the wallet address currently shows "Account does not exist" because Solana doesn't track addresses until they hold lamports. Make the link prove the wallet is real.

## Approach (per your selection: airdrop + note)

**1. Airdrop on wallet creation** — `src/lib/wallet.server.ts`

In `ensureCustodialWallet`, after the new wallet row is inserted, request a small devnet SOL airdrop so the address materializes on-chain. Reuse the existing pattern from `solana.server.ts` (`requestAirdrop` + `confirmTransaction`, wrapped in try/catch so rate limits never block signup).

- Amount: 0.01 SOL (enough to register the account; small enough to be friendly to devnet faucet limits)
- Wrap in try/catch; log warning on failure; never throw
- Only airdrop on first creation, not on lookup of an existing wallet

**2. Return airdrop status to the client** — `src/lib/wallet.functions.ts`

Extend `provisionWallet` return shape from `{ pubkey }` to `{ pubkey, airdropSig?: string, airdropFailed?: boolean }` so the UI can show the right note.

**3. Update KYC success note** — `src/routes/signup_.kyc.tsx`

In the "Demo wallet created on Solana devnet" panel:
- If `airdropSig` is present: show two links — "View address ↗" and "View funding tx ↗" — plus subtext: "Funded with 0.01 devnet SOL so the address is live on-chain."
- If `airdropFailed` is true: keep the address link and add subtext: "Address reserved — devnet faucet is rate-limited right now; it will activate on your first vault transaction."
- While provisioning is in flight: keep the existing "Provisioning your custodial wallet…" state.

## Out of scope

- No DB migration needed (no schema change).
- No changes to vault create / funds history links — those already point to real tx_signatures that exist on devnet.
- Not switching RPC endpoints or adding a faucet retry queue.

## Files touched

- `src/lib/wallet.server.ts` — airdrop after insert
- `src/lib/wallet.functions.ts` — extend return shape
- `src/routes/signup_.kyc.tsx` — render the two-link / fallback states