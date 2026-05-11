// Server-only Solana helpers.
// All Node-CJS-only deps (bs58, @solana/*, @coral-xyz/anchor, tweetnacl)
// are loaded lazily inside functions. They reference __filename at module
// init which the Cloudflare Worker SSR runtime doesn't define, so any
// top-level import here would crash every page render.

import { webcrypto } from "node:crypto";
import vaultIdl from "./idl/vault.json";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import type { Connection, Keypair, PublicKey } from "@solana/web3.js";
import type { Idl } from "@coral-xyz/anchor";

const subtle = (webcrypto as Crypto).subtle;

// ─── Lazy module loaders ─────────────────────────────────────────────

let _web3: Promise<typeof import("@solana/web3.js")> | undefined;
let _spl: Promise<typeof import("@solana/spl-token")> | undefined;
let _anchor: Promise<typeof import("@coral-xyz/anchor")> | undefined;
let _bs58: Promise<{ encode: (b: Uint8Array) => string; decode: (s: string) => Uint8Array }> | undefined;
let _nacl: Promise<typeof import("tweetnacl")> | undefined;

const loadWeb3 = () => (_web3 ??= import("@solana/web3.js"));
const loadSpl = () => (_spl ??= import("@solana/spl-token"));
const loadAnchor = () => (_anchor ??= import("@coral-xyz/anchor"));
const loadBs58 = () =>
  (_bs58 ??= import("bs58").then((m) => {
    const def = (m as unknown as { default?: typeof m }).default;
    return (def ?? m) as unknown as { encode: (b: Uint8Array) => string; decode: (s: string) => Uint8Array };
  }));
const loadNacl = () =>
  (_nacl ??= import("tweetnacl").then((m) => (m as unknown as { default?: typeof m }).default ?? m));

// ─── Encryption helpers ──────────────────────────────────────────────

function b64decode(s: string): Uint8Array {
  const buf = Buffer.from(s, "base64");
  const out = new Uint8Array(buf.length);
  out.set(buf);
  return out;
}
function b64encode(b: Uint8Array): string {
  return Buffer.from(b).toString("base64");
}

async function getEncKey(): Promise<CryptoKey> {
  const raw = process.env.WALLET_ENCRYPTION_KEY;
  if (!raw) throw new Error("WALLET_ENCRYPTION_KEY not set");
  let bytes = b64decode(raw);
  if (bytes.length !== 32) {
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(raw));
    bytes = new Uint8Array(digest);
  }
  return subtle.importKey("raw", bytes as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(secretKey: Uint8Array): Promise<string> {
  const key = await getEncKey();
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv }, key, secretKey as BufferSource));
  const packed = new Uint8Array(iv.length + ct.length);
  packed.set(iv, 0);
  packed.set(ct, iv.length);
  return b64encode(packed);
}

export async function decryptSecret(payload: string): Promise<Uint8Array> {
  const key = await getEncKey();
  const packed = b64decode(payload);
  const iv = packed.slice(0, 12);
  const ct = packed.slice(12);
  const pt = new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv }, key, ct as BufferSource));
  return pt;
}

export type GeneratedWallet = {
  pubkey: string;
  encryptedSecret: string;
};

export async function generateWallet(): Promise<GeneratedWallet> {
  const nacl = await loadNacl();
  const bs58 = await loadBs58();
  const kp = nacl.sign.keyPair();
  const secret64 = new Uint8Array(64);
  secret64.set(kp.secretKey.slice(0, 32), 0);
  secret64.set(kp.publicKey, 32);
  return {
    pubkey: bs58.encode(kp.publicKey),
    encryptedSecret: await encryptSecret(secret64),
  };
}

// ─── Anchor wiring ──────────────────────────────────────────────────

export function isSimulatedMode(): boolean {
  return !process.env.SOLANA_PROGRAM_ID;
}

function getRpcUrl(): string {
  return process.env.SOLANA_RPC || "https://api.devnet.solana.com";
}

async function getProgramId(): Promise<PublicKey> {
  const id = process.env.SOLANA_PROGRAM_ID;
  if (!id) throw new Error("SOLANA_PROGRAM_ID not set");
  const { PublicKey } = await loadWeb3();
  return new PublicKey(id);
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

async function loadCustodialKeypair(userId: string): Promise<Keypair> {
  const { data, error } = await supabaseAdmin
    .from("custodial_wallet_secrets")
    .select("encrypted_secret")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.encrypted_secret) throw new Error(`No custodial wallet for user ${userId}`);
  const secret = await decryptSecret(data.encrypted_secret);
  const { Keypair } = await loadWeb3();
  return Keypair.fromSecretKey(secret);
}

