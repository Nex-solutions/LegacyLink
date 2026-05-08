// Server-only helper: ensures an authenticated user has a custodial wallet row.
// The encrypted secret lives in a separate table (`custodial_wallet_secrets`)
// that has NO authenticated policies — only the service-role admin client can
// read or write it. This keeps the secret unreachable even if a future RLS
// rule on `custodial_wallets` is too permissive.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateWallet } from "./solana.server";

export async function ensureCustodialWallet(userId: string): Promise<string> {
  const { data: existing, error: readErr } = await supabaseAdmin
    .from("custodial_wallets")
    .select("pubkey")
    .eq("user_id", userId)
    .maybeSingle();

  if (readErr) throw readErr;
  if (existing?.pubkey) return existing.pubkey;

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

  return wallet.pubkey;
}

export async function getUserPubkey(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("custodial_wallets")
    .select("pubkey")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.pubkey ?? null;
}
