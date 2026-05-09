// Server-only: SPL USDC sweeps + payouts + just-in-time gas top-up.
// All flows assume Solana cluster comes from SOLANA_RPC. On devnet, USDC mint
// is the test mint already wired in solana.server.ts.

// Lazy: @solana/web3.js + @solana/spl-token use __filename at module init,
// which crashes Cloudflare Worker SSR. Load inside functions only.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptSecret } from "./solana.server";
import { getSolanaRpcUrl } from "./solana-rpc.server";

import type { Connection, Keypair, PublicKey } from "@solana/web3.js";

let _web3: Promise<typeof import("@solana/web3.js")> | undefined;
let _spl: Promise<typeof import("@solana/spl-token")> | undefined;
const loadWeb3 = () => (_web3 ??= import("@solana/web3.js"));
const loadSpl = () => (_spl ??= import("@solana/spl-token"));

const USDC_DECIMALS = 6;
const MIN_USER_GAS_LAMPORTS = 1_500_000; // ~0.0015 SOL
const TOP_UP_LAMPORTS = 5_000_000; // 0.005 SOL

function getRpcUrl(): string {
  return getSolanaRpcUrl();
}

async function getUsdcMint(): Promise<PublicKey> {
  const m = process.env.SOLANA_USDC_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
  const { PublicKey } = await loadWeb3();
  return new PublicKey(m);
}

async function getConnection(): Promise<Connection> {
  const { Connection } = await loadWeb3();
  return new Connection(getRpcUrl(), "confirmed");
}

async function loadKeypairFromSecret(encryptedSecret: string): Promise<Keypair> {
  const raw = await decryptSecret(encryptedSecret);
  const { Keypair } = await loadWeb3();
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
  const { PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } = await loadWeb3();
  const connection = await getConnection();
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
  const signature = await sendAndConfirmTransaction(connection, tx, [master], {
    commitment: "confirmed",
  });
  return { topped: true, signature };
}

// ──────────────── Sweep user USDC → master ────────────────
export async function sweepUserToMaster(args: {
  userId: string;
  amountUsdc: number;
}): Promise<{ signature: string; gasLamports: number }> {
  const { Transaction, sendAndConfirmTransaction } = await loadWeb3();
  const {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
    createTransferCheckedInstruction,
  } = await loadSpl();
  const connection = await getConnection();
  const master = await loadMaster();
  const user = await loadUserKeypair(args.userId);
  const mint = await getUsdcMint();

  await topUpUserGas(args.userId);

  const userAta = getAssociatedTokenAddressSync(mint, user.publicKey);
  const masterAta = getAssociatedTokenAddressSync(mint, master.publicKey);

  const tx = new Transaction();

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

  const signature = await sendAndConfirmTransaction(connection, tx, [user, master], {
    commitment: "confirmed",
  });
  const gasLamports = await feeLamportsFromSig(connection, signature);
  return { signature, gasLamports };
}

// ──────────────── Payout master → external address ────────────────
export async function payoutFromMaster(args: {
  toAddress: string;
  amountUsdc: number;
}): Promise<{ signature: string; gasLamports: number }> {
  const { PublicKey, Transaction, sendAndConfirmTransaction } = await loadWeb3();
  const {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
    createTransferCheckedInstruction,
  } = await loadSpl();
  const connection = await getConnection();
  const master = await loadMaster();
  const mint = await getUsdcMint();
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

  const signature = await sendAndConfirmTransaction(connection, tx, [master], {
    commitment: "confirmed",
  });
  const gasLamports = await feeLamportsFromSig(connection, signature);
  return { signature, gasLamports };
}

// ──────────────── Master SOL balance ────────────────
export async function getMasterGasBalance(): Promise<{ lamports: number; sol: number }> {
  const { LAMPORTS_PER_SOL } = await loadWeb3();
  const connection = await getConnection();
  const master = await loadMaster();
  const lamports = await connection.getBalance(master.publicKey).catch(() => 0);
  return { lamports, sol: lamports / LAMPORTS_PER_SOL };
}
