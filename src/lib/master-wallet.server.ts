// Server-only helpers for the platform's hot wallet (singleton).
// Stores the encrypted secret AND the encrypted BIP39 mnemonic so the operator
// can recover access. The mnemonic is only ever returned ONCE at init time.
import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import nacl from "tweetnacl";
import bs58 from "bs58";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { encryptSecret, decryptSecret } from "./solana.server";

const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";

export type MasterWalletInit = {
  pubkey: string;
  mnemonic: string; // shown ONCE — operator must save it offline
};

async function encryptText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  return encryptSecret(bytes);
}

async function decryptText(payload: string): Promise<string> {
  const bytes = await decryptSecret(payload);
  return new TextDecoder().decode(bytes);
}

export async function getMasterWallet(): Promise<{ pubkey: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("master_wallet")
    .select("pubkey")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  return data ? { pubkey: data.pubkey } : null;
}

export async function initMasterWallet(createdBy: string | null): Promise<MasterWalletInit> {
  const existing = await getMasterWallet();
  if (existing) {
    throw new Error("Master wallet already initialised");
  }

  const mnemonic = bip39.generateMnemonic(256); // 24 words
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const { key } = derivePath(SOLANA_DERIVATION_PATH, seed.toString("hex"));
  const kp = nacl.sign.keyPair.fromSeed(new Uint8Array(key));

  const secret64 = new Uint8Array(64);
  secret64.set(kp.secretKey.slice(0, 32), 0);
  secret64.set(kp.publicKey, 32);

  const pubkey = bs58.encode(kp.publicKey);
  const encryptedSecret = await encryptSecret(secret64);
  const encryptedMnemonic = await encryptText(mnemonic);

  const { error } = await supabaseAdmin.from("master_wallet").insert({
    id: true,
    pubkey,
    encrypted_secret: encryptedSecret,
    encrypted_mnemonic: encryptedMnemonic,
    created_by: createdBy,
  });
  if (error) throw error;

  return { pubkey, mnemonic };
}

export async function revealMasterMnemonic(): Promise<{ pubkey: string; mnemonic: string }> {
  const { data, error } = await supabaseAdmin
    .from("master_wallet")
    .select("pubkey, encrypted_mnemonic")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Master wallet not initialised");
  const mnemonic = await decryptText(data.encrypted_mnemonic);
  return { pubkey: data.pubkey, mnemonic };
}
