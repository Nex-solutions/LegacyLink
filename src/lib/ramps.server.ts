// On/off-ramp abstraction. Default mock provider logs intents and returns
// instantly. Swap RAMP_PROVIDER env to wire a real provider (Transak, MoonPay,
// Crossmint, Sphere, etc.) without changing callers.

export type OnRampInput = {
  userPubkey: string;
  amountCad: number;
  reference: string; // e.g. vault id
};

export type OffRampInput = {
  beneficiaryEmail: string;
  amountCad: number;
  reference: string; // claim/vault id
  // Optional bank/Interac details once real provider is wired
  payoutMethod?: "interac" | "ach" | "wire";
};

export type RampResult = {
  providerRef: string;
  status: "submitted" | "completed";
};

export interface RampProvider {
  onramp(input: OnRampInput): Promise<RampResult>;
  offramp(input: OffRampInput): Promise<RampResult>;
}

import { recordOnRampAndSweep, recordPayoutAndOffRamp } from "./ledger.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function userIdForPubkey(pubkey: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("custodial_wallets")
    .select("user_id")
    .eq("pubkey", pubkey)
    .maybeSingle();
  return data?.user_id ?? null;
}

class MockRampProvider implements RampProvider {
  async onramp(input: OnRampInput): Promise<RampResult> {
    console.log(
      `[ramp:mock] onramp CA$${input.amountCad} → ${input.userPubkey} (${input.reference})`,
    );
    const ref = `mock_on_${Date.now().toString(36)}`;
    // Mock 1:1 CAD→USDC. In production use the provider's quoted USDC amount.
    const amountUsdc = input.amountCad;
    const userId = await userIdForPubkey(input.userPubkey);
    if (userId) {
      try {
        await recordOnRampAndSweep({
          userId,
          amountUsdc,
          externalRef: ref,
          reference: input.reference,
        });
      } catch (e) {
        console.error("[ramp:mock] ledger onramp failed", e);
      }
    }
    return { providerRef: ref, status: "completed" };
  }
  async offramp(input: OffRampInput): Promise<RampResult> {
    console.log(
      `[ramp:mock] offramp CA$${input.amountCad} → ${input.beneficiaryEmail} via ${input.payoutMethod ?? "interac"} (${input.reference})`,
    );
    const ref = `mock_off_${Date.now().toString(36)}`;
    // Look up the beneficiary's user_id by email if they have an account.
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("display_name", input.beneficiaryEmail)
      .maybeSingle();
    const userId = prof?.id ?? null;
    if (userId) {
      try {
        await recordPayoutAndOffRamp({
          userId,
          amountUsdc: input.amountCad,
          reference: input.reference,
          externalRef: ref,
        });
      } catch (e) {
        console.error("[ramp:mock] ledger offramp failed", e);
      }
    }
    return { providerRef: ref, status: "completed" };
  }
}

export function getRampProvider(): RampProvider {
  // Future: switch on process.env.RAMP_PROVIDER
  return new MockRampProvider();
}
