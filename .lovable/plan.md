## Goal

Make LegacyLink truly backend + on-chain for the hackathon, while keeping the UX completely "Web2" — users never see a wallet, seed phrase, or signature prompt. Funds move via a custodial USDC vault on Solana devnet, with on/off-ramp stubbed behind a single provider-agnostic interface so we can swap in MoonPay / Transak / Stripe later.

## Architecture (one-screen view)

```text
 Family user                      Lovable Cloud (Supabase)              Solana devnet
 ───────────                      ──────────────────────────             ────────────────
 Sign up (email/Google)  ──►  auth.users + profiles                            │
                              + custodial_wallets (encrypted)  ───┐            │
 Add money (CAD)         ──►  /api/onramp  (server route) ────────┼──► On-ramp provider
                                  │                                │     (stub: Transak)
                                  └──► funds USDC ATA of user wallet ──► transfer to vault PDA
 Create vault            ──►  vaults row + Anchor `init_vault` ix ─────► Vault PDA (USDC ATA)
 Check-in / release      ──►  vault_events + Anchor `checkin`/`release` ix
 Beneficiary claim       ──►  /claim → server fn → Anchor `claim` ix ──► transfers USDC to
                                                                          beneficiary off-ramp ATA
                              then /api/offramp  ────────────────────► Off-ramp provider
                                                                          (stub: pays CAD to email)
```

Key principle: **all signing happens server-side** with the custodial keypair stored encrypted in Supabase. The browser never touches a wallet adapter.

## Scope

### 1. Supabase migration (no more localStorage)

- Real auth: email + password + Google via `lovable.auth.signInWithOAuth("google")`. Add `_authenticated` layout guard + `/reset-password` page.
- Rewrite `src/lib/legacy-auth.ts` as a thin Supabase wrapper (same exports).
- Rewrite `src/lib/legacy-data.ts` to read/write `vaults`, `beneficiaries`, `vault_events` via `createServerFn` + `requireSupabaseAuth` (RLS already in place).
- Update `signup.tsx`, `login.tsx`, `advisor.signup.tsx`, `advisor.login.tsx`, `dashboard.tsx`, `vault.$id.tsx`, `advisor.dashboard.tsx`, `claim.tsx`.
- Advisor signup inserts a row into `user_roles` with role `advisor` (via SECURITY DEFINER RPC, since `user_roles` has no INSERT policy).

### 2. Custodial wallets (invisible to user)

DB migration:
- `custodial_wallets`: `user_id uuid PK`, `pubkey text`, `encrypted_secret bytea`, `created_at`. RLS: owner read-only of `pubkey` only; service-role writes.
- Encryption: AES-GCM with `WALLET_ENCRYPTION_KEY` (32-byte secret).
- Trigger on new auth user: enqueue wallet creation; or generate lazily on first funding via server fn `ensureWallet()`.

Add columns:
- `vaults.vault_pda text`, `vaults.usdc_ata text`, `vaults.init_tx text`
- `beneficiaries.wallet_pubkey text` (auto-resolved from email if beneficiary already has a LegacyLink account; else generated at claim time), `beneficiaries.payout_tx_signature` (already exists), `beneficiaries.claimed_at timestamptz`

### 3. Anchor program (`programs/legacy_vault`)

Written in Rust, deployed to devnet by the user. Folder: `anchor/` at repo root.

Instructions:
- `init_vault(vault_id: [u8;16], condition: VaultCondition, beneficiaries: Vec<Beneficiary>)` — creates vault PDA seeded by `["vault", owner, vault_id]`, creates the vault's USDC ATA owned by the PDA.
- `fund(amount: u64)` — transfers USDC from owner ATA to vault ATA via SPL Token CPI.
- `checkin()` — writes `last_checkin = clock.unix_timestamp` (inactivity vaults only).
- `release()` — owner-only or auto-eligible (time/inactivity met); flips status to `Released`.
- `claim(beneficiary_index: u8)` — anyone can call; checks `Released` + not yet claimed + signer is the beneficiary's recorded pubkey; transfers `pct * vault_balance` to beneficiary ATA.
- Accounts: `Vault { owner, condition_kind, unlock_ts, inactivity_secs, last_checkin, status, beneficiaries: Vec<{pubkey, pct, claimed}> }`.

