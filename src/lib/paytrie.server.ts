// Paytrie REST client (server-only).
// Real calls when PAYTRIE_API_KEY is set; otherwise returns mock-shaped data so
// the rest of the system can be exercised in dev (devnet) without credentials.

const DEFAULT_BASE = "https://api.paytrie.com";

export type TokenLabel =
  | "USDC-SOL"
  | "USDC-ETH"
  | "USDC-POLY"
  | "USDC-BASE"
  | "CADC-ETH";

export type PriceQuote = {
  quoteId: number;
  cadusd?: number;
  leftSideLabel: string;
  leftSideValue: string;
  rightSideLabel: string;
  rightSideValue: string;
  fee: number;
  gasId?: number;
};

export type CreateTxResult = {
  message?: string;
  status?: string;
  tx: string; // tx_id
  rmt?: string; // Interac reference (buys)
  depositAddress?: string; // Solana address (sells)
};

export type GetTxResult = {
  tx_id: string;
  status: string;
  leftSideLabel: string;
  rightSideLabel: string;
  leftSideValue: string;
  rightSideValue: string;
  wallet?: string;
  rmt?: string;
  depositAddress?: string;
};

export function paytrieEnabled(): boolean {
  return Boolean(process.env.PAYTRIE_API_KEY);
}

export function paytrieDepositEmail(): string {
  return process.env.PAYTRIE_DEPOSIT_EMAIL ?? "deposits@paytrie.com";
}

function baseUrl(): string {
  return process.env.PAYTRIE_BASE_URL ?? DEFAULT_BASE;
}

function headers(extra?: Record<string, string>): Record<string, string> {
  const key = process.env.PAYTRIE_API_KEY;
  if (!key) throw new Error("PAYTRIE_API_KEY not set");
  return {
    "x-api-key": key,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function jsonOrThrow<T>(res: Response, label: string): Promise<T> {
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Paytrie ${label} failed [${res.status}]: ${body}`);
  }
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`Paytrie ${label}: invalid JSON: ${body}`);
  }
}

// ──────────────── Price quote ────────────────
export async function getPriceQuote(args: {
  leftSideLabel: string;
  leftSideValue: number;
  rightSideLabel: string;
}): Promise<PriceQuote> {
  if (!paytrieEnabled()) {
    // Mock 1:1 (minus 1% fee) so dev flow works
    const buying = args.rightSideLabel.startsWith("USDC");
    const fee = Math.max(2, args.leftSideValue * 0.01);
    const right = buying
      ? (args.leftSideValue - fee).toFixed(2)
      : (args.leftSideValue * 1).toFixed(2);
    return {
      quoteId: Date.now(),
      leftSideLabel: args.leftSideLabel,
      leftSideValue: String(args.leftSideValue),
      rightSideLabel: args.rightSideLabel,
      rightSideValue: right,
      fee,
    };
  }

  const url = new URL(`${baseUrl()}/priceQuote`);
  url.searchParams.set("leftSideLabel", args.leftSideLabel);
  url.searchParams.set("leftSideValue", String(args.leftSideValue));
  url.searchParams.set("rightSideLabel", args.rightSideLabel);
  const res = await fetch(url.toString(), { headers: headers() });
  return jsonOrThrow<PriceQuote>(res, "priceQuote");
}

// ──────────────── Create transaction ────────────────
export async function createTransaction(args: {
  userJwt?: string;
  leftSideLabel: string;
  leftSideValue: number;
  rightSideLabel: string;
  wallet?: string; // for buy: where USDC gets sent
  etransferEmail?: string; // for sell: where CAD gets sent
  quoteId: number;
  gasId?: number;
}): Promise<CreateTxResult> {
  if (!paytrieEnabled()) {
    const id = `mock_tx_${Math.random().toString(36).slice(2, 10)}`;
    const isBuy = args.rightSideLabel.startsWith("USDC");
    return isBuy
      ? { tx: id, rmt: `MOCK${Math.random().toString(36).slice(2, 10).toUpperCase()}` }
      : { tx: id, depositAddress: process.env.PAYTRIE_MOCK_DEPOSIT ?? "PaytrieM0ckDeposit1111111111111111111111111" };
  }

  const res = await fetch(`${baseUrl()}/transaction`, {
    method: "POST",
    headers: headers(args.userJwt ? { Authorization: `Bearer ${args.userJwt}` } : undefined),
    body: JSON.stringify(args),
  });
  return jsonOrThrow<CreateTxResult>(res, "createTransaction");
}

// ──────────────── Get transaction ────────────────
export async function getTransaction(args: {
  txId: string;
  userJwt?: string;
}): Promise<GetTxResult> {
  if (!paytrieEnabled()) {
    return {
      tx_id: args.txId,
      status: "complete",
      leftSideLabel: "CAD",
      rightSideLabel: "USDC-SOL",
      leftSideValue: "0",
      rightSideValue: "0",
    };
  }
  const url = new URL(`${baseUrl()}/transaction`);
  url.searchParams.set("tx_id", args.txId);
  const res = await fetch(url.toString(), {
    headers: headers(args.userJwt ? { Authorization: `Bearer ${args.userJwt}` } : undefined),
  });
  return jsonOrThrow<GetTxResult>(res, "getTransaction");
}

// ──────────────── Webhook signature verification ────────────────
export async function verifyPaytrieSignature(rawBody: string, signature: string | null): Promise<boolean> {
  const secret = process.env.PAYTRIE_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
