## Plan: route Solana RPC through Helius devnet

The public `api.devnet.solana.com` endpoint is now blocking both Cloudflare Workers and end-user browsers (`403: Your IP or provider is blocked`). Switch all RPC traffic to your Helius devnet endpoint.

### Steps

1. **Store the Helius URL as secrets**
   - `SOLANA_RPC` (server, runtime) → `https://devnet.helius-rpc.com/?api-key=07334d2c-410d-4df0-af48-993874c0a500`
   - `VITE_SOLANA_RPC` (browser, build-time) → same URL

2. **Server: drop public devnet fallback**, use only `process.env.SOLANA_RPC`:
   - `src/lib/treasury.server.ts` — `getRpcUrls()`
   - `src/lib/wallet.server.ts` — `getRpcUrls()`
   - `src/lib/solana.server.ts` — `getRpcUrl()`
   - `src/lib/sweep.server.ts`, `src/lib/proof-tx.server.ts` — same

3. **Browser: use `VITE_SOLANA_RPC`** in `src/routes/signup_.kyc.tsx` line 155 instead of hard-coded `api.devnet.solana.com`. Same for `src/lib/solana/provider.tsx` (already partially does this).

4. **Move blockhash fetch server-side**: update `prepareBrowserWalletFunding` in `src/lib/wallet.functions.ts` so the server fetches the blockhash, signs, and returns the tx. Browser only does `sendRawTransaction` against `VITE_SOLANA_RPC`. Removes one browser→RPC round-trip and the associated failure mode.

5. **Verify**: after deploy, retry the signup → KYC → wallet flow. Funding tx should land on devnet via Helius and the "Address reserved" message should disappear.

### Notes
- Helius free tier easily handles this traffic.
- The key is exposed to the browser via `VITE_SOLANA_RPC`. That's expected for an RPC URL but the API key will be visible in the bundle. If that's a concern, we can later proxy through a server route. OK for the demo.
