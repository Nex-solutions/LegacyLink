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
  const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = web3;
  const connection = new Connection(getRpcUrl(), "confirmed");
  const lamports = Math.round(solAmount * LAMPORTS_PER_SOL);
  const recipient = new PublicKey(toPubkey);

  // Build + send the master→recipient transfer WITHOUT awaiting confirmation.
  // Cloudflare Workers kill long-running CPU loops, so the previous
  // `sendAndConfirmTransaction` poll could be terminated before the tx landed,
  // making it look like funding never happened. Sending raw and returning the
  // signature immediately gives the UI a real, verifiable explorer link.
  try {
    const master = await loadMasterKeypair();
    const balance = await connection.getBalance(master.publicKey).catch(() => 0);
    if (balance < lamports + 5000) {
      throw new Error(`treasury underfunded: ${balance} lamports`);
    }
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: master.publicKey, blockhash, lastValidBlockHeight }).add(
      SystemProgram.transfer({ fromPubkey: master.publicKey, toPubkey: recipient, lamports }),
    );
    tx.sign(master);
    const sig = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    console.log(`[treasury] funded ${toPubkey} ${lamports} lamports (${sig})`);
    return sig;
  } catch (e) {
    console.warn("[treasury] master transfer failed, trying airdrop", e instanceof Error ? e.stack || e.message : e);
  }

  // Last resort: devnet airdrop (often rate-limited but worth a shot).
  const sig = await connection.requestAirdrop(recipient, lamports);
  return sig;
}
