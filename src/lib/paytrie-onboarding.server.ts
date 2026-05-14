// Paytrie customer onboarding (server-only).
// Calls /generateApiLink to create the user inside Paytrie + return a Sumsub
// verification URL for KYC. When PAYTRIE_API_KEY isn't configured we return a
// mock-shaped response so dev flow works end-to-end.

const DEFAULT_BASE = "https://api.paytrie.com";

export type GenerateApiLinkInput = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  dob: string; // YYYY-MM-DD
  address1: string;
  address2?: string;
  city: string;
  province: string; // 2-letter lowercase, e.g. "on"
  postal: string;
  occupation: string;
  pep: boolean;
  tpd: boolean;
};

export type GenerateApiLinkResult = {
  message: string;
  status: string;
  verificationLink: string;
  paytrieUserId?: string;
  simulated: boolean;
};

export function paytrieOnboardingEnabled(): boolean {
  return Boolean(process.env.PAYTRIE_API_KEY);
}

function baseUrl(): string {
  return process.env.PAYTRIE_BASE_URL ?? DEFAULT_BASE;
}

export async function generateApiLink(input: GenerateApiLinkInput): Promise<GenerateApiLinkResult> {
  if (!paytrieOnboardingEnabled()) {
    // Mock-shaped response so we can drive UI without credentials
    const fakeId = `mock_${Math.random().toString(36).slice(2, 12)}`;
    return {
      message: "API user created (mock)",
      status: "success",
      verificationLink: `https://app.paytrie.com/mock-kyc/${fakeId}?email=${encodeURIComponent(input.email)}`,
      paytrieUserId: fakeId,
      simulated: true,
    };
  }

  const res = await fetch(`${baseUrl()}/generateApiLink`, {
    method: "POST",
    headers: {
      "x-api-key": process.env.PAYTRIE_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Paytrie generateApiLink failed [${res.status}]: ${body}`);
  let parsed: { message?: string; status?: string; verificationLink?: string; userId?: string };
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error(`Paytrie returned invalid JSON: ${body}`);
  }
  if (!parsed.verificationLink) throw new Error(`Paytrie missing verificationLink: ${body}`);
  return {
    message: parsed.message ?? "API user created",
    status: parsed.status ?? "success",
    verificationLink: parsed.verificationLink,
    paytrieUserId: parsed.userId,
    simulated: false,
  };
}

// Passwordless login code (used later when issuing JWTs for txn calls).
export async function sendLoginCode(email: string): Promise<{ simulated: boolean }> {
  if (!paytrieOnboardingEnabled()) return { simulated: true };
  const url = new URL(`${baseUrl()}/loginCodeSend`);
  url.searchParams.set("email", email);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "x-api-key": process.env.PAYTRIE_API_KEY! },
  });
  if (!res.ok) throw new Error(`Paytrie loginCodeSend failed [${res.status}]: ${await res.text()}`);
  return { simulated: false };
}
