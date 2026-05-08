# Paytrie on/off-ramp + sweep/payout logic

Master hot wallet is currently on **Solana devnet** (default `SOLANA_RPC`). Paytrie is real-CAD only, so the Paytrie integration is gated to mainnet — we add a `SOLANA_CLUSTER` switch and document devnet vs mainnet clearly. Until you flip to mainnet, Paytrie calls go to their **sandbox** and no real funds move.

## End-to-end flow

### Buy (on-ramp)

```text
User clicks "Add funds CA$X"
  └─ server: POST /priceQuote (CAD → USDC-SOL)         → quoteId, fee
  └─ server: POST /transaction with wallet = user's custodial pubkey
                                                       → tx_id, rmt (Interac ref)
  └─ persist ramp_intent row (status=awaiting_payment)
  └─ frontend shows: "Send CA$X via Interac e-Transfer"
                     · email: <Paytrie's deposit email>
                     · reference (rmt): CA7MREh2Hhg4
                     · amount,
                     · button "I've paid"   ← marks intent.user_marked_paid=true
                                              (UI hint only, not trusted)
Paytrie webhook: transaction.complete
  └─ verify HMAC signature
  └─ poll Solana for USDC arrival on user's custodial ATA (defensive double-check)
  └─ ledger.recordOnRampAndSweep(userId, amountUsdc, externalRef=tx_id)
       ├─ Tx A: Dr user_wallet, Cr fiat_onramp_clearing
       └─ Tx B (sweep): build SPL transfer user_ata → master_ata, sign with user
                       custodial keypair, broadcast, then Dr master, Cr user
  └─ store sweep tx signature on ledger row
  └─ if user wallet has < 0.0015 SOL: top up from master before sweep (gas)
```

### Sell (off-ramp / payout trigger)

```text
Payout trigger fires (vault release, manual payout, etc.)
  └─ server: POST /priceQuote (USDC-SOL → CAD) for amount
  └─ server: POST /transaction
            { leftSideLabel: "USDC-SOL", leftSideValue: amt,
              rightSideLabel: "CAD",
              etransferEmail: beneficiary.email }
            → tx_id, depositAddress (Paytrie's Solana address)
  └─ persist ramp_intent row (kind=offramp, status=sending_usdc)
  └─ Optional internal hop for clean ledger:
       master → user_wallet (SPL transfer) — record payout_from_master
  └─ master → Paytrie depositAddress (SPL transfer)
  └─ post offramp_burn ledger entry (Dr fiat_offramp_clearing, Cr user_wallet)
Paytrie webhook: transaction.complete (sell)
  └─ mark ramp_intent status=complete, store CAD payout reference
```

### Gas management

- **One source of truth: master wallet pays all gas.**
- Custodial user wallets only need ~0.0015 SOL to send one SPL sweep tx (rent-exempt + signature fee). Top them up just-in-time from master right before the sweep — never pre-fund every wallet.
- Background `gas_keeper` server fn runs daily:
  - if master SOL < 0.5 → alert admin (no auto-buy; you fund manually or via Paytrie SOL on-ramp later)
  - reclaim dust: any user wallet with > 0.005 SOL after sweep → return excess to master.
- All gas movements posted to a new ledger account `5000 — Network fees (gas)` (expense). Each sweep posts: Dr `5000` gas, Cr `1000` master, amount = actual lamports spent (fetched from tx meta).

## Data model additions

New table `ramp_intents` (one row per Paytrie transaction):


