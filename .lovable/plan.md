## Plan

Switch wallet activation from Solana devnet faucet airdrops to a funded backend treasury wallet, so new demo wallets reliably show as live on-chain.

### What will change

1. **Use treasury funding instead of faucet airdrop**
  - Replace `requestAirdrop(...)` in the signup wallet provisioning flow with a small SOL transfer from the existing backend master wallet.
  - Keep the same UI behavior: show the wallet address link and a funding transaction link.
2. **Make the link open reliably**
  - Return a real transfer signature from the backend.
  - The explorer link will point to that confirmed transfer transaction instead of a faucet airdrop signature.
  - Update the note to say the wallet was funded from the demo treasury and that explorer indexing can take a short moment.
3. **Fallback safely if treasury is empty**
  - If the backend treasury wallet has no SOL, signup will still complete.
  - The UI will clearly say: “Address reserved — demo treasury needs devnet SOL.”
  - No signup flow will be blocked by funding failure.
4. **Re-use this for later gas top-ups**
  - Update the existing internal top-up path that currently still uses faucet airdrops for vault creation.
  - This avoids faucet failures when creating vaults too.

### Important setup needed from you

The app already has a backend master wallet:

```text
5U7rQZF3aKvzcUZiqZfMLid32UqvKPSh1PQgmAurbShJ
```

Send a small amount of **devnet SOL** from your Playground wallet to that address. After that, the app can fund every newly created demo wallet from this treasury. (I have added 2 sol to it now)

### Technical details

- Modify `src/lib/wallet.server.ts` to send `0.005–0.01` devnet SOL using `SystemProgram.transfer` signed by the encrypted backend master wallet.
- Reuse the existing encrypted `master_wallet` table instead of asking for your Playground wallet private key.
- Modify `src/lib/solana.server.ts` so `ensureSolBalance` no longer calls the faucet and instead uses the existing treasury top-up helper.
- Keep all private keys server-side only; no wallet secret is exposed to the browser.