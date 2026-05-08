// Vault server functions. Each one bridges the UI's Vault shape with the
// vaults + beneficiaries + vault_events tables, and emits an on-chain
// (currently simulated) signature recorded in the audit trail.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  initVaultOnChain,
  fundVaultOnChain,
  checkInOnChain,
  releaseVaultOnChain,
  claimOnChain,
  isSimulatedMode,
} from "./solana.server";
import { ensureCustodialWallet } from "./wallet.server";
import { getRampProvider } from "./ramps.server";

// ─── Shared types mirroring the UI ────────────────────────────────────

export type Beneficiary = {
  id?: string;
  name: string;
  email: string;
  pct: number;
  claimed_at?: string | null;
  claim_token?: string | null;
};

export type VaultCondition =
  | { kind: "time"; unlock_date: string }
  | { kind: "inactivity"; inactivity_days: number; last_checkin: string }
  | { kind: "manual" };

export type VaultStatus = "Active" | "Released" | "Pending";

export type Vault = {
  id: string;
  name: string;
  amount_cad: number;
  status: VaultStatus;
  condition: VaultCondition;
  beneficiaries: Beneficiary[];
  created_at: string;
  vault_pda?: string | null;
  tx_signature?: string | null;
  letter_message?: string | null;
};

// ─── Mappers ──────────────────────────────────────────────────────────

function rowToCondition(row: {
  condition_kind: string;
  unlock_date: string | null;
  inactivity_days: number | null;
  last_checkin: string | null;
}): VaultCondition {
  if (row.condition_kind === "time")
    return { kind: "time", unlock_date: (row.unlock_date ?? "").toString() };
  if (row.condition_kind === "inactivity")
    return {
      kind: "inactivity",
      inactivity_days: row.inactivity_days ?? 180,
      last_checkin: (row.last_checkin ?? new Date().toISOString()).toString().slice(0, 10),
    };
  return { kind: "manual" };
}

function statusToUi(s: string): VaultStatus {
  if (s === "released") return "Released";
  if (s === "active") return "Active";
  return "Pending";
}

function statusToDb(s: VaultStatus): "active" | "released" | "pending" {
  if (s === "Released") return "released";
  if (s === "Active") return "active";
  return "pending";
}

// ─── List ─────────────────────────────────────────────────────────────

export const listVaults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Vault[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("vaults")
      .select(`
        id, name, amount_cad, status, condition_kind,
        unlock_date, inactivity_days, last_checkin,
        created_at, vault_pda, tx_signature, letter_message,
        beneficiaries ( id, name, email, pct, claimed_at, claim_token )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      amount_cad: Number(row.amount_cad),
      status: statusToUi(row.status as string),
      condition: rowToCondition(row as never),
      beneficiaries: (row.beneficiaries ?? []).map((b) => ({
        id: b.id,
        name: b.name,
        email: b.email,
        pct: Number(b.pct),
        claimed_at: b.claimed_at,
        claim_token: b.claim_token,
      })),
      created_at: (row.created_at as string).slice(0, 10),
      vault_pda: row.vault_pda,
      tx_signature: row.tx_signature,
      letter_message: row.letter_message,
    }));
  });

// ─── Get one ──────────────────────────────────────────────────────────

export const getVaultById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Vault | null> => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("vaults")
      .select(`
        id, name, amount_cad, status, condition_kind,
        unlock_date, inactivity_days, last_checkin,
        created_at, vault_pda, tx_signature, letter_message,
        beneficiaries ( id, name, email, pct, claimed_at, claim_token )
      `)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      amount_cad: Number(row.amount_cad),
      status: statusToUi(row.status as string),
      condition: rowToCondition(row as never),
      beneficiaries: (row.beneficiaries ?? []).map((b) => ({
        id: b.id, name: b.name, email: b.email, pct: Number(b.pct),
        claimed_at: b.claimed_at, claim_token: b.claim_token,
      })),
      created_at: (row.created_at as string).slice(0, 10),
      vault_pda: row.vault_pda,
      tx_signature: row.tx_signature,
      letter_message: row.letter_message,
    };
  });

// ─── Create ───────────────────────────────────────────────────────────

const conditionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("time"), unlock_date: z.string() }),
  z.object({ kind: z.literal("inactivity"), inactivity_days: z.number().int().min(1).max(3650), last_checkin: z.string() }),
  z.object({ kind: z.literal("manual") }),
]);

const beneficiaryInputSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(255),
  pct: z.number().min(0).max(100),
});

const createInputSchema = z.object({
  name: z.string().min(1).max(120),
  amount_cad: z.number().positive(),
  condition: conditionSchema,
  beneficiaries: z.array(beneficiaryInputSchema).min(1),
});

export const createVault = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createInputSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string; vault_pda: string; tx_signature: string }> => {
    const { supabase, userId } = context;

    const ownerPubkey = await ensureCustodialWallet(userId);

    // Insert the vault row first to get an id, then write on-chain metadata.
    const { data: inserted, error: insertErr } = await supabase
      .from("vaults")
      .insert({
        owner_id: userId,
        name: data.name,
        amount_cad: data.amount_cad,
        status: "active",
        condition_kind: data.condition.kind,
        unlock_date: data.condition.kind === "time" ? data.condition.unlock_date : null,
        inactivity_days: data.condition.kind === "inactivity" ? data.condition.inactivity_days : null,
        last_checkin: data.condition.kind === "inactivity" ? data.condition.last_checkin : null,
      })
      .select("id")
      .single();
    if (insertErr) throw insertErr;
    const vaultId = inserted.id as string;

    // On-chain init + fund (simulated unless SOLANA_PROGRAM_ID is set)
    const init = await initVaultOnChain({ ownerPubkey, vaultId });
    const fund = await fundVaultOnChain({ vaultPda: init.vaultPda, amountCad: data.amount_cad });

    // Run on-ramp to bring fiat into custodial USDC
    const ramp = getRampProvider();
    const onramp = await ramp.onramp({
      userPubkey: ownerPubkey,
      amountCad: data.amount_cad,
      reference: vaultId,
    });

    // Persist on-chain metadata
    await supabase
      .from("vaults")
      .update({
        vault_pda: init.vaultPda,
        usdc_ata: init.usdcAta,
        init_tx: init.signature,
        tx_signature: fund.signature,
        solana_pubkey: ownerPubkey,
      })
      .eq("id", vaultId);

    // Beneficiaries
    if (data.beneficiaries.length) {
      const { error: benErr } = await supabase
        .from("beneficiaries")
        .insert(data.beneficiaries.map((b) => ({
          vault_id: vaultId,
          name: b.name,
          email: b.email,
          pct: b.pct,
        })));
      if (benErr) throw benErr;
    }

    // Audit trail
    await supabase.from("vault_events").insert([
      { vault_id: vaultId, actor_id: userId, kind: "fund", detail: `Vault funded · CA$${data.amount_cad}${isSimulatedMode() ? " (simulated)" : ""} · ramp ${onramp.providerRef}`, tx_signature: fund.signature },
    ]);

    return { id: vaultId, vault_pda: init.vaultPda, tx_signature: fund.signature };
  });

// ─── Update beneficiaries ─────────────────────────────────────────────

export const replaceBeneficiaries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      vault_id: z.string().uuid(),
      beneficiaries: z.array(beneficiaryInputSchema).min(1),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // RLS protects ownership; we only need to swap rows.
    await supabase.from("beneficiaries").delete().eq("vault_id", data.vault_id);
    const { error } = await supabase.from("beneficiaries").insert(
      data.beneficiaries.map((b) => ({
        vault_id: data.vault_id, name: b.name, email: b.email, pct: b.pct,
      }))
    );
    if (error) throw error;
    return { ok: true };
  });

// ─── Update letter message ────────────────────────────────────────────

export const updateVaultLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ vault_id: z.string().uuid(), message: z.string().max(8000) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("vaults")
      .update({ letter_message: data.message })
      .eq("id", data.vault_id);
    if (error) throw error;
    return { ok: true };
  });

// ─── Check in ─────────────────────────────────────────────────────────

export const checkInVault = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ vault_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: v, error: getErr } = await supabase
      .from("vaults")
      .select("vault_pda")
      .eq("id", data.vault_id)
      .single();
    if (getErr) throw getErr;

    const sig = v.vault_pda
      ? (await checkInOnChain({ vaultPda: v.vault_pda })).signature
      : null;
    const today = new Date().toISOString();
    const { error } = await supabase
      .from("vaults")
      .update({ last_checkin: today })
      .eq("id", data.vault_id);
    if (error) throw error;

    await supabase.from("vault_events").insert({
      vault_id: data.vault_id, actor_id: userId, kind: "checkin",
      detail: "Owner checked in", tx_signature: sig,
    });
    return { ok: true, tx_signature: sig };
  });

// ─── Release (manual or auto) ─────────────────────────────────────────

export const releaseVault = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ vault_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: v, error: getErr } = await supabase
      .from("vaults")
      .select("vault_pda, beneficiaries(id,email,name,pct,claim_token)")
      .eq("id", data.vault_id)
      .single();
    if (getErr) throw getErr;

    const sig = v.vault_pda
      ? (await releaseVaultOnChain({ vaultPda: v.vault_pda })).signature
      : null;

    // Generate claim tokens for beneficiaries that don't have one
    const updates = (v.beneficiaries ?? [])
      .filter((b) => !b.claim_token)
      .map((b) =>
        supabase
          .from("beneficiaries")
          .update({ claim_token: crypto.randomUUID() })
          .eq("id", b.id)
      );
    await Promise.all(updates);

    await supabase
      .from("vaults")
      .update({ status: "released", tx_signature: sig })
      .eq("id", data.vault_id);

    await supabase.from("vault_events").insert({
      vault_id: data.vault_id, actor_id: userId, kind: "release",
      detail: `Vault released to ${v.beneficiaries?.length ?? 0} beneficiaries`,
      tx_signature: sig,
    });
    return { ok: true, tx_signature: sig };
  });

// ─── Auto-evaluate releases (called from dashboard load) ──────────────

export const evaluateReleasesServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: vaults } = await supabase
      .from("vaults")
      .select("id, status, condition_kind, unlock_date, inactivity_days, last_checkin, vault_pda");
    if (!vaults) return { released: [] as string[] };

    const released: string[] = [];
    const now = new Date();
    for (const v of vaults) {
      if (v.status !== "active") continue;
      let trigger = false;
      if (v.condition_kind === "time" && v.unlock_date) {
        if (now >= new Date(v.unlock_date)) trigger = true;
      } else if (v.condition_kind === "inactivity" && v.inactivity_days && v.last_checkin) {
        const elapsed = (now.getTime() - new Date(v.last_checkin).getTime()) / 86400000;
        if (elapsed >= v.inactivity_days) trigger = true;
      }
      if (!trigger) continue;

      const sig = v.vault_pda
        ? (await releaseVaultOnChain({ vaultPda: v.vault_pda })).signature
        : null;
      await supabase
        .from("vaults")
        .update({ status: "released", tx_signature: sig })
        .eq("id", v.id);
      await supabase.from("vault_events").insert({
        vault_id: v.id, kind: "release",
        detail: `Auto-released by condition (${v.condition_kind})`,
        tx_signature: sig,
      });
      released.push(v.id);
    }
    return { released };
  });

// ─── Beneficiary claim (called from /claim page) ──────────────────────

export const beneficiaryClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ vault_id: z.string().uuid(), claim_token: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Fetch vault for pda + amount
    const { data: v } = await supabase
      .from("vaults")
      .select("id, name, vault_pda, amount_cad")
      .eq("id", data.vault_id)
      .maybeSingle();
    if (!v) throw new Error("Vault not found or not visible");

    // Pre-compute on-chain claim signature
    const sig = v.vault_pda
      ? (await claimOnChain({
          vaultPda: v.vault_pda,
          beneficiaryEmail: "pending",
          amountCad: Number(v.amount_cad),
        })).signature
      : `sim_claim_${Date.now()}`;

    // Atomically consume the token and emit audit event
    const { data: result, error } = await supabase.rpc("consume_claim_token", {
      _vault_id: data.vault_id,
      _token: data.claim_token,
      _payout_signature: sig,
    });
    if (error) throw error;

    const row = (result as Array<{ beneficiary_id: string; vault_name: string; pct: number; amount_cad: number; email: string }> | null)?.[0];
    if (!row) throw new Error("Claim failed");

    // Off-ramp payout
    const ramp = getRampProvider();
    const off = await ramp.offramp({
      beneficiaryEmail: row.email,
      amountCad: Number(row.amount_cad),
      reference: data.vault_id,
      payoutMethod: "interac",
    });

    return {
      vault_name: row.vault_name,
      amount_cad: Number(row.amount_cad),
      pct: Number(row.pct),
      email: row.email,
      tx_signature: sig,
      offramp_ref: off.providerRef,
    };
  });

// ─── Demo seed (calls SECURITY DEFINER RPC) ───────────────────────────

export const resetDemoServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("seed_demo_for_user");
    if (error) throw error;
    return { ok: true };
  });
