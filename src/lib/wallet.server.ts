// Server-only helper: ensures an authenticated user has a custodial wallet row.
// The encrypted secret lives in a separate table (`custodial_wallet_secrets`)
// that has NO authenticated policies — only the service-role admin client can
// read or write it. This keeps the secret unreachable even if a future RLS
// rule on `custodial_wallets` is too permissive.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function ensureCustodialWallet(
  userId: string
): Promise<{ pubkey: string; airdropSig?: string; airdropFailed?: boolean; alreadyExisted: boolean }> {
  const { data: existing, error: readErr } = await supabaseAdmin
    .from("custodial_wallets")
    .select("pubkey")
    .eq("user_id", userId)
    .maybeSingle();

  if (readErr) throw readErr;
  if (existing?.pubkey) return { pubkey: existing.pubkey, alreadyExisted: true };

  const { generateWallet } = await import("./solana.server");
  const wallet = await generateWallet();

  const { error: pubErr } = await supabaseAdmin
    .from("custodial_wallets")
    .insert({ user_id: userId, pubkey: wallet.pubkey });
  if (pubErr) throw pubErr;

  const { error: secErr } = await supabaseAdmin
    .from("custodial_wallet_secrets")
    .insert({ user_id: userId, encrypted_secret: wallet.encryptedSecret });
  if (secErr) throw secErr;

  await supabaseAdmin
    .from("profiles")
    .update({ solana_wallet: wallet.pubkey })
    .eq("id", userId);

  // Airdrop a small amount of devnet SOL so the address materializes on
  // Solana Explorer immediately. Wrapped in try/catch — faucet rate-limits
  // must never block signup.
  let airdropSig: string | undefined;
  let airdropFailed = false;
  try {
    const web3 = await import("@solana/web3.js");
    const rpc = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
    const connection = new web3.Connection(rpc, "confirmed");
    const pk = new web3.PublicKey(wallet.pubkey);
    const sig = await connection.requestAirdrop(pk, 0.01 * web3.LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
    airdropSig = sig;
    console.log(`[wallet] airdropped 0.01 SOL to ${wallet.pubkey} (${sig})`);
  } catch (e) {
    airdropFailed = true;
    console.warn("[wallet] airdrop failed (rate-limited?)", e instanceof Error ? e.message : e);
  }

  return { pubkey: wallet.pubkey, airdropSig, airdropFailed, alreadyExisted: false };
}

export async function getUserPubkey(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("custodial_wallets")
    .select("pubkey")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.pubkey ?? null;
}
