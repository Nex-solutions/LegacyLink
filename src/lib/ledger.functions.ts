// Server functions exposing the ledger + master wallet to authenticated clients.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getMasterWallet,
  initMasterWallet,
  revealMasterMnemonic,
} from "./master-wallet.server";

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

export const fetchMasterWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return await getMasterWallet();
  });

export const createMasterWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return await initMasterWallet(context.userId);
  });

export const revealMasterWalletMnemonic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return await revealMasterMnemonic();
  });

export const listLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ limit: z.number().min(1).max(500).default(100) }).parse)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    const [{ data: txs, error: txErr }, { data: accts, error: aErr }] = await Promise.all([
      supabaseAdmin
        .from("ledger_transactions")
        .select("id, kind, reference, external_ref, memo, tx_signature, user_id, created_at")
        .order("created_at", { ascending: false })
        .limit(data.limit),
      supabaseAdmin
        .from("ledger_accounts")
        .select("id, code, name, type, user_id, currency"),
    ]);
    if (txErr) throw txErr;
    if (aErr) throw aErr;

    const txIds = (txs ?? []).map((t) => t.id);
    const { data: entries, error: eErr } = txIds.length
      ? await supabaseAdmin
          .from("ledger_entries")
          .select("id, transaction_id, account_id, side, amount, currency")
          .in("transaction_id", txIds)
      : { data: [], error: null };
    if (eErr) throw eErr;

    return { transactions: txs ?? [], entries: entries ?? [], accounts: accts ?? [] };
  });

export const getLedgerBalances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: accts, error } = await supabaseAdmin
      .from("ledger_accounts")
      .select("id, code, name, type, user_id, currency")
      .order("code");
    if (error) throw error;

    const balances = await Promise.all(
      (accts ?? []).map(async (a) => {
        const { data: bal } = await supabaseAdmin.rpc("ledger_account_balance", {
          _account_id: a.id,
        });
        return { ...a, balance: Number(bal ?? 0) };
      })
    );
    return { accounts: balances };
  });
