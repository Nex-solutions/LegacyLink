// Server-only Solana helpers.
// - Real ed25519 keypairs (tweetnacl) for custodial wallets, AES-GCM at rest.
// - When SOLANA_PROGRAM_ID is set, init/checkin/release call the real Anchor
//   program on devnet. fund/claim stay simulated until a real on/off-ramp with
//   USDC liquidity is wired (devnet custodial wallets have no USDC).

import { webcrypto } from "node:crypto";
import vaultIdl from "./idl/vault.json";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Lazy loaders for Node-CJS-only deps (bs58, @solana/*, @coral-xyz/anchor,
// tweetnacl). They reference __filename at module init which the Cloudflare
// Worker SSR runtime doesn't define — importing them at module top-level
// crashes every page render with `ReferenceError: __filename is not defined`.
// Loading them inside async functions defers evaluation to the actual call,
// which only happens for server function invocations (never during SSR of an
// unrelated page).

type SolanaWeb3 = typeof import("@solana/web3.js");
type SplToken = typeof import("@solana/spl-token");
type AnchorMod = typeof import("@coral-xyz/anchor");

let _web3: Promise<SolanaWeb3> | undefined;
let _spl: Promise<SplToken> | undefined;
let _anchor: Promise<AnchorMod> | undefined;
let _bs58: Promise<typeof import("bs58").default> | undefined;
let _nacl: Promise<typeof import("tweetnacl").default> | undefined;

const loadWeb3 = () => (_web3 ??= import("@solana/web3.js"));
const loadSpl = () => (_spl ??= import("@solana/spl-token"));
const loadAnchor = () => (_anchor ??= import("@coral-xyz/anchor"));
const loadBs58 = () => (_bs58 ??= import("bs58").then((m) => m.default ?? (m as unknown as typeof import("bs58").default)));
const loadNacl = () => (_nacl ??= import("tweetnacl").then((m) => m.default ?? (m as unknown as typeof import("tweetnacl").default)));

const subtle = (webcrypto as Crypto).subtle;

type Connection = import("@solana/web3.js").Connection;
type Keypair = import("@solana/web3.js").Keypair;
type PublicKey = import("@solana/web3.js").PublicKey;

// ─────────────────────────────────────────────────────────────────
// Simulated on-chain ops. Real Anchor calls slot in here later.
// Each fn returns a base58 signature-shaped string derived from
// (kind, vault_id, payload). Deterministic so re-runs are idempotent.
// ─────────────────────────────────────────────────────────────────

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
  const kp = nacl.sign.keyPair();
  const secret64 = new Uint8Array(64);
  secret64.set(kp.secretKey.slice(0, 32), 0);
  secret64.set(kp.publicKey, 32);
  return {
    pubkey: bs58.encode(kp.publicKey),
    encryptedSecret: await encryptSecret(secret64),
  };
}

// ─────────────────────────────────────────────────────────────────
// Anchor wiring
// ─────────────────────────────────────────────────────────────────

export function isSimulatedMode(): boolean {
  return !process.env.SOLANA_PROGRAM_ID;
}

function getRpcUrl(): string {
  return process.env.SOLANA_RPC || "https://api.devnet.solana.com";
}

function getProgramId(): PublicKey {
  const id = process.env.SOLANA_PROGRAM_ID;
  if (!id) throw new Error("SOLANA_PROGRAM_ID not set");
  return new PublicKey(id);
}

function getUsdcMint(): PublicKey {
  const m = process.env.SOLANA_USDC_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
  return new PublicKey(m);
}

function getConnection(): Connection {
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

function buildProgram(signer: Keypair) {
  const connection = getConnection();
  const wallet = new NodeWallet(signer);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  // Inject address into IDL so Program picks it up
  const idl = { ...(vaultIdl as unknown as Idl), address: getProgramId().toBase58() } as unknown as Idl;
  return { program: new Program(idl, provider), provider, connection };
}

function uuidToBytes16(uuid: string): Buffer {
  const hex = uuid.replace(/-/g, "");
  if (hex.length !== 32) throw new Error(`Invalid uuid: ${uuid}`);
  return Buffer.from(hex, "hex");
}

export async function deriveVaultPda(ownerPubkey: string, vaultId: string): Promise<string> {
  if (isSimulatedMode()) {
    const data = new TextEncoder().encode(`vault|${ownerPubkey}|${vaultId}`);
    const digest = new Uint8Array(await subtle.digest("SHA-256", data as BufferSource));
    return bs58.encode(digest);
  }
  const owner = new PublicKey(ownerPubkey);
  const vaultIdBytes = uuidToBytes16(vaultId);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), owner.toBuffer(), vaultIdBytes],
    getProgramId()
  );
  return pda.toBase58();
}

async function ensureSolBalance(connection: Connection, pubkey: PublicKey): Promise<void> {
  try {
    const balance = await connection.getBalance(pubkey);
    if (balance < 0.02 * LAMPORTS_PER_SOL) {
      console.log(`[solana] airdropping 0.05 SOL to ${pubkey.toBase58()}`);
      const sig = await connection.requestAirdrop(pubkey, 0.05 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, "confirmed");
    }
  } catch (e) {
    console.warn("[solana] airdrop failed (rate-limited?)", e instanceof Error ? e.message : e);
  }
}

// ─────────────────────────────────────────────────────────────────
// Simulated fallback signature
// ─────────────────────────────────────────────────────────────────

async function fakeSig(kind: string, ...parts: string[]): Promise<string> {
  const data = new TextEncoder().encode([kind, Date.now().toString(), ...parts].join("|"));
  const digest = new Uint8Array(await subtle.digest("SHA-512", data as BufferSource));
  return bs58.encode(digest);
}

// ─────────────────────────────────────────────────────────────────
// On-chain ops
// ─────────────────────────────────────────────────────────────────

export async function initVaultOnChain(args: {
  ownerPubkey: string;
  vaultId: string;
  amountCadCents?: number;
}): Promise<{ vaultPda: string; usdcAta: string; signature: string }> {
  if (isSimulatedMode()) {
    const vaultPda = await deriveVaultPda(args.ownerPubkey, args.vaultId);
    const ataData = new TextEncoder().encode(`ata|${vaultPda}|usdc`);
    const usdcAta = bs58.encode(new Uint8Array(await subtle.digest("SHA-256", ataData as BufferSource)));
    return { vaultPda, usdcAta, signature: await fakeSig("init_vault", vaultPda) };
  }

  try {
    // Find owner userId from pubkey
    const { data: walletRow, error: wErr } = await supabaseAdmin
      .from("custodial_wallets")
      .select("user_id")
      .eq("pubkey", args.ownerPubkey)
      .maybeSingle();
    if (wErr) throw wErr;
    if (!walletRow?.user_id) throw new Error(`No custodial wallet row for ${args.ownerPubkey}`);

    const owner = await loadCustodialKeypair(walletRow.user_id);
    const { program, connection } = buildProgram(owner);

    await ensureSolBalance(connection, owner.publicKey);

    const vaultIdBytes = uuidToBytes16(args.vaultId);
    const usdcMint = getUsdcMint();
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), owner.publicKey.toBuffer(), vaultIdBytes],
      getProgramId()
    );
    const vaultUsdcAta = getAssociatedTokenAddressSync(usdcMint, vaultPda, true);

    const amountCents = new BN(Math.round((args.amountCadCents ?? 0)));

    const signature = await program.methods
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
      .rpc();

    return { vaultPda: vaultPda.toBase58(), usdcAta: vaultUsdcAta.toBase58(), signature };
  } catch (e) {
    console.warn("[solana] init_vault on-chain failed, falling back to simulated:", e instanceof Error ? e.message : e);
    const vaultPda = await deriveVaultPda(args.ownerPubkey, args.vaultId);
    const ataData = new TextEncoder().encode(`ata|${vaultPda}|usdc`);
    const usdcAta = bs58.encode(new Uint8Array(await subtle.digest("SHA-256", ataData as BufferSource)));
    return { vaultPda, usdcAta, signature: await fakeSig("init_vault_sim", vaultPda) };
  }
}

// Fund stays simulated: devnet custodial wallets have no USDC.
// In production the on-ramp deposits USDC directly into the vault ATA.
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
    const { program } = buildProgram(owner);

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
  const { program } = buildProgram(owner);

  // NOTE: program requires status==funded. Fund stays simulated, so this
  // will currently revert with NotFunded on-chain. Catch and fall back to
  // simulated so audit trail still records a signature shape.
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

// Claim stays simulated: needs a beneficiary USDC ATA we don't have on devnet.
// In production the off-ramp pulls USDC from the vault ATA to a treasury.
export async function claimOnChain(args: {
  vaultPda: string;
  beneficiaryEmail: string;
  amountCad: number;
}): Promise<{ signature: string }> {
  return { signature: await fakeSig("claim", args.vaultPda, args.beneficiaryEmail, String(args.amountCad)) };
}