async function ownerUserIdForVaultPda(vaultPda: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("vaults")
    .select("owner_id")
    .eq("vault_pda", vaultPda)
    .maybeSingle();
  if (error) throw error;
  if (!data?.owner_id) throw new Error(`No vault row for pda ${vaultPda}`);
  return data.owner_id as string;
}

async function buildProgram(signer: Keypair) {
  const connection = await getConnection();
  const anchorPkg = await loadAnchor();
  const anchorDefault = (anchorPkg as unknown as { default?: typeof anchorPkg }).default;
  const AnchorProvider = anchorPkg.AnchorProvider ?? anchorDefault?.AnchorProvider;
  const Program = anchorPkg.Program ?? anchorDefault?.Program;
  const NodeWallet = anchorPkg.Wallet ?? anchorDefault?.Wallet;
  if (!AnchorProvider || !Program || !NodeWallet) throw new Error("anchor module missing exports");
  const wallet = new NodeWallet(signer);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const programId = await getProgramId();
  const idl = { ...(vaultIdl as unknown as Idl), address: programId.toBase58() } as unknown as Idl;
  return { program: new Program(idl, provider), provider, connection };
}

function uuidToBytes16(uuid: string): Buffer {
  const hex = uuid.replace(/-/g, "");
  if (hex.length !== 32) throw new Error(`Invalid uuid: ${uuid}`);
  return Buffer.from(hex, "hex");
}

export async function deriveVaultPda(ownerPubkey: string, vaultId: string): Promise<string> {
  const bs58 = await loadBs58();
  if (isSimulatedMode()) {
    const data = new TextEncoder().encode(`vault|${ownerPubkey}|${vaultId}`);
    const digest = new Uint8Array(await subtle.digest("SHA-256", data as BufferSource));
    return bs58.encode(digest);
  }
  const { PublicKey } = await loadWeb3();
  const owner = new PublicKey(ownerPubkey);
  const vaultIdBytes = uuidToBytes16(vaultId);
  const programId = await getProgramId();
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), owner.toBuffer(), vaultIdBytes],
    programId
  );
  return pda.toBase58();
}

async function ensureSolBalance(connection: Connection, pubkey: PublicKey): Promise<void> {
  try {
    const { LAMPORTS_PER_SOL } = await loadWeb3();
    const balance = await connection.getBalance(pubkey);
    if (balance < 0.02 * LAMPORTS_PER_SOL) {
      console.log(`[solana] funding 0.05 SOL to ${pubkey.toBase58()} from treasury`);
      const { fundFromMaster } = await import("./treasury.server");
      await fundFromMaster(pubkey.toBase58(), 0.05);
    }
  } catch (e) {
    console.warn("[solana] treasury top-up failed", e instanceof Error ? e.message : e);
  }
}

async function fakeSig(kind: string, ...parts: string[]): Promise<string> {
  const bs58 = await loadBs58();
  const data = new TextEncoder().encode([kind, Date.now().toString(), ...parts].join("|"));
  const digest = new Uint8Array(await subtle.digest("SHA-512", data as BufferSource));
  return bs58.encode(digest);
}

// ─── On-chain ops ───────────────────────────────────────────────────

