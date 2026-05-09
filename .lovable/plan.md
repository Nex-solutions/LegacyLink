## Plan

1. Use Solscan for first-open reliability
   - Replace the affected `explorer.solana.com` devnet links with Solscan devnet links.
   - Apply this to signup wallet links, vault creation success links, vault activity links, and funds history links so the first click opens reliably.

2. Stop creating a new wallet during vault creation
   - Change vault creation to require the user’s existing system wallet from signup.
   - If the user does not have that wallet yet, return a clear error directing them to finish signup/KYC wallet provisioning instead of silently generating another wallet.
   - Display the user’s system wallet address as the vault account wallet address on the vault success screen.

3. Add a real 0.001 devnet SOL vault proof transaction
   - During vault creation, send `0.001` devnet SOL from the user’s system wallet to the platform hot wallet.
   - Use the user system wallet as the signer/source, so the transaction visibly proves the user wallet works end-to-end.
   - If the user wallet is too low for the transfer plus gas, top it up from the hot wallet first, but show the user wallet → hot wallet transaction as the main vault funding/proof transaction.

4. Update the vault success UI
   - Replace the misleading “Vault account” PDA display with the user’s system wallet address.
   - Label the transaction as “Vault proof transaction” or “System wallet funding transaction.”
   - Keep any internal vault/program address out of the main display or label it clearly as an internal vault identifier, not a wallet.

## Technical notes

- Add a server-only helper to sign a SOL transfer from the user custodial wallet to the hot wallet.
- Update `createVault` to use the existing wallet address and return `{ id, vault_wallet, tx_signature }` for the UI.
- Update `vault-client` and `create.tsx` response types/display.
- Add a shared Solana link helper to avoid hardcoded explorer URLs.