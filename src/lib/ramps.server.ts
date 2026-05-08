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

class MockRampProvider implements RampProvider {
  async onramp(input: OnRampInput): Promise<RampResult> {
    console.log(`[ramp:mock] onramp CA$${input.amountCad} → ${input.userPubkey} (${input.reference})`);
    return { providerRef: `mock_on_${Date.now().toString(36)}`, status: "completed" };
  }
  async offramp(input: OffRampInput): Promise<RampResult> {
    console.log(`[ramp:mock] offramp CA$${input.amountCad} → ${input.beneficiaryEmail} via ${input.payoutMethod ?? "interac"} (${input.reference})`);
    return { providerRef: `mock_off_${Date.now().toString(36)}`, status: "completed" };
  }
}

export function getRampProvider(): RampProvider {
  // Future: switch on process.env.RAMP_PROVIDER
  return new MockRampProvider();
}