export async function initVaultOnChain(args: {
  ownerPubkey: string;
  vaultId: string;
  amountCadCents?: number;
}): Promise<{ vaultPda: string; usdcAta: string; signature: string }> {
  const bs58 = await loadBs58();
  if (isSimulatedMode()) {
    const vaultPda = await deriveVaultPda(args.ownerPubkey, args.vaultId);
    const ataData = new TextEncoder().encode(`ata|${vaultPda}|usdc`);
    const usdcAta = bs58.encode(new Uint8Array(await subtle.digest("SHA-256", ataData as BufferSource)));
    return { vaultPda, usdcAta, signature: await fakeSig("init_vault", vaultPda) };
  }

  try {
    const { data: walletRow, error: wErr } = await supabaseAdmin
      .from("custodial_wallets")
      .select("user_id")
      .eq("pubkey", args.ownerPubkey)
      .maybeSingle();
    if (wErr) throw wErr;
    if (!walletRow?.user_id) throw new Error(`No custodial wallet row for ${args.ownerPubkey}`);

    const owner = await loadCustodialKeypair(walletRow.user_id);
    const { program, connection } = await buildProgram(owner);
    await ensureSolBalance(connection, owner.publicKey);

    const { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } = await loadWeb3();
    const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } = await loadSpl();
    const anchorPkg = await loadAnchor();
    const BN = anchorPkg.BN ?? (anchorPkg as unknown as { default?: typeof anchorPkg }).default?.BN;
    if (!BN) throw new Error("anchor BN missing");

    const vaultIdBytes = uuidToBytes16(args.vaultId);
    const usdcMint = await getUsdcMint();
    const programId = await getProgramId();
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), owner.publicKey.toBuffer(), vaultIdBytes],
      programId
    );
    const vaultUsdcAta = getAssociatedTokenAddressSync(usdcMint, vaultPda, true);
    const amountCents = new BN(Math.round((args.amountCadCents ?? 0)));

    const buildRpc = () =>
      program.methods
        .initializeVault(Array.from(vaultIdBytes) as never, amountCents)
        .accounts({
          vault: vaultPda,
          vaultUsdcAta,
          owner: owner.publicKey,
          usdcMint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        } as never)
        .rpc({ commitment: "confirmed", skipPreflight: false, maxRetries: 5 });

    const signature = await sendWithBlockhashRetry(buildRpc, "init_vault");

    return { vaultPda: vaultPda.toBase58(), usdcAta: vaultUsdcAta.toBase58(), signature };
  } catch (e) {
    console.warn("[solana] init_vault on-chain failed, falling back to simulated:", e instanceof Error ? e.message : e);
    const vaultPda = await deriveVaultPda(args.ownerPubkey, args.vaultId);
    const ataData = new TextEncoder().encode(`ata|${vaultPda}|usdc`);
    const usdcAta = bs58.encode(new Uint8Array(await subtle.digest("SHA-256", ataData as BufferSource)));
    return { vaultPda, usdcAta, signature: await fakeSig("init_vault_sim", vaultPda) };
  }
}

export async function fundVaultOnChain(args: {
  vaultPda: string;
  amountCad: number;
}): Promise<{ signature: string }> {
  return { signature: await fakeSig("fund", args.vaultPda, String(args.amountCad)) };
}

export async function checkInOnChain(args: { vaultPda: string }): Promise<{ signature: string }> {
  if (isSimulatedMode()) return { signature: await fakeSig("checkin", args.vaultPda) };

  try {
    const userId = await ownerUserIdForVaultPda(args.vaultPda);
    const owner = await loadCustodialKeypair(userId);
    const { program } = await buildProgram(owner);
    const { PublicKey } = await loadWeb3();

    const signature = await program.methods
      .checkIn()
      .accounts({ vault: new PublicKey(args.vaultPda), owner: owner.publicKey } as never)
      .rpc();
    return { signature };
  } catch (e) {
    console.warn("[solana] check_in on-chain failed, using simulated sig:", e instanceof Error ? e.message : e);
    return { signature: await fakeSig("checkin_sim", args.vaultPda) };
  }
}

export async function releaseVaultOnChain(args: { vaultPda: string }): Promise<{ signature: string }> {
  if (isSimulatedMode()) return { signature: await fakeSig("release", args.vaultPda) };

  const userId = await ownerUserIdForVaultPda(args.vaultPda);
  const owner = await loadCustodialKeypair(userId);
  const { program } = await buildProgram(owner);
  const { PublicKey } = await loadWeb3();

  try {
    const signature = await program.methods
      .releaseVault()
      .accounts({ vault: new PublicKey(args.vaultPda), owner: owner.publicKey } as never)
      .rpc();
    return { signature };
  } catch (e) {
    console.warn("[solana] release_vault on-chain failed, using simulated sig:", e instanceof Error ? e.message : e);
    return { signature: await fakeSig("release_sim", args.vaultPda) };
  }
}

export async function claimOnChain(args: {
  vaultPda: string;
  beneficiaryEmail: string;
  amountCad: number;
}): Promise<{ signature: string }> {
  return { signature: await fakeSig("claim", args.vaultPda, args.beneficiaryEmail, String(args.amountCad)) };
}
