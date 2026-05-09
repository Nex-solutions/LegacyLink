// Server-only: send a small SOL transfer from a user's custodial wallet to the
// platform hot wallet. Used as a real on-chain proof that the user's signup
// wallet works end-to-end during vault creation.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptSecret } from "./solana.server";

function getRpcUrls(): string[] {
  const urls = [process.env.SOLANA_RPC, "https://api.devnet.solana.com"].filter(Boolean) as string[];
  return [...new Set(urls)];
}

async function pickWorkingConnection() {
  const web3 = await import("@solana/web3.js");
  let lastErr: unknown;
  for (const url of getRpcUrls()) {
    try {
      const conn = new web3.Connection(url, "confirmed");
      // Probe — some custom RPCs return malformed blockhash payloads that
      // crash @solana/web3.js's StructError parser. Skip those.
      await conn.getLatestBlockhash("confirmed");
      return conn;
    } catch (e) {
      lastErr = e;
      console.warn("[proof-tx] RPC unusable", url, e instanceof Error ? e.message : e);
    }
  }
  throw lastErr ?? new Error("No working Solana RPC endpoint");
}

async function loadKeypair(encryptedSecret: string) {
  const raw = await decryptSecret(encryptedSecret);
  const { Keypair } = await import("@solana/web3.js");
  return Keypair.fromSecretKey(raw);
}

/**
 * Send `solAmount` SOL from the user's custodial wallet to the platform hot
 * (master) wallet. If the user wallet doesn't have enough lamports for the
 * transfer + fees, top it up from the master wallet first so the proof tx
 * still succeeds. Returns { signature, fromPubkey, toPubkey }.
 */
export async function sendUserToHotProof(
  userId: string,
  solAmount: number,
): Promise<{ signature: string; fromPubkey: string; toPubkey: string }> {
  const web3 = await import("@solana/web3.js");
  const {
    Connection,
    PublicKey,
    Transaction,
    SystemProgram,
    sendAndConfirmTransaction,
    LAMPORTS_PER_SOL,
  } = web3;

  // Load user wallet
  const { data: secretRow, error: sErr } = await supabaseAdmin
    .from("custodial_wallet_secrets")
    .select("encrypted_secret")
    .eq("user_id", userId)
    .maybeSingle();
  if (sErr) throw sErr;
  if (!secretRow?.encrypted_secret) {
    throw new Error("Your system wallet hasn't been provisioned yet. Please complete signup first.");
  }
  const userKp = await loadKeypair(secretRow.encrypted_secret);

  // Load hot wallet pubkey + secret (for top-up if needed)
  const { data: master, error: mErr } = await supabaseAdmin
    .from("master_wallet")
    .select("pubkey, encrypted_secret")
    .eq("id", true)
    .maybeSingle();
  if (mErr) throw mErr;
  if (!master?.pubkey || !master.encrypted_secret) {
    throw new Error("Platform hot wallet not initialised");
  }
  const hotPubkey = new PublicKey(master.pubkey);

  const connection = await pickWorkingConnection();
  void Connection;
  const lamports = Math.round(solAmount * LAMPORTS_PER_SOL);
  const feeBuffer = 10_000; // ~2x signature fee headroom

  // Top up the user wallet if it can't cover the transfer + fees.
  const balance = await connection.getBalance(userKp.publicKey).catch(() => 0);
  if (balance < lamports + feeBuffer) {
    const masterKp = await loadKeypair(master.encrypted_secret);
    const needed = lamports + feeBuffer - balance + 5_000_000; // add 0.005 SOL headroom
    const topUp = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: masterKp.publicKey,
        toPubkey: userKp.publicKey,
        lamports: needed,
      }),
    );
    await sendAndConfirmTransaction(connection, topUp, [masterKp], { commitment: "confirmed" });
  }

  // The actual proof: user wallet → hot wallet
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: userKp.publicKey,
      toPubkey: hotPubkey,
      lamports,
    }),
  );
  const signature = await sendAndConfirmTransaction(connection, tx, [userKp], {
    commitment: "confirmed",
  });

  return {
    signature,
    fromPubkey: userKp.publicKey.toBase58(),
    toPubkey: hotPubkey.toBase58(),
  };
}
