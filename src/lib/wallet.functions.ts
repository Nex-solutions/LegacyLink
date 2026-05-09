// Thin server-fn wrapper to provision the custodial wallet on first sign-in.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureCustodialWallet } from "./wallet.server";
import { signMasterFundingTransaction } from "./treasury.server";

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
  .inputValidator((data: { toPubkey: string; recentBlockhash: string }) => data)
  .handler(async ({ data }) =>
    signMasterFundingTransaction({
      toPubkey: data.toPubkey,
      recentBlockhash: data.recentBlockhash,
      solAmount: 0.005,
    }),
  );
