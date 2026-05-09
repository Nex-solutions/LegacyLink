// Shared Solana link helper. Uses Solscan devnet because explorer.solana.com
// frequently fails on first open with ERR_SSL_PROTOCOL_ERROR and only loads
// after a manual reload.
export function solscanUrl(kind: "tx" | "address" | "account", value: string): string {
  const path = kind === "address" ? "account" : kind;
  return `https://solscan.io/${path}/${value}?cluster=devnet`;
}
