import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { webcrypto } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const subtle = webcrypto.subtle;
const url = process.env.SUPABASE_URL;
const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
const encKeyRaw = process.env.WALLET_ENCRYPTION_KEY;
if (!url || !srk || !encKeyRaw) { console.error("missing env"); process.exit(1); }

function b64dec(s){return new Uint8Array(Buffer.from(s,"base64"));}
function b64enc(b){return Buffer.from(b).toString("base64");}
async function getKey(){
  let bytes = b64dec(encKeyRaw);
  if (bytes.length !== 32) {
    const d = await subtle.digest("SHA-256", new TextEncoder().encode(encKeyRaw));
    bytes = new Uint8Array(d);
  }
  return subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt","decrypt"]);
}
async function enc(bytes){
  const key = await getKey();
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle.encrypt({name:"AES-GCM",iv}, key, bytes));
  const out = new Uint8Array(iv.length+ct.length); out.set(iv,0); out.set(ct,iv.length);
  return b64enc(out);
}

const sb = createClient(url, srk);
const { data: existing } = await sb.from("master_wallet").select("pubkey").eq("id", true).maybeSingle();
if (existing) { console.log("ALREADY EXISTS:", existing.pubkey); process.exit(0); }

const mnemonic = bip39.generateMnemonic(256);
const seed = await bip39.mnemonicToSeed(mnemonic);
const { key } = derivePath("m/44'/501'/0'/0'", seed.toString("hex"));
const kp = nacl.sign.keyPair.fromSeed(new Uint8Array(key));
const secret64 = new Uint8Array(64);
secret64.set(kp.secretKey.slice(0,32),0);
secret64.set(kp.publicKey,32);
const pubkey = bs58.encode(kp.publicKey);

const { error } = await sb.from("master_wallet").insert({
  id: true, pubkey,
  encrypted_secret: await enc(secret64),
  encrypted_mnemonic: await enc(new TextEncoder().encode(mnemonic)),
});
if (error) { console.error(error); process.exit(1); }
console.log("PUBKEY:", pubkey);
console.log("MNEMONIC:", mnemonic);
