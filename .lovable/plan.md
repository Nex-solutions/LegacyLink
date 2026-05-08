# Wire vault program to devnet for real

**Program ID:** `4ivAJT437HRojo79Q8aRoi21vFrhDDaCzdLQ6C9uUe3p`
**Devnet USDC mint:** `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
**IDL:** real one you uploaded (5 instructions: initializeVault, fundVault, checkIn, releaseVault, claim).

Goal: flip `src/lib/solana.server.ts` from simulated to real Anchor calls. Same exported function signatures, no call-site changes anywhere else.

---

## What changes

1. **Replace `src/lib/idl/vault.json`** with the real IDL you uploaded, plus inject the program address at top so Anchor's client picks it up.

2. **Add npm deps** (server-side only): `@coral-xyz/anchor`, `@solana/web3.js`, `@solana/spl-token`.

3. **Add server secrets** (no `.env`, no `VITE_*` — secrets tool only):
   - `SOLANA_PROGRAM_ID` = `4ivAJT437HRojo79Q8aRoi21vFrhDDaCzdLQ6C9uUe3p`
   - `SOLANA_RPC` = `https://api.devnet.solana.com`
   - `SOLANA_USDC_MINT` = `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`

4. **Rewrite `src/lib/solana.server.ts`** — keep wallet generation / encryption helpers exactly as they are. Replace the simulated section with real Anchor calls:
   - `loadCustodialKeypair(userId)` → decrypts secret, returns `Keypair`.
   - `getProgram(keypair)` → builds `AnchorProvider` + `Program` from the IDL using the env program ID.
   - `deriveVaultPda(ownerPubkey, vaultId)` → real `PublicKey.findProgramAddressSync([b"vault", owner, uuid16], programId)`.
   - `initVaultOnChain({ ownerPubkey, vaultId })` →
     - load owner keypair (custodial)
     - auto-airdrop 0.05 SOL if balance < 0.02 SOL (devnet only, swallow rate-limit errors)
     - convert vault UUID → 16 raw bytes
     - call `program.methods.initializeVault(vaultIdBytes, new BN(amountCadCents)).accounts({...}).rpc()`
     - return `{ vaultPda, usdcAta, signature }` (real values)
   - `fundVaultOnChain` / `releaseVaultOnChain` / `checkInOnChain` / `claimOnChain` — same shape, real RPC calls.
   - `isSimulatedMode()` → returns `false` when `SOLANA_PROGRAM_ID` is set.

5. **`src/lib/wallet.server.ts`** — extend `ensureCustodialWallet` to also store the **vault USDC ATA** when a vault is created. Actually no — ATAs are per-vault, not per-user. Leave wallet.server.ts alone; ATAs derived inside `solana.server.ts`.

6. **`src/lib/ramps.server.ts`** — `MockRampProvider.onramp` should accept a destination ATA (not just pubkey) so when we wire a real provider later, USDC lands in the vault ATA, not the owner wallet. Add an optional `destinationAta?: string` to `OnRampInput`. Mock just logs it.

7. **Audit trail UI** — wherever `vaults.init_tx` / `vaults.tx_signature` are rendered, link out to `https://solscan.io/tx/<sig>?cluster=devnet`. (Quick pass; non-blocking.)

8. **Smoke test** (manual after deploy):
   - sign up new user → wallet row created
   - `/create` a vault → check `vaults.init_tx` is a real signature → open Solscan devnet → confirm `initializeVault` ran
   - if it fails, edge function logs will show the Anchor error code

---

## Technical details

### `src/lib/idl/vault.json` shape

The IDL you uploaded is the legacy Anchor 0.29 format (no top-level `address` / `metadata`). Anchor's JS client needs the program ID separately, but we'll also inject it for safety:

```json
{
  "address": "4ivAJT437HRojo79Q8aRoi21vFrhDDaCzdLQ6C9uUe3p",
  "metadata": { "name": "vault", "version": "0.1.0", "spec": "0.1.0" },
  "version": "0.1.0",
  "name": "vault",
  "instructions": [ /* ...your 5 ins... */ ],
  "accounts":     [ /* ...Vault... */ ],
  "errors":       [ /* ...NotFunded, NotReleased... */ ]
}
```

We construct the `Program` with `new Program(idl as Idl, provider)` — Anchor reads `idl.address` for the program ID.

### Vault ID encoding

`vaults.id` is a Postgres `uuid` (36-char string). On-chain seed is `[u8; 16]`. Conversion: strip dashes, `Buffer.from(hex, "hex")` → length 16. PDA seed must use the same bytes both in the program and the client, otherwise PDAs won't match.

### Auto-airdrop

Devnet faucet is rate-limited and sometimes flakes. Wrap `connection.requestAirdrop(...)` in try/catch and just continue — if balance is genuinely 0 the next instruction will fail with a clear "insufficient funds" error in logs.

### Server runtime constraint

`@coral-xyz/anchor` and `@solana/spl-token` are pure JS / WASM-free, safe in the Cloudflare Worker SSR. No native deps. `@solana/web3.js` works on edge runtimes.

---

## Out of scope

- No Phantom / wallet-adapter UI. End users never sign anything.
- No real fiat ramp (mock stays).
- No advisor-side signing (custodial only).
- No mainnet — devnet hardcoded for now.

---

## What you need to do before "Implement"

Approve this plan. After approval I'll:
1. Prompt you to add the 3 secrets via Lovable Cloud (one click each).
2. Replace `vault.json`, install deps, rewrite `solana.server.ts`.
3. Hand back a smoke-test checklist.
