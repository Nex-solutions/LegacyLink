// Server-only: SPL USDC sweeps + payouts + just-in-time gas top-up.
// All flows assume Solana cluster comes from SOLANA_RPC. On devnet, USDC mint
// is the test mint already wired in solana.server.ts.

import * as solanaWeb3 from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptSecret } from "./solana.server";

const { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } = solanaWeb3;
type Connection = solanaWeb3.Connection;
type Keypair = solanaWeb3.Keypair;
type PublicKey = solanaWeb3.PublicKey;

const USDC_DECIMALS = 6;
const MIN_USER_GAS_LAMPORTS = 1_500_000; // ~0.0015 SOL
const TOP_UP_LAMPORTS = 5_000_000; // 0.005 SOL

function getRpcUrl(): string {
  return process.env.SOLANA_RPC || "https://api.devnet.solana.com";
}

function getUsdcMint(): PublicKey {
  const m = process.env.SOLANA_USDC_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
  return new PublicKey(m);
}

function getConnection(): Connection {
  return new Connection(getRpcUrl(), "confirmed");
}

async function loadKeypairFromSecret(encryptedSecret: string): Promise<Keypair> {
  const raw = await decryptSecret(encryptedSecret);
  return Keypair.fromSecretKey(raw);
}

async function loadMaster(): Promise<Keypair> {
  const { data, error } = await supabaseAdmin
    .from("master_wallet")
    .select("encrypted_secret")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  if (!data?.encrypted_secret) throw new Error("Master wallet not initialised");
  return loadKeypairFromSecret(data.encrypted_secret);
}

async function loadUserKeypair(userId: string): Promise<Keypair> {
  const { data, error } = await supabaseAdmin
    .from("custodial_wallet_secrets")
    .select("encrypted_secret")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.encrypted_secret) throw new Error(`No custodial wallet for user ${userId}`);
  return loadKeypairFromSecret(data.encrypted_secret);
}

async function feeLamportsFromSig(connection: Connection, sig: string): Promise<number> {
  try {
    const tx = await connection.getTransaction(sig, { maxSupportedTransactionVersion: 0 });
    return tx?.meta?.fee ?? 5000;
  } catch {
    return 5000;
  }
}

// ──────────────── Gas top-up ────────────────
export async function topUpUserGas(userId: string): Promise<{ topped: boolean; signature?: string }> {
  const connection = getConnection();
  const { data: wallet } = await supabaseAdmin
    .from("custodial_wallets")
    .select("pubkey")
    .eq("user_id", userId)
    .maybeSingle();
  if (!wallet?.pubkey) throw new Error("user wallet not found");

  const userPk = new PublicKey(wallet.pubkey);
  const balance = await connection.getBalance(userPk).catch(() => 0);
  if (balance >= MIN_USER_GAS_LAMPORTS) return { topped: false };

  const master = await loadMaster();
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: master.publicKey,
      toPubkey: userPk,
      lamports: TOP_UP_LAMPORTS,
    })
  );
  const signature = await solanaWeb3.sendAndConfirmTransaction(connection, tx, [master], {
    commitment: "confirmed",
  });
  return { topped: true, signature };
}

// ──────────────── Sweep user USDC → master ────────────────
export async function sweepUserToMaster(args: {
  userId: string;
  amountUsdc: number;
}): Promise<{ signature: string; gasLamports: number }> {
  const connection = getConnection();
  const master = await loadMaster();
  const user = await loadUserKeypair(args.userId);
  const mint = getUsdcMint();

  await topUpUserGas(args.userId);

  const userAta = getAssociatedTokenAddressSync(mint, user.publicKey);
  const masterAta = getAssociatedTokenAddressSync(mint, master.publicKey);

  const tx = new Transaction();

  // Ensure master ATA exists (master pays rent).
  const masterAtaInfo = await connection.getAccountInfo(masterAta);
  if (!masterAtaInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        master.publicKey,
        masterAta,
        master.publicKey,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  const amountUnits = BigInt(Math.round(args.amountUsdc * 10 ** USDC_DECIMALS));
  tx.add(
    createTransferCheckedInstruction(
      userAta,
      mint,
      masterAta,
      user.publicKey,
      amountUnits,
      USDC_DECIMALS
    )
  );

  const signature = await solanaWeb3.sendAndConfirmTransaction(
    connection,
    tx,
    [user, master],
    { commitment: "confirmed" }
  );
  const gasLamports = await feeLamportsFromSig(connection, signature);
  return { signature, gasLamports };
}

// ──────────────── Payout master → external address ────────────────
export async function payoutFromMaster(args: {
  toAddress: string;
  amountUsdc: number;
}): Promise<{ signature: string; gasLamports: number }> {
  const connection = getConnection();
  const master = await loadMaster();
  const mint = getUsdcMint();
  const dest = new PublicKey(args.toAddress);

  const masterAta = getAssociatedTokenAddressSync(mint, master.publicKey);
  const destAta = getAssociatedTokenAddressSync(mint, dest, true);

  const tx = new Transaction();
  const destInfo = await connection.getAccountInfo(destAta);
  if (!destInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        master.publicKey,
        destAta,
        dest,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  const amountUnits = BigInt(Math.round(args.amountUsdc * 10 ** USDC_DECIMALS));
  tx.add(
    createTransferCheckedInstruction(
      masterAta,
      mint,
      destAta,
      master.publicKey,
      amountUnits,
      USDC_DECIMALS
    )
  );

  const signature = await solanaWeb3.sendAndConfirmTransaction(
    connection,
    tx,
    [master],
    { commitment: "confirmed" }
  );
  const gasLamports = await feeLamportsFromSig(connection, signature);
  return { signature, gasLamports };
}

// ──────────────── Master SOL balance ────────────────
export async function getMasterGasBalance(): Promise<{ lamports: number; sol: number }> {
  const connection = getConnection();
  const master = await loadMaster();
  const lamports = await connection.getBalance(master.publicKey).catch(() => 0);
  return { lamports, sol: lamports / LAMPORTS_PER_SOL };
}
