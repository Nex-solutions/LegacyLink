// Server-only: fund Solana addresses from the encrypted master_wallet treasury.
// Replaces unreliable devnet faucet airdrops with a real on-chain transfer
// signed by the platform's master wallet.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptSecret } from "./solana.server";

function getRpcUrls(): string[] {
  const urls = [process.env.SOLANA_RPC].filter(Boolean) as string[];
  if (urls.length === 0) throw new Error("SOLANA_RPC env var not set");
  return [...new Set(urls)];
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
  const lamports = Math.round(solAmount * LAMPORTS_PER_SOL);
  const recipient = new PublicKey(toPubkey);

  // Build + send the master→recipient transfer WITHOUT awaiting confirmation.
  // Cloudflare Workers kill long-running CPU loops, so the previous
  // `sendAndConfirmTransaction` poll could be terminated before the tx landed,
  // making it look like funding never happened. Sending raw and returning the
  // signature immediately gives the UI a real, verifiable explorer link.
  const master = await loadMasterKeypair();
  let lastError: unknown;
  try {
    for (const rpcUrl of getRpcUrls()) {
      const connection = new Connection(rpcUrl, "confirmed");
      try {
        const balance = await connection.getBalance(master.publicKey);
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
        lastError = e;
        console.warn("[treasury] RPC funding attempt failed", e instanceof Error ? e.message : e);
      }
    }
    throw lastError ?? new Error("No RPC endpoints available");
  } catch (e) {
    console.warn("[treasury] master transfer failed, trying airdrop", e instanceof Error ? e.stack || e.message : e);
  }

  // Last resort: devnet airdrop (often rate-limited but worth a shot).
  for (const rpcUrl of getRpcUrls()) {
    try {
      const connection = new Connection(rpcUrl, "confirmed");
      const sig = await connection.requestAirdrop(recipient, lamports);
      return sig;
    } catch (e) {
      lastError = e;
      console.warn("[treasury] RPC airdrop attempt failed", e instanceof Error ? e.message : e);
    }
  }
  throw lastError ?? new Error("Funding failed");
}

export async function signMasterFundingTransaction(args: {
  toPubkey: string;
  solAmount: number;
  recentBlockhash: string;
}): Promise<{ signedTransactionBase64: string; signature: string }> {
  const web3 = await import("@solana/web3.js");
  const bs58 = await import("bs58").then((m) => m.default ?? m);
  const { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = web3;
  const master = await loadMasterKeypair();
  const lamports = Math.round(args.solAmount * LAMPORTS_PER_SOL);
  const tx = new Transaction({ feePayer: master.publicKey, recentBlockhash: args.recentBlockhash }).add(
    SystemProgram.transfer({ fromPubkey: master.publicKey, toPubkey: new PublicKey(args.toPubkey), lamports }),
  );
  tx.sign(master);
  const signature = tx.signature ? bs58.encode(tx.signature) : "";
  return {
    signedTransactionBase64: Buffer.from(tx.serialize()).toString("base64"),
    signature,
  };
}
