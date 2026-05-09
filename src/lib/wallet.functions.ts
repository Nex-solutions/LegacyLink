// Thin server-fn wrapper to provision the custodial wallet on first sign-in.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureCustodialWallet, getUserPubkey } from "./wallet.server";
import { signMasterFundingTransaction } from "./treasury.server";
import { getLatestBlockhashDirect } from "./solana-rpc.server";

export const provisionWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await ensureCustodialWallet(context.userId);
    return {
      pubkey: r.pubkey,
      airdropSig: r.airdropSig ?? null,
      airdropFailed: r.airdropFailed ?? false,
      alreadyExisted: r.alreadyExisted,
    };
  });

export const prepareBrowserWalletFunding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { toPubkey: string }) => data)
  .handler(async ({ context, data }) => {
    const pubkey = await getUserPubkey(context.userId);
    if (!pubkey || pubkey !== data.toPubkey) throw new Error("Wallet not found");
    const { blockhash } = await getLatestBlockhashDirect();
    return signMasterFundingTransaction({
      toPubkey: data.toPubkey,
      recentBlockhash: blockhash,
      solAmount: 0.005,
    });
  });
