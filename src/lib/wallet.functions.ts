// Thin server-fn wrapper to provision the custodial wallet on first sign-in.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureCustodialWallet } from "./wallet.server";

export const provisionWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const pubkey = await ensureCustodialWallet(context.userId);
    return { pubkey };
  });
