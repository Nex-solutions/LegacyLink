// Server-only double-entry ledger helpers.
// All postings go through `post_ledger_transaction` (atomic + balance-checked).

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Side = "debit" | "credit";

export type LedgerEntryInput = {
  account_id: string;
  side: Side;
  amount: number; // positive
  currency?: string;
};

export type LedgerTxKind =
  | "onramp_mint"
  | "sweep_to_master"
  | "payout_from_master"
  | "offramp_burn"
  | "fee"
  | "adjustment";

export async function getAccountIdByCode(code: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("ledger_accounts")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`ledger account ${code} not found`);
  return data.id;
}

export async function ensureUserWalletAccount(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc("ensure_user_wallet_account", {
    _user_id: userId,
  });
  if (error) throw error;
  return data as string;
}

export async function postLedgerTx(args: {
  kind: LedgerTxKind;
  reference?: string | null;
  externalRef?: string | null;
  memo?: string | null;
  txSignature?: string | null;
  userId?: string | null;
  entries: LedgerEntryInput[];
}): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc("post_ledger_transaction", {
    _kind: args.kind,
    _reference: (args.reference ?? null) as unknown as string,
    _external_ref: (args.externalRef ?? null) as unknown as string,
    _memo: (args.memo ?? null) as unknown as string,
    _tx_signature: (args.txSignature ?? null) as unknown as string,
    _user_id: (args.userId ?? null) as unknown as string,
    _entries: args.entries.map((e) => ({
      account_id: e.account_id,
      side: e.side,
      amount: e.amount,
      currency: e.currency ?? "USDC",
    })),
  });
  if (error) throw error;
  return data as string;
}

// ─────────────────────────────────────────────────────────────────
// High-level flows
// ─────────────────────────────────────────────────────────────────

/**
 * On-ramp: user paid fiat, provider minted USDC into their custodial wallet.
 * Records the mint AND immediately sweeps to master.
 *
 *   Tx A (mint):  Dr user_wallet,  Cr fiat_onramp_clearing
 *   Tx B (sweep): Dr master_wallet, Cr user_wallet
 */
export async function recordGas(args: {
  userId?: string | null;
  reference?: string | null;
  txSignature?: string | null;
  lamports: number;
}): Promise<string | null> {
  if (!args.lamports || args.lamports <= 0) return null;
  const sol = args.lamports / 1_000_000_000;
  const masterAcct = await getAccountIdByCode("1000");
  const gasAcct = await getAccountIdByCode("5000");
  return postLedgerTx({
    kind: "fee",
    userId: args.userId ?? null,
    reference: args.reference ?? null,
    txSignature: args.txSignature ?? null,
    memo: `Network gas ${sol.toFixed(9)} SOL`,
    entries: [
      { account_id: gasAcct, side: "debit", amount: sol, currency: "SOL" },
      { account_id: masterAcct, side: "credit", amount: sol, currency: "SOL" },
    ],
  });
}

export async function recordOnRampAndSweep(args: {
  userId: string;
  amountUsdc: number;
  externalRef: string;
  reference?: string;
  feeUsdc?: number;
  sweepTxSignature?: string;
  sweepGasLamports?: number;
}): Promise<{ mintTxId: string; sweepTxId: string }> {
  const masterAcct = await getAccountIdByCode("1000");
  const onrampAcct = await getAccountIdByCode("2000");
  const feeAcct = await getAccountIdByCode("4000");
  const userAcct = await ensureUserWalletAccount(args.userId);

  const fee = args.feeUsdc ?? 0;
  const net = args.amountUsdc - fee;

  // Tx A — mint into user wallet, fees recognised
  const mintEntries: LedgerEntryInput[] = [
    { account_id: userAcct, side: "debit", amount: net },
  ];
  if (fee > 0) mintEntries.push({ account_id: feeAcct, side: "debit", amount: fee });
  mintEntries.push({ account_id: onrampAcct, side: "credit", amount: args.amountUsdc });

  const mintTxId = await postLedgerTx({
    kind: "onramp_mint",
    userId: args.userId,
    externalRef: args.externalRef,
    reference: args.reference ?? null,
    memo: `On-ramp ${args.amountUsdc} USDC (fee ${fee})`,
    entries: mintEntries,
  });

  // Tx B — sweep to master
  const sweepTxId = await postLedgerTx({
    kind: "sweep_to_master",
    userId: args.userId,
    reference: args.reference ?? null,
    txSignature: args.sweepTxSignature ?? null,
    memo: `Sweep ${net} USDC → master`,
    entries: [
      { account_id: masterAcct, side: "debit", amount: net },
      { account_id: userAcct, side: "credit", amount: net },
    ],
  });

  return { mintTxId, sweepTxId };
}

/**
 * Payout: master returns USDC to a user wallet, then burns it for fiat off-ramp.
 *
 *   Tx C (payout):  Dr user_wallet, Cr master_wallet
 *   Tx D (offramp): Dr fiat_offramp_clearing, Cr user_wallet
 */
export async function recordPayoutAndOffRamp(args: {
  userId: string;
  amountUsdc: number;
  reference: string;
  externalRef?: string;
  payoutTxSignature?: string;
  feeUsdc?: number;
}): Promise<{ payoutTxId: string; offrampTxId: string }> {
  const masterAcct = await getAccountIdByCode("1000");
  const offrampAcct = await getAccountIdByCode("2100");
  const feeAcct = await getAccountIdByCode("4000");
  const userAcct = await ensureUserWalletAccount(args.userId);

  const fee = args.feeUsdc ?? 0;
  const net = args.amountUsdc - fee;

  const payoutTxId = await postLedgerTx({
    kind: "payout_from_master",
    userId: args.userId,
    reference: args.reference,
    txSignature: args.payoutTxSignature ?? null,
    memo: `Payout ${args.amountUsdc} USDC from master`,
    entries: [
      { account_id: userAcct, side: "debit", amount: args.amountUsdc },
      { account_id: masterAcct, side: "credit", amount: args.amountUsdc },
    ],
  });

  const offrampEntries: LedgerEntryInput[] = [
    { account_id: offrampAcct, side: "debit", amount: net },
  ];
  if (fee > 0) offrampEntries.push({ account_id: feeAcct, side: "debit", amount: fee });
  offrampEntries.push({ account_id: userAcct, side: "credit", amount: args.amountUsdc });

  const offrampTxId = await postLedgerTx({
    kind: "offramp_burn",
    userId: args.userId,
    reference: args.reference,
    externalRef: args.externalRef ?? null,
    memo: `Off-ramp ${args.amountUsdc} USDC (fee ${fee})`,
    entries: offrampEntries,
  });

  return { payoutTxId, offrampTxId };
}
