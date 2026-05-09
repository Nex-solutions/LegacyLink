// Server-only: send a small SOL transfer from a user's custodial wallet to the
// platform hot wallet. Used as a real on-chain proof that the user's signup
// wallet works end-to-end during vault creation.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptSecret } from "./solana.server";
import { getBalanceLamports, getLatestBlockhashDirect, getSolanaRpcUrl, sendRawTransactionDirect } from "./solana-rpc.server";

function getRpcUrl(): string {
  return getSolanaRpcUrl();
}

async function sendSignedTransfer(args: {
  from: Awaited<ReturnType<typeof loadKeypair>>;
  to: import("@solana/web3.js").PublicKey;
  lamports: number;
}): Promise<string> {
  const { Transaction, SystemProgram } = await import("@solana/web3.js");
  const { blockhash, lastValidBlockHeight } = await getLatestBlockhashDirect();
  const tx = new Transaction({ feePayer: args.from.publicKey, blockhash, lastValidBlockHeight }).add(
    SystemProgram.transfer({ fromPubkey: args.from.publicKey, toPubkey: args.to, lamports: args.lamports }),
  );
  tx.sign(args.from);
  return sendRawTransactionDirect(tx.serialize());
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

  const connection = new Connection(getRpcUrl(), "confirmed");
  const lamports = Math.round(solAmount * LAMPORTS_PER_SOL);
  const feeBuffer = 10_000; // ~2x signature fee headroom

  // Top up the user wallet if it can't cover the transfer + fees.
  const balance = await getBalanceLamports(userKp.publicKey.toBase58()).catch(() => 0);
  if (balance < lamports + feeBuffer) {
    const masterKp = await loadKeypair(master.encrypted_secret);
    const needed = lamports + feeBuffer - balance + 5_000_000; // add 0.005 SOL headroom
    await sendSignedTransfer({ from: masterKp, to: userKp.publicKey, lamports: needed });
  }

  // The actual proof: user wallet → hot wallet
  const signature = await sendSignedTransfer({ from: userKp, to: hotPubkey, lamports });

  return {
    signature,
    fromPubkey: userKp.publicKey.toBase58(),
    toPubkey: hotPubkey.toBase58(),
  };
}
