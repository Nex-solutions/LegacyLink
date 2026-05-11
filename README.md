<div align="center">

# LegacyLink

**A digital estate vault for Canadian families — built on Solana.**

Set conditions today, your people get paid in CAD automatically. No lawyers, no probate delays.

[![Built on Solana](https://img.shields.io/badge/Built%20on-Solana-14F195?style=flat-square&logo=solana&logoColor=black)](https://solana.com)
[![Network](https://img.shields.io/badge/Network-Devnet-blue?style=flat-square)](https://explorer.solana.com/?cluster=devnet)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)

[Live site](https://legacylink.dev) · [Report a bug](../../issues) · [Request a feature](../../issues)

</div>

---

## Table of contents

- [What is LegacyLink?](#what-is-legacylink)
- [Why it exists](#why-it-exists)
- [Key features](#key-features)
- [How it works](#how-it-works)
- [Letter to beneficiary (on-chain)](#letter-to-beneficiary-on-chain)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Database & migrations](#database--migrations)
- [Solana / on-chain proof](#solana--on-chain-proof)
- [Demo mode](#demo-mode)
- [Scripts](#scripts)
- [Deployment](#deployment)
- [Security](#security)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Disclaimer](#disclaimer)

---

## What is LegacyLink?

LegacyLink is an **estate-as-a-service** platform that lets a Canadian adult lock funds into a programmable vault and define exactly when, how, and to whom those funds release. Conditions can be:

- **Time-based** — release on a specific date.
- **Inactivity-based** — release if the owner doesn't check in for N days ("dead-man switch").
- **Manual** — owner-triggered release.

Beneficiaries receive funds in **Canadian dollars** via Interac e-Transfer (off-ramp), while the source-of-truth lives **on Solana** as a verifiable, tamper-evident record. Owners can also attach a short **letter to the beneficiary** that is anchored on-chain via SPL Memo and revealed at claim time.

## Why it exists

- **$1.2T** in Canadian intergenerational wealth transfer projected by 2030 (CIBC).
- **51%** of Canadian adults have no will (Angus Reid, 2023).
- Probate currently takes an average of **8 months** in Canada.

Traditional estate planning is expensive, slow, and inaccessible. LegacyLink compresses it into ten minutes, with cryptographic guarantees that survive the user.

## Key features

- 🔒 **Programmable vaults** — time, inactivity, or manual release conditions.
- 💸 **CAD in, CAD out** — Paytrie on/off-ramp; beneficiaries never touch crypto.
- ⛓️ **On-chain proof at every step** — wallet provisioning, vault creation, letter, and claim payouts each emit a public Solana devnet signature.
- ✉️ **Letter to beneficiary** — short message anchored via SPL Memo from the owner's system wallet, revealed to the beneficiary on successful claim with a Solscan verify link.
- 🪪 **Token claim links** — each beneficiary gets a single-use, public claim URL (no sign-in required) so heirs can claim without onboarding.
- 👨‍💼 **Advisor workspace** — read-only client overview for advisors linked at the account level.
- 🛡️ **RLS-first backend** — every user-scoped table protected by row-level security and a `SECURITY DEFINER` role function.


## How it works

LegacyLink is **CAD-in, CAD-out**. The owner deposits Canadian dollars; we on-ramp them to USDC into the owner's custodial wallet, **sweep that USDC into the system hot wallet, lock it in a programmable Solana vault**, then on payout the system triggers an off-ramp through Paytrie that pays each beneficiary in CAD via Interac. The owner never sees crypto. The beneficiaries never see crypto. The chain is the receipt.

```text
  Owner                LegacyLink backend                    Solana (devnet)            Beneficiary
  ─────                ────────────────                   ───────────────            ───────────
   │  1. Sign up + KYC      │                                   │                         │
   │ ─────────────────────► │  Provision custodial wallet       │                         │
   │                        │ ────────────────────────────────► │  user wallet created    │
   │                        │  Proof-of-life tx (0.001 SOL)     │                         │
   │                        │ ────────────────────────────────► │                         │
   │                                                                                      │
   │  2. Fund vault in CAD  │                                   │                         │
   │   (Interac / card)     │                                   │                         │
   │ ─────────────────────► │  Paytrie: CAD → USDC              │                         │
   │                        │ ────────────────────────────────► │  USDC → user wallet     │
   │                        │  Sweep user wallet → HOT WALLET   │                         │
   │                        │ ────────────────────────────────► │  USDC consolidated      │
   │                        │  Initialize vault PDA (Anchor)    │                         │
   │                        │ ────────────────────────────────► │  USDC locked in vault   │
   │                        │ ◄──────────────────────────────── │  init_tx, tx_signature  │
   │                                                                                      │
   │  3. Set conditions     │                                                             │
   │   • date / inactivity  │                                                             │
   │   • beneficiary split  │                                                             │
   │ ─────────────────────► │                                                             │
   │                                                                                      │
   │            ⏳ Time passes — owner checks in, or doesn't ⏳                           │
   │                                                                                      │
   │  4. Beneficiary claims │  Sweep HOT WALLET → user system   │                         │
   │                        │  wallet (on-chain payout proof)   │                         │
   │                        │ ────────────────────────────────► │                         │
   │                        │  Off-ramp via Paytrie: USDC → CAD                           │
   │                        │  Pay each beneficiary in CAD via Interac e-Transfer         │
   │                        │ ──────────────────────────────────────────────────────────► │
   │                        │  Reveal owner's on-chain letter to the beneficiary          │
   │                        │ ──────────────────────────────────────────────────────────► │
   │                                                                                      │
   │  Every step writes a vault_event row + a public Solana tx link (Solscan devnet).     │
```

### Step-by-step

1. **Sign up + KYC.** Email + password (managed Postgres + Auth backend) and a lightweight KYC step — required because we move Canadian dollars on the user's behalf.
2. **Custodial wallet provisioned.** A Solana keypair is generated server-side, the secret is encrypted at rest, and a small **proof-of-life transfer (`0.001 SOL`)** is broadcast as the user's first verifiable on-chain artifact.
3. **Owner funds the vault in CAD.** The owner pays via Interac e-Transfer or card. **Paytrie on-ramps the CAD into USDC** and that USDC lands directly in the owner's custodial wallet on Solana.
4. **Sweep into the hot wallet.** As soon as the on-ramp settles, the platform **sweeps the USDC from the user's custodial wallet into the system hot wallet** (a single, well-monitored treasury account). This consolidates funds for vault accounting, gas efficiency, and clean off-ramp routing.
5. **Lock in the vault.** Our **Anchor program** initializes a vault PDA owned by the hot wallet, **locks the USDC** against it, and writes the beneficiaries + release conditions. The `init_tx` + `tx_signature` are persisted against the row in Postgres for audit.
6. **Optional letter.** If the owner wrote a message, the platform anchors it on Solana via **SPL Memo** from the owner's system wallet and stores the resulting `letter_tx_signature` against the vault. The letter stays sealed until claim.
7. **Conditions set.** The owner picks any combination of:
   - **Date** — release on a specific calendar date.
   - **Inactivity ("dead-man switch")** — release if the owner doesn't check in for N days.
   - **Manual** — owner-triggered release, useful for living gifts.
8. **Trigger fires.** A scheduled job evaluates conditions. When one matches, the vault is marked released and beneficiary claim links go live.
9. **Beneficiary claim.** The beneficiary opens their token claim link (no sign-in needed) and confirms. The platform **sweeps SOL/USDC from the hot wallet back to the user's system wallet** — that on-chain transfer is the cryptographic payout receipt — and **Paytrie off-ramps USDC → CAD** to deliver Interac e-Transfer to the beneficiary. The sealed letter is revealed alongside a Solscan verify link for both the payout tx and the letter tx.
10. **Audit trail.** Every state change emits a `vault_event` row, and every on-chain action exposes a public **Solscan (devnet)** link from the UI.

> 💡 **Why on-chain at all?** The chain is the source of truth nobody — including us — can quietly rewrite. The fiat rails handle UX; Solana handles guarantees.

## Letter to beneficiary (on-chain)

When creating a vault, the owner can attach a short message (up to 280 chars) for the beneficiary. The platform:

1. Anchors the message on Solana via the **SPL Memo program** (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`), signed by the owner's system wallet.
2. Persists the resulting transaction signature on the `vaults.letter_tx_signature` column.
3. Keeps the message sealed in the UI until the beneficiary completes a claim.
4. On successful claim, reveals the message in a serif card alongside a **"Verify letter on Solana"** link to Solscan devnet.

Letter anchoring is **non-critical**: if the memo tx fails, vault creation still succeeds and the claim screen falls back to displaying the letter without the on-chain link.

### The hot wallet (forker note)

The system hot wallet is the single Solana account that owns vault PDAs, receives swept USDC, and signs payouts. **If you fork this repo, this is yours to configure** — generate a fresh keypair, fund it on devnet (or mainnet, post-audit), and point the platform at it via:

```bash
MASTER_WALLET_SECRET=<base58 secret of YOUR hot wallet>
```

Operational guidelines for forkers:

- Generate a new keypair (`solana-keygen new --outfile hot.json`, then export the base58 secret) — **never reuse the demo key**.
- Keep enough SOL for transaction fees + a buffer for sweeps (≥ 0.1 SOL on devnet for testing).
- Store the secret in your secrets manager, or your hosting provider's secret manager. Never commit it.
- For production, split responsibilities: hot wallet for active sweeps/payouts, cold wallet for reserves, and consider a multisig (e.g. Squads) on the hot wallet itself.
- Rotate by minting a fresh keypair, draining the old one, and updating `MASTER_WALLET_SECRET`. Vault PDAs created under the previous key must be settled or migrated before rotation.





## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                       Browser (React 19)                        │
│   TanStack Start · TanStack Router · Tailwind v4 · shadcn/ui    │
└──────────────────────────┬──────────────────────────────────────┘
                           │  createServerFn (typed RPC)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│            Edge runtime (Cloudflare Workers via Vite)           │
│  • Auth middleware       • Vault lifecycle  • Treasury / sweep  │
│  • Paytrie on/off-ramp   • Ledger          • Webhooks           │
└────────────┬────────────────────────────────┬───────────────────┘
             │                                │
             ▼                                ▼
   ┌──────────────────┐            ┌────────────────────────┐
   │  managed backend    │            │  Solana (devnet)       │
   │  (Postgres + RLS) │            │  Anchor vault program  │
   │  Auth · Storage   │            │  Helius RPC            │
   └──────────────────┘            └────────────────────────┘
```

## Tech stack

| Layer        | Choice                                                                            |
| ------------ | --------------------------------------------------------------------------------- |
| Framework    | [TanStack Start v1](https://tanstack.com/start) (React 19, Vite 7)                |
| Runtime      | Cloudflare Workers (edge) via `@cloudflare/vite-plugin`                           |
| Styling      | Tailwind CSS v4 + shadcn/ui + Framer Motion                                       |
| Backend      | Managed Postgres + Auth + Storage, RLS-first                                      |
| Chain        | Solana **devnet** · Anchor program · `@solana/web3.js`                            |
| RPC          | Helius                                                                            |
| Fiat ↔ USDC  | **Paytrie** — handles **both CAD → USDC on-ramp and USDC → CAD off-ramp**         |
| Payouts      | Interac e-Transfer (via Paytrie)                                                  |
| Validation   | Zod                                                                               |
| Forms        | React Hook Form                                                                   |
| Tooling      | TypeScript (strict), ESLint, Prettier, Bun                                        |


## Project structure

```
src/
├── routes/                  # File-based routing (TanStack Start)
│   ├── index.tsx            # Landing page
│   ├── signup.tsx           # Auth
│   ├── dashboard.tsx        # Owner dashboard
│   ├── create.tsx           # Vault creation flow
│   ├── vault.$id.tsx        # Vault detail
│   ├── claim.tsx            # Beneficiary claim flow
│   ├── advisor.*.tsx        # Advisor workspace
│   └── api/public/          # Webhook & public endpoints
├── lib/
│   ├── *.functions.ts       # Client-callable server functions
│   ├── *.server.ts          # Server-only helpers (KMS, RPC, treasury)
│   ├── solana/              # Wallet provider + helpers
│   └── idl/vault.json       # Anchor IDL
├── components/
│   ├── legacy/              # Brand components (Nav, PageShell, VaultCard)
│   └── ui/                  # shadcn/ui primitives
├── integrations/supabase/   # Auto-generated backend client + types (DO NOT EDIT)
└── styles.css               # Tailwind v4 tokens
supabase/                    # Backend config + SQL migrations
```

## Getting started

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1 (or Node 20 + npm if you prefer)
- A [Lovable Cloud](https://lovable.dev) project (managed Postgres + Auth + Storage) — auto-provisioned when you fork on Lovable
- A Helius (or any) Solana **devnet** RPC URL
- A funded **devnet** hot wallet (≥ 0.1 SOL) for proof tx, sweeps, and claim payouts
- A [Paytrie](https://paytrie.com) merchant account for the CAD ↔ USDC rails

### Install & run

```bash
git clone https://github.com/<your-org>/legacy-link.git
cd legacy-link
bun install
cp .env.example .env       # then fill in the values below
bun run dev
```

The app boots at `http://localhost:5173`.

## Environment variables

The browser-visible `VITE_*` variables are auto-managed by Lovable Cloud (do not edit `.env` manually). Server-only secrets are configured in **Cloud → Settings → Secrets**.

**Browser (auto-managed):**

| Variable                       | Purpose                                                              |
| ------------------------------ | -------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`            | Cloud project URL                                                    |
| `VITE_SUPABASE_PUBLISHABLE_KEY`| Public/anon key for browser-side calls                               |
| `VITE_SUPABASE_PROJECT_ID`     | Cloud project identifier                                             |

**Server-only secrets (configure in Cloud):**

| Variable                       | Required | Purpose                                                              |
| ------------------------------ | :------: | -------------------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY`    |    ✅    | Privileged server key (never ship to the browser)                    |
| `SOLANA_RPC`                   |    ✅    | Helius (or any) Solana **devnet** endpoint                           |
| `SOLANA_USDC_MINT`             |    ✅    | USDC mint address on the target cluster                              |
| `SOLANA_PROGRAM_ID`            |    ✅    | Anchor vault program ID (devnet)                                     |
| `WALLET_ENCRYPTION_KEY`        |    ✅    | AES key used to encrypt custodial wallet secrets at rest             |
| `MASTER_WALLET_SECRET`         |    ✅    | base58 secret for **your** hot wallet keypair                        |
| `PAYTRIE_API_KEY`              |    ✅    | Required for CAD ↔ USDC on/off-ramp                                  |
| `PAYTRIE_WEBHOOK_SECRET`       |    ✅    | HMAC secret for the `/api/public/paytrie-webhook` endpoint           |
| `LOVABLE_API_KEY`              |    ✅    | Lovable AI Gateway key (used by AI-assisted flows)                   |

> ⚠️ Never commit secrets. `.env` is git-ignored. Use your hosting provider's secret manager.

## Database & migrations

The schema lives in `supabase/migrations/` and is applied via standard SQL migrations. Key tables:

- `profiles` — user profile + KYC fields (NOT used for roles).
- `user_roles` — RLS-friendly role table (`admin`, `advisor`, `family`, `individual`).
- `custodial_wallets` / `custodial_wallet_secrets` — custodial wallet pubkey + encrypted secret (split tables for least-privilege RLS).
- `master_wallet` — singleton row holding the encrypted hot wallet secret.
- `vaults` — vault config + on-chain references (`init_tx`, `tx_signature`, `vault_pda`, `usdc_ata`, `letter_message`, `letter_tx_signature`, `status`).
- `beneficiaries` — payout splits, contact info, single-use `claim_token`, `claimed_at`, `payout_tx_signature`.
- `vault_events` — append-only audit log with linked Solana tx signatures.
- `ledger_accounts` / `ledger_transactions` / `ledger_entries` — double-entry internal accounting.
- `ramp_intents` — Paytrie on/off-ramp lifecycle + webhook payloads.
- `advisor_clients` — many-to-many advisor ↔ client links for read-only access.

Every user-scoped table ships with **Row-Level Security** policies. Roles are resolved via a `SECURITY DEFINER` function (`public.has_role`) — never via client storage.

## Solana / on-chain proof

- Network: **devnet** (mainnet planned post-audit — see [Roadmap](#roadmap)).
- Each signup broadcasts a verifiable proof transfer (user system wallet → hot wallet, 0.001 SOL).
- Each vault initialization is an on-chain Anchor transaction with a publicly linkable signature.
- Each optional letter to beneficiary is anchored via **SPL Memo** from the owner's system wallet.
- Each beneficiary claim broadcasts a hot-wallet → user-system-wallet sweep tx as the on-chain payout receipt.
- Helpers: `src/lib/solana.server.ts`, `src/lib/vault-client.ts`, `src/lib/proof-tx.server.ts`, `src/lib/sweep.server.ts`.
- IDL: `src/lib/idl/vault.json`.

Every "View on Solscan ↗" link in the UI deep-links to Solscan devnet so anyone can verify the transaction live.

## Demo mode

Optimized for judges, contributors, and curious tinkerers — zero crypto knowledge required:

1. Sign up at `/signup` — a custodial Solana wallet is provisioned automatically and the proof-of-life tx is broadcast.
2. Hit `/create` — the form is **prefilled** with a randomized demo beneficiary and a templated letter so you can ship a vault end-to-end in under 30 seconds.
3. On creation, vaults are **auto-released** in demo mode and the success screen surfaces:
   - the user system wallet address
   - the proof tx (user → hot wallet)
   - the letter tx (SPL Memo, if a letter was attached)
   - a one-click **"View claim demo"** link populated with the beneficiary's name
4. Follow the claim link → confirm → watch the hot-wallet → user-system-wallet payout tx land on Solscan, with the owner's letter revealed underneath and a verify-on-chain link.

Demo passwords are generated freshly per session — never static.

## Scripts

```bash
bun run dev          # local dev server
bun run build        # production build
bun run build:dev    # development-mode build (no minification)
bun run preview      # preview the production build locally
bun run lint         # ESLint
bun run format       # Prettier
```

## Deployment

LegacyLink is built for the edge (Cloudflare Workers) and ships as a single Vite build.

- **One-click hosting**: any TanStack Start–compatible PaaS (e.g. Cloudflare Pages/Workers, Vercel) — connect the repo and ship.
- **Self-host**: deploy the Vite build to Cloudflare Workers, Vercel Edge, or any TanStack Start–compatible runtime. See [`wrangler.jsonc`](wrangler.jsonc) for the Worker config.

## Security

- All sensitive logic runs server-side via `createServerFn` with auth middleware.
- RLS is enabled on every user-scoped table.
- Roles live in a dedicated `user_roles` table, never on profiles or in client storage.
- Webhooks verify HMAC signatures using `crypto.timingSafeEqual`.
- Custodial wallet secrets are encrypted at rest and never leave the server runtime.

Found a vulnerability? Please **do not open a public issue**. Email the maintainers (see [SECURITY.md](SECURITY.md)).

## Roadmap

- [ ] Mainnet launch (post third-party audit)
- [ ] Multi-sig advisor co-approval
- [ ] Recurring disbursements (e.g. monthly support to a dependant)
- [ ] Mobile-first PWA polish
- [ ] French-language localization (Quebec)
- [ ] Native Interac claim links (no manual copy/paste)

## Contributing

Contributions are welcome and appreciated. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

Quick version:

1. Fork the repo and create your branch from `main`.
2. `bun install` and make your change.
3. Run `bun run lint` and ensure the build passes.
4. Open a PR with a clear description and screenshots/recordings for UI changes.

## License

LegacyLink is released under the [MIT License](LICENSE).

## Disclaimer

LegacyLink is currently a **devnet** prototype. It is **not** a registered financial institution, trustee, or law firm, and **does not constitute legal, financial, or estate-planning advice**. Do not use it to manage real funds until a mainnet, audited release is announced. Use at your own risk.

---

<div align="center">

Built with care for Canadian families. **Certainty is a gift.**

</div>
