// Server-only helper: ensures an authenticated user has a custodial wallet row.
// Called on first sign-in / before any vault operation.
//
// Uses the admin client because custodial_wallets is INSERT-locked (no client
// policy) — only server code can provision wallets.

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
  const { error: insertErr } = await supabaseAdmin
    .from("custodial_wallets")
    .insert({
      user_id: userId,
      pubkey: wallet.pubkey,
      encrypted_secret: wallet.encryptedSecret,
    });
  if (insertErr) throw insertErr;

  // Mirror pubkey on profile for easy display
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
