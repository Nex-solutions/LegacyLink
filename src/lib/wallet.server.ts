// Server-only helper: ensures an authenticated user has a custodial wallet row.
// The encrypted secret lives in a separate table (`custodial_wallet_secrets`)
// that has NO authenticated policies — only the service-role admin client can
// read or write it. This keeps the secret unreachable even if a future RLS
// rule on `custodial_wallets` is too permissive.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

function getRpcUrls(): string[] {
  const urls = [process.env.SOLANA_RPC, "https://api.devnet.solana.com"].filter(
    Boolean,
  ) as string[];
  return [...new Set(urls)];
}

export async function ensureCustodialWallet(userId: string): Promise<{
  pubkey: string;
  airdropSig?: string;
  airdropFailed?: boolean;
  alreadyExisted: boolean;
}> {
  const { data: existing, error: readErr } = await supabaseAdmin
    .from("custodial_wallets")
    .select("pubkey")
    .eq("user_id", userId)
    .maybeSingle();

  if (readErr) throw readErr;
  if (existing?.pubkey) {
    let airdropSig: string | undefined;
    let airdropFailed = false;
    try {
      const { Connection, PublicKey } = await import("@solana/web3.js");
      const pk = new PublicKey(existing.pubkey);
      for (const rpcUrl of getRpcUrls()) {
        try {
          const connection = new Connection(rpcUrl, "confirmed");
          const sigs = await connection.getSignaturesForAddress(pk, { limit: 1 });
          airdropSig = sigs[0]?.signature;
          break;
        } catch (e) {
          console.warn("[wallet] funding lookup RPC failed", e instanceof Error ? e.message : e);
        }
      }
      if (!airdropSig) {
        // Wallet exists but never funded — fund it now so the explorer shows it live.
        try {
          const { fundFromMaster } = await import("./treasury.server");
          airdropSig = await fundFromMaster(existing.pubkey, 0.005);
          console.log(`[wallet] back-funded existing wallet ${existing.pubkey} (${airdropSig})`);
        } catch (e) {
          airdropFailed = true;
          console.warn("[wallet] back-fund failed", e instanceof Error ? e.message : e);
        }
      }
    } catch (e) {
      console.warn(
        "[wallet] couldn't read existing wallet funding tx",
        e instanceof Error ? e.message : e,
      );
    }
    return { pubkey: existing.pubkey, airdropSig, airdropFailed, alreadyExisted: true };
  }

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

  await supabaseAdmin.from("profiles").update({ solana_wallet: wallet.pubkey }).eq("id", userId);

  // Fund the new wallet from the backend treasury (master_wallet) so its
  // address shows as live on Solana Explorer. Wrapped in try/catch — a
  // funding failure (empty treasury, RPC issue) must never block signup.
  let airdropSig: string | undefined;
  let airdropFailed = false;
  try {
    const { fundFromMaster } = await import("./treasury.server");
    const sig = await fundFromMaster(wallet.pubkey, 0.005);
    airdropSig = sig;
    console.log(`[wallet] funded 0.005 SOL to ${wallet.pubkey} from treasury (${sig})`);
  } catch (e) {
    airdropFailed = true;
    console.warn("[wallet] treasury funding failed", e instanceof Error ? e.message : e);
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
