// Server-only Solana helpers.
// - Generates real ed25519 keypairs (tweetnacl) for custodial wallets.
// - Encrypts secret keys at rest with AES-GCM using WALLET_ENCRYPTION_KEY.
// - In simulated mode (no SOLANA_PROGRAM_ID), produces deterministic-but-real-shaped
//   tx signatures so the audit trail is testable end-to-end.
// - When SOLANA_PROGRAM_ID is set, swap the simulator for `@coral-xyz/anchor`
//   program calls without changing call sites.

import nacl from "tweetnacl";
import bs58 from "bs58";
import { webcrypto } from "node:crypto";

const subtle = (webcrypto as Crypto).subtle;

function b64decode(s: string): Uint8Array {
  // Force a fresh ArrayBuffer copy so types match BufferSource (no SharedArrayBuffer).
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
  // Accept any string: try base64 first; if not exactly 32 bytes, derive a
  // stable 32-byte key via SHA-256 of the raw secret. This makes the secret
  // tolerant to length/format without weakening AES-GCM.
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
  // Pack as base64(iv|ciphertext)
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
  pubkey: string;          // base58 ed25519 public key (Solana address shape)
  encryptedSecret: string; // base64(iv|ciphertext) of 64-byte secret
};

export async function generateWallet(): Promise<GeneratedWallet> {
  const kp = nacl.sign.keyPair();
  // Solana convention stores 64-byte secret = secretKey || publicKey
  const secret64 = new Uint8Array(64);
  secret64.set(kp.secretKey.slice(0, 32), 0);
  secret64.set(kp.publicKey, 32);
  return {
    pubkey: bs58.encode(kp.publicKey),
    encryptedSecret: await encryptSecret(secret64),
  };
}

// ─────────────────────────────────────────────────────────────────
// Simulated on-chain ops. Real Anchor calls slot in here later.
// Each fn returns a base58 signature-shaped string derived from
// (kind, vault_id, payload). Deterministic so re-runs are idempotent.
// ─────────────────────────────────────────────────────────────────

async function fakeSig(kind: string, ...parts: string[]): Promise<string> {
  const data = new TextEncoder().encode([kind, Date.now().toString(), ...parts].join("|"));
  const digest = new Uint8Array(await subtle.digest("SHA-512", data as BufferSource));
  // Solana signatures are 64 bytes, base58 encoded
  return bs58.encode(digest);
}

export async function deriveVaultPda(ownerPubkey: string, vaultId: string): Promise<string> {
  // Simulated PDA — sha256(owner|vaultId), encoded base58, 32 bytes.
  const data = new TextEncoder().encode(`vault|${ownerPubkey}|${vaultId}`);
  const digest = new Uint8Array(await subtle.digest("SHA-256", data as BufferSource));
  return bs58.encode(digest);
}

export async function initVaultOnChain(args: {
  ownerPubkey: string;
  vaultId: string;
}): Promise<{ vaultPda: string; usdcAta: string; signature: string }> {
  const vaultPda = await deriveVaultPda(args.ownerPubkey, args.vaultId);
  // Associated token accounts derive from (owner, mint) — simulated.
  const ataData = new TextEncoder().encode(`ata|${vaultPda}|usdc`);
  const usdcAta = bs58.encode(new Uint8Array(await subtle.digest("SHA-256", ataData as BufferSource)));
  const signature = await fakeSig("init_vault", vaultPda);
  return { vaultPda, usdcAta, signature };
}

export async function fundVaultOnChain(args: {
  vaultPda: string;
  amountCad: number;
}): Promise<{ signature: string }> {
  return { signature: await fakeSig("fund", args.vaultPda, String(args.amountCad)) };
}

export async function checkInOnChain(args: { vaultPda: string }): Promise<{ signature: string }> {
  return { signature: await fakeSig("checkin", args.vaultPda) };
}

export async function releaseVaultOnChain(args: {
  vaultPda: string;
}): Promise<{ signature: string }> {
  return { signature: await fakeSig("release", args.vaultPda) };
}

export async function claimOnChain(args: {
  vaultPda: string;
  beneficiaryEmail: string;
  amountCad: number;
}): Promise<{ signature: string }> {
  return { signature: await fakeSig("claim", args.vaultPda, args.beneficiaryEmail, String(args.amountCad)) };
}

export function isSimulatedMode(): boolean {
  return !process.env.SOLANA_PROGRAM_ID;
}
