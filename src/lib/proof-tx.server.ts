// Server-only: send small SOL transfers for the demo money movement.
// Vault creation proves user wallet → platform hot wallet; beneficiary claim
// proves platform hot wallet → beneficiary wallet for payout/off-ramp.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptSecret } from "./solana.server";

import type { Signer, Transaction } from "@solana/web3.js";

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

async function sendWithFreshBlockhash(
  connection: Awaited<ReturnType<typeof pickWorkingConnection>>,
  buildTx: (fresh: { blockhash: string; lastValidBlockHeight: number }) => Transaction,
  signers: Signer[],
  label: string,
  attempts = 4,
): Promise<string> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const fresh = await connection.getLatestBlockhash("confirmed");
      const tx = buildTx(fresh);
      tx.sign(...signers);
      const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3,
      });
      return signature;
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      const transient = /block height exceeded|blockhash not found|expired|TransactionExpired|timeout|429|503|rate limit|fetch failed|network/i.test(msg);
      if (!transient) throw error;
      const delay = 350 * Math.pow(2, i);
      console.warn(`[proof-tx] ${label} transient retry ${i + 1}/${attempts}`, msg);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
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
  const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = web3;

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
  const masterKp = await loadKeypair(master.encrypted_secret);

  const connection = await pickWorkingConnection();
  void Connection;
  const lamports = Math.round(solAmount * LAMPORTS_PER_SOL);
  const FEE_BUFFER = 10_000; // ~5k lamports per sig + cushion
  const userBalance = await connection.getBalance(userKp.publicKey).catch(() => 0);
  const needed = lamports + FEE_BUFFER;

  // If user wallet is short, top it up FIRST in a separate transaction so the
  // proof transaction is a clean unidirectional user → hot wallet transfer.
  if (userBalance < needed) {
    const topUpLamports = needed - userBalance;
    await sendWithFreshBlockhash(
      connection,
      ({ blockhash, lastValidBlockHeight }) => {
        const tx = new Transaction({ feePayer: masterKp.publicKey, blockhash, lastValidBlockHeight });
        tx.add(
          SystemProgram.transfer({
            fromPubkey: masterKp.publicKey,
            toPubkey: userKp.publicKey,
            lamports: topUpLamports,
          }),
        );
        return tx;
      },
      [masterKp],
      "user wallet top-up",
    );
    // Brief wait so the next tx sees the new balance.
    await new Promise((r) => setTimeout(r, 1500));
  }

  // Clean proof tx: user wallet pays fees AND sends SOL to hot wallet.
  const signature = await sendWithFreshBlockhash(
    connection,
    ({ blockhash, lastValidBlockHeight }) => {
      const tx = new Transaction({ feePayer: userKp.publicKey, blockhash, lastValidBlockHeight });
      tx.add(
        SystemProgram.transfer({
          fromPubkey: userKp.publicKey,
          toPubkey: hotPubkey,
          lamports,
        }),
      );
      return tx;
    },
    [userKp],
    "vault proof transfer",
  );

  return {
    signature,
    fromPubkey: userKp.publicKey.toBase58(),
    toPubkey: hotPubkey.toBase58(),
  };
}

/**
 * Send `solAmount` SOL from the platform hot wallet to the beneficiary's
 * claim wallet. If the beneficiary has no wallet yet, create a receiving
 * wallet address and store only the public key on the beneficiary row.
 */
export async function sendHotToBeneficiaryClaim(
  beneficiaryId: string,
  solAmount: number,
): Promise<{ signature: string; fromPubkey: string; toPubkey: string }> {
  const web3 = await import("@solana/web3.js");
  const { PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } = web3;

  const { data: beneficiary, error: bErr } = await supabaseAdmin
    .from("beneficiaries")
    .select("wallet_pubkey")
    .eq("id", beneficiaryId)
    .maybeSingle();
  if (bErr) throw bErr;
  if (!beneficiary) throw new Error("Beneficiary not found");

  let beneficiaryPubkey: PublicKey;
  if (beneficiary.wallet_pubkey) {
    beneficiaryPubkey = new PublicKey(beneficiary.wallet_pubkey);
  } else {
    const claimWallet = Keypair.generate();
    beneficiaryPubkey = claimWallet.publicKey;
    const { error: updateErr } = await supabaseAdmin
      .from("beneficiaries")
      .update({ wallet_pubkey: beneficiaryPubkey.toBase58() })
      .eq("id", beneficiaryId);
    if (updateErr) throw updateErr;
  }

  const { data: master, error: mErr } = await supabaseAdmin
    .from("master_wallet")
    .select("encrypted_secret")
    .eq("id", true)
    .maybeSingle();
  if (mErr) throw mErr;
  if (!master?.encrypted_secret) {
    throw new Error("Platform hot wallet not initialised");
  }

  const hotKp = await loadKeypair(master.encrypted_secret);
  const connection = await pickWorkingConnection();
  const lamports = Math.round(solAmount * LAMPORTS_PER_SOL);
  const hotBalance = await connection.getBalance(hotKp.publicKey).catch(() => 0);
  if (hotBalance < lamports + 10_000) {
    throw new Error("Platform hot wallet has insufficient devnet SOL for claim payout");
  }

  const signature = await sendWithFreshBlockhash(
    connection,
    ({ blockhash, lastValidBlockHeight }) => {
      const tx = new Transaction({ feePayer: hotKp.publicKey, blockhash, lastValidBlockHeight });
      tx.add(
        SystemProgram.transfer({
          fromPubkey: hotKp.publicKey,
          toPubkey: beneficiaryPubkey,
          lamports,
        }),
      );
      return tx;
    },
    [hotKp],
    "beneficiary claim payout",
  );

  return {
    signature,
    fromPubkey: hotKp.publicKey.toBase58(),
    toPubkey: beneficiaryPubkey.toBase58(),
  };
}
