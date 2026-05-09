// Server-only: fund Solana addresses from the encrypted master_wallet treasury.
// Replaces unreliable devnet faucet airdrops with a real on-chain transfer
// signed by the platform's master wallet.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptSecret } from "./solana.server";

function getRpcUrl(): string {
  return process.env.SOLANA_RPC || "https://api.devnet.solana.com";
}

async function loadMasterKeypair() {
  const { data, error } = await supabaseAdmin
    .from("master_wallet")
    .select("encrypted_secret")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  if (!data?.encrypted_secret) throw new Error("Master wallet not initialised");
  const raw = await decryptSecret(data.encrypted_secret);
  const { Keypair } = await import("@solana/web3.js");
  return Keypair.fromSecretKey(raw);
}

/**
 * Transfer `solAmount` SOL from the master treasury wallet to `toPubkey`.
 * Returns the confirmed transaction signature.
 */
export async function fundFromMaster(toPubkey: string, solAmount: number): Promise<string> {
  const web3 = await import("@solana/web3.js");
  const { Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } = web3;
  const connection = new Connection(getRpcUrl(), "confirmed");
  const lamports = Math.round(solAmount * LAMPORTS_PER_SOL);
  const recipient = new PublicKey(toPubkey);

  // Try treasury transfer first; fall back to a direct devnet airdrop if the
  // treasury is empty so demo wallets still get funded end-to-end.
  try {
    const master = await loadMasterKeypair();
    const balance = await connection.getBalance(master.publicKey).catch(() => 0);
    if (balance >= lamports + 5000) {
      const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: master.publicKey, toPubkey: recipient, lamports }),
      );
      return await sendAndConfirmTransaction(connection, tx, [master], { commitment: "confirmed" });
    }
    console.warn(`[treasury] underfunded (${balance} lamports) — falling back to devnet airdrop`);
  } catch (e) {
    console.warn("[treasury] master transfer failed, trying airdrop", e instanceof Error ? e.message : e);
  }

  const sig = await connection.requestAirdrop(recipient, lamports);
  const bh = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
  return sig;
}