Tests: Anchor mocha tests covering happy paths + error cases. Devnet USDC mint: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`.

We commit a `Cargo.toml`, `Anchor.toml`, the program source, and an `idl/legacy_vault.json` (generated). The app reads the IDL via `@coral-xyz/anchor`.

### 4. Server-side on-chain wiring

New `src/lib/solana.server.ts` (server-only):
- Loads custodial keypair from `custodial_wallets` (decrypts).
- Builds + signs + sends Anchor txs via `@coral-xyz/anchor` + `@solana/web3.js` against `SOLANA_RPC_URL` (devnet default, configurable).

Server functions (all `requireSupabaseAuth`, all in `*.functions.ts` files in `src/lib/`):
- `createVaultOnChain` — mirrors `vaults` insert + `init_vault` ix; stores `vault_pda`, `init_tx`.
- `fundVaultOnChain(vaultId, amountUsdc)` — calls on-ramp first (step 5), then `fund` ix.
- `checkInOnChain(vaultId)`
- `releaseVaultOnChain(vaultId)` (manual + auto-evaluated)
- `claimOnChain(vaultId, beneficiaryEmail)` — verifies email matches an authed user OR a magic-link claim token; calls `claim` ix; triggers off-ramp.

All write a `vault_events` row with the real `tx_signature`.

### 5. On/off-ramp abstraction

`src/lib/ramps.server.ts` defines:

```ts
interface RampProvider {
  onramp(input: { userId, amountCad, destinationPubkey }): Promise<{ usdcAmount, providerRef }>;
  offramp(input: { recipientEmail, usdcAmount, sourcePubkey }): Promise<{ providerRef }>;
}
```

- Default impl `MockRampProvider` → instantly mints devnet USDC to the destination ATA (using a faucet keypair) for on-ramp; logs off-ramp + emails recipient with a "funds sent" placeholder. Lets the demo run end-to-end **today**.
- Provider selection via env `RAMP_PROVIDER=mock|transak|moonpay|stripe`. Adapters are empty stubs with TODOs + the auth headers each one expects.
- Server route `src/routes/api/public/ramp-webhook.ts` with HMAC verification for future real provider callbacks.

Secrets we'll request when you're ready to go live: `TRANSAK_API_KEY` / `MOONPAY_SECRET_KEY` / `STRIPE_SECRET_KEY` (only one needed). Not requested now.

### 6. Claim UX (still invisible)

`/claim?vault=...&token=...`:
- Magic link emailed to beneficiary on release.
- Beneficiary signs in (or signs up) with the email on the beneficiary record.
- Server fn validates token + email, runs `claimOnChain`, calls off-ramp, shows "$X CAD on its way to you" with the on-chain explorer link.

### 7. Demo seed (updated)

`seed_demo_for_user(uuid)` RPC + a "Reset demo" button: wipes user's vaults, creates 4 scenarios on devnet (uses the mock ramp to fund them with test USDC). Vault D is pre-released and has a beneficiary token ready to demo the claim flow.

### 8. Out of scope this round

- Real KYC; real fiat settlement; production ramp integration.
- Wallet adapter / non-custodial mode (user said invisible; we stay custodial).
- Mainnet deployment.

## Files

**New**
- `anchor/Anchor.toml`, `anchor/Cargo.toml`, `anchor/programs/legacy_vault/src/lib.rs`, `anchor/tests/legacy_vault.ts`
- `src/idl/legacy_vault.json` + `src/idl/legacy_vault.ts` (types)
- `src/lib/solana.server.ts`
- `src/lib/wallet.server.ts` (encrypt/decrypt keypair)
- `src/lib/ramps.server.ts` + `src/lib/ramps/{mock,transak,moonpay,stripe}.ts`
- `src/lib/vault.functions.ts`, `src/lib/claim.functions.ts`, `src/lib/wallet.functions.ts`
- `src/routes/_authenticated.tsx`, `src/routes/reset-password.tsx`
- `src/routes/api/public/ramp-webhook.ts`

**Rewritten**
- `src/lib/legacy-auth.ts`, `src/lib/legacy-data.ts`
- `src/routes/login.tsx`, `signup.tsx`, `advisor.login.tsx`, `advisor.signup.tsx`, `claim.tsx`

**Edited**
- `src/routes/dashboard.tsx`, `vault.$id.tsx`, `advisor.dashboard.tsx`, `__root.tsx`, `router.tsx`

**DB migration**
- `custodial_wallets` table + RLS
- columns: `vaults.vault_pda`, `vaults.usdc_ata`, `vaults.init_tx`, `vaults.letter_message`; `beneficiaries.wallet_pubkey`, `beneficiaries.claimed_at`, `beneficiaries.claim_token`
- `seed_demo_for_user(uuid)` RPC
- `assign_advisor_role(uuid)` SECURITY DEFINER RPC

**Secrets requested**
- `WALLET_ENCRYPTION_KEY` (32-byte base64) — required
- `SOLANA_RPC_URL` (defaults to `https://api.devnet.solana.com`) — optional
- `FAUCET_KEYPAIR_JSON` (devnet keypair holding test USDC for the mock ramp) — required for demo

## Heads-up on the Rust piece

The Lovable sandbox **cannot compile or deploy the Anchor program**. I'll commit the full Rust source, `Anchor.toml`, tests, and the generated IDL placeholder. You (or I, with copy-paste instructions) will run locally:

```text
solana-keygen new -o ~/.config/solana/legacylink.json
solana config set --url devnet --keypair ~/.config/solana/legacylink.json
solana airdrop 2
anchor build
anchor deploy
anchor idl init <PROGRAM_ID> -f target/idl/legacy_vault.json
```

Then paste the deployed program ID into `SOLANA_PROGRAM_ID` secret. Until that's done, the app runs in **simulated mode**: the server functions return fake-but-deterministic tx signatures so the UI is unblocked.

## Order of execution

1. DB migration (wallets, vault columns, RPCs) + secrets prompt for `WALLET_ENCRYPTION_KEY`, `FAUCET_KEYPAIR_JSON`.
2. Real auth + `_authenticated` guard + Google.
3. `legacy-data.ts` rewrite against Supabase (simulated tx signatures).
4. Anchor program source + IDL committed.
5. `solana.server.ts` + `wallet.server.ts` + server fns (live mode toggled by `SOLANA_PROGRAM_ID` presence).
6. Ramps abstraction + mock provider; webhook stub.
7. Claim flow rebuild with magic-link tokens.
8. Demo seed + Reset button.
9. Landing polish + meta tags.

Each step lands a working build. If we run out of time after step 3, the demo still has real auth + DB. After step 5 it's on-chain. After step 7 the full story works end-to-end.