| col                     | type                      | notes                                         |
| ----------------------- | ------------------------- | --------------------------------------------- |
| id                      | uuid pk                   | &nbsp;                                        |
| user_id                 | uuid                      | nullable for off-ramp to non-user beneficiary |
| kind                    | enum (`onramp`,`offramp`) | &nbsp;                                        |
| status                  | text                      | mirrors Paytrie status verbatim               |
| paytrie_tx_id           | text unique               | their `tx`/`tx_id`                            |
| paytrie_rmt             | text                      | Interac reference for buys                    |
| deposit_address         | text                      | Paytrie's Solana addr for sells               |
| destination_wallet      | text                      | user custodial pubkey for buys                |
| quote_id                | bigint                    | &nbsp;                                        |
| amount_cad              | numeric                   | &nbsp;                                        |
| amount_usdc             | numeric                   | &nbsp;                                        |
| fee_cad                 | numeric                   | &nbsp;                                        |
| sweep_tx_signature      | text                      | populated after sweep                         |
| payout_tx_signature     | text                      | populated after master→Paytrie tx             |
| ledger_tx_id            | uuid                      | links to `ledger_transactions`                |
| created_at / updated_at | tz                        | &nbsp;                                        |


RLS: user reads own; admin reads all. Writes: server-only via service role.

New ledger account: `5000 — Network fees (gas)` (type=expense).

## Code changes (file map)

```text
src/lib/paytrie.server.ts          NEW  — typed client (priceQuote, transaction,
                                         getTransaction, webhooks register)
src/lib/paytrie.functions.ts       NEW  — createServerFn wrappers used by UI:
                                         createBuyIntent, createSellIntent,
                                         getRampIntent, listMyRampIntents
src/lib/sweep.server.ts            NEW  — sweepUserToMaster(userId, amountUsdc)
                                         payoutFromMaster(toAddress, amountUsdc)
                                         topUpUserGas(userId)
src/lib/ramps.server.ts            EDIT — replace MockRampProvider with
                                         PaytrieRampProvider; keep mock as
                                         fallback when PAYTRIE_API_KEY unset
src/lib/ledger.server.ts           EDIT — accept optional gasLamports on sweep
                                         and post 5000 entry
src/routes/api/public/paytrie-webhook.ts  NEW — HMAC verify, route by event
src/routes/funds.add.tsx           NEW — "Add funds" UI: amount input → quote →
                                         show Interac instructions + "I've paid"
src/routes/funds.history.tsx       NEW — user's ramp_intents list
src/routes/admin.ramps.tsx         NEW — admin view: all intents, retry sweep,
                                         master gas balance widget
supabase/migrations/<ts>_paytrie.sql  NEW — table, enum, RLS, ledger account 5000
```

## Secrets to add

- `PAYTRIE_API_KEY` (server-only)
- `PAYTRIE_WEBHOOK_SECRET` (HMAC signing key)
- `PAYTRIE_BASE_URL` — default `https://api.paytrie.com` (sandbox URL once you have it)
- `SOLANA_CLUSTER` — `devnet` | `mainnet-beta` (Paytrie disabled unless `mainnet-beta`)
- `SOLANA_USDC_MINT_MAINNET` — `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (used when cluster=mainnet)

## Webhook security

`/api/public/paytrie-webhook` (public route, signed):

1. Read raw body, compute `HMAC-SHA256(body, PAYTRIE_WEBHOOK_SECRET)`, `timingSafeEqual` against `x-paytrie-signature`.
2. Look up `ramp_intents` by `paytrie_tx_id`. Idempotent — replay-safe by checking current status.
3. On `transaction.complete` for buy → trigger sweep. On sell → mark complete.
4. Always 200 after persisting; never throw to Paytrie.

## Open questions (will ask before build)

1. Do you have a Paytrie API key + sandbox URL today, or do we scaffold and you add the key later?
2. For sells, do we always sweep `master → user_wallet → Paytrie` (cleaner ledger, costs 2 gas) or `master → Paytrie` directly (cheaper, ledger uses a virtual user transit)?
3. Should "I've paid" do anything beyond a UI hint — e.g. send a nudge to support if webhook hasn't arrived in N minutes?
4. Confirm we are NOT flipping `SOLANA_CLUSTER=mainnet-beta` in this change — Paytrie wiring lands behind the flag, you flip it manually when ready.

After you answer those four, I'll implement.