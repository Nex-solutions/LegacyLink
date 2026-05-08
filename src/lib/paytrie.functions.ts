// Server functions for Paytrie buy/sell + listing intents.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ensureCustodialWallet } from "./wallet.server";
import {
  createTransaction,
  getPriceQuote,
  getTransaction,
  paytrieDepositEmail,
  paytrieEnabled,
} from "./paytrie.server";
import { payoutFromMaster, getMasterGasBalance } from "./sweep.server";
import { recordPayoutAndOffRamp, recordGas } from "./ledger.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Admin role required");
}

// ──────────── Buy: get a quote ────────────
export const getBuyQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ amountCad: z.number().min(10).max(50000) }).parse)
  .handler(async ({ data }) => {
    const q = await getPriceQuote({
      leftSideLabel: "CAD",
      leftSideValue: data.amountCad,
      rightSideLabel: "USDC-SOL",
    });
    return q;
  });

// ──────────── Buy: create intent ────────────
export const createBuyIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      amountCad: z.number().min(10).max(50000),
      quoteId: z.number(),
      reference: z.string().max(255).optional(),
    }).parse
  )
  .handler(async ({ context, data }) => {
    const wallet = await ensureCustodialWallet(context.userId);
    const tx = await createTransaction({
      leftSideLabel: "CAD",
      leftSideValue: data.amountCad,
      rightSideLabel: "USDC-SOL",
      wallet,
      quoteId: data.quoteId,
    });

    const amountUsdc = data.amountCad; // refined from quote in webhook
    const { data: row, error } = await supabaseAdmin
      .from("ramp_intents")
      .insert({
        user_id: context.userId,
        kind: "onramp",
        status: "awaiting_payment",
        paytrie_tx_id: tx.tx,
        paytrie_rmt: tx.rmt ?? null,
        destination_wallet: wallet,
        quote_id: data.quoteId,
        amount_cad: data.amountCad,
        amount_usdc: amountUsdc,
        reference: data.reference ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;

    return {
      intentId: row.id,
      paytrieTxId: tx.tx,
      rmt: tx.rmt,
      destinationWallet: wallet,
      depositEmail: paytrieDepositEmail(),
      simulated: !paytrieEnabled(),
    };
  });

// ──────────── Sell: trigger payout ────────────
export const createSellIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      amountUsdc: z.number().min(1).max(50000),
      etransferEmail: z.string().email(),
      reference: z.string().max(255).optional(),
    }).parse
  )
  .handler(async ({ context, data }) => {
    const quote = await getPriceQuote({
      leftSideLabel: "USDC-SOL",
      leftSideValue: data.amountUsdc,
      rightSideLabel: "CAD",
    });

    const tx = await createTransaction({
      leftSideLabel: "USDC-SOL",
      leftSideValue: data.amountUsdc,
      rightSideLabel: "CAD",
      etransferEmail: data.etransferEmail,
      quoteId: quote.quoteId,
    });

    if (!tx.depositAddress) throw new Error("Paytrie did not return a deposit address");

    // Send USDC master → Paytrie deposit address
    const payout = await payoutFromMaster({
      toAddress: tx.depositAddress,
      amountUsdc: data.amountUsdc,
    });

    // Ledger: master → fiat_offramp_clearing (skips per-user transit per chosen flow)
    await recordPayoutAndOffRamp({
      userId: context.userId,
      amountUsdc: data.amountUsdc,
      reference: data.reference ?? tx.tx,
      externalRef: tx.tx,
      payoutTxSignature: payout.signature,
    });
    await recordGas({
      userId: context.userId,
      reference: data.reference ?? tx.tx,
      txSignature: payout.signature,
      lamports: payout.gasLamports,
    });

    const { data: row, error } = await supabaseAdmin
      .from("ramp_intents")
      .insert({
        user_id: context.userId,
        kind: "offramp",
        status: "sent_usdc",
        paytrie_tx_id: tx.tx,
        deposit_address: tx.depositAddress,
        quote_id: quote.quoteId,
        amount_cad: Number(quote.rightSideValue),
        amount_usdc: data.amountUsdc,
        beneficiary_email: data.etransferEmail,
        payout_tx_signature: payout.signature,
        reference: data.reference ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;

    return {
      intentId: row.id,
      paytrieTxId: tx.tx,
      payoutSignature: payout.signature,
      simulated: !paytrieEnabled(),
    };
  });

// ──────────── List my intents ────────────
export const listMyRampIntents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("ramp_intents")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return { intents: data ?? [] };
  });

// ──────────── Admin: list all intents + master gas ────────────
export const adminListRampIntents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("ramp_intents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    let masterGas: { lamports: number; sol: number } | null = null;
    try {
      masterGas = await getMasterGasBalance();
    } catch (e) {
      console.warn("[paytrie] master gas read failed", e);
    }
    return { intents: data ?? [], masterGas, paytrieLive: paytrieEnabled() };
  });

// ──────────── Refresh intent from Paytrie (for status polling) ────────────
export const refreshRampIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ intentId: z.string().uuid() }).parse)
  .handler(async ({ context, data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("ramp_intents")
      .select("*")
      .eq("id", data.intentId)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("not found");
    if (row.user_id !== context.userId) {
      await assertAdmin(context.userId);
    }
    if (!row.paytrie_tx_id) return { intent: row };

    try {
      const remote = await getTransaction({ txId: row.paytrie_tx_id });
      await supabaseAdmin
        .from("ramp_intents")
        .update({ status: remote.status, last_webhook: remote as never })
        .eq("id", row.id);
      return { intent: { ...row, status: remote.status } };
    } catch (e) {
      console.warn("[paytrie] refresh failed", e);
      return { intent: row };
    }
  });
