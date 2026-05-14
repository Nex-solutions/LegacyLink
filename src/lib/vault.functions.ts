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
  isSimulatedMode,
} from "./solana.server";
import { ensureCustodialWallet, getUserPubkey } from "./wallet.server";
import {
  sendHotToUserSystemWallet,
  sendUserToHotProof,
  anchorLetterMessage,
} from "./proof-tx.server";
import { getRampProvider } from "./ramps.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ─── Shared types mirroring the UI ────────────────────────────────────

export type Beneficiary = {
  id?: string;
  name: string;
  email: string;
  pct: number;
  claimed_at?: string | null;
  claim_token?: string | null;
  payout_tx_signature?: string | null;
};

export type VaultCondition =
  | { kind: "time"; unlock_date: string }
  | { kind: "inactivity"; inactivity_days: number; last_checkin: string }
  | { kind: "manual" };

export type VaultStatus = "Active" | "Released" | "Pending" | "Failed" | "Draft";

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
  letter_tx_signature?: string | null;
  failure_count?: number;
  last_step?: string | null;
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
  if (s === "failed") return "Failed";
  if (s === "draft") return "Draft";
  return "Pending";
}

function statusToDb(s: VaultStatus): "active" | "released" | "pending" | "failed" | "draft" {
  if (s === "Released") return "released";
  if (s === "Active") return "active";
  if (s === "Failed") return "failed";
  if (s === "Draft") return "draft";
  return "pending";
}

// ─── List ─────────────────────────────────────────────────────────────

export const listVaults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Vault[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("vaults")
      .select(
        `
        id, name, amount_cad, status, condition_kind,
        unlock_date, inactivity_days, last_checkin,
        created_at, vault_pda, tx_signature, letter_message, letter_tx_signature,
        failure_count, last_step,
        beneficiaries ( id, name, email, pct, claimed_at, claim_token, payout_tx_signature )
      `,
      )
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
        payout_tx_signature: b.payout_tx_signature,
      })),
      created_at: (row.created_at as string).slice(0, 10),
      vault_pda: row.vault_pda,
      tx_signature: row.tx_signature,
      letter_message: row.letter_message,
      letter_tx_signature:
        (row as { letter_tx_signature?: string | null }).letter_tx_signature ?? null,
      failure_count: (row as { failure_count?: number }).failure_count ?? 0,
      last_step: (row as { last_step?: string | null }).last_step ?? null,
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
      .select(
        `
        id, name, amount_cad, status, condition_kind,
        unlock_date, inactivity_days, last_checkin,
        created_at, vault_pda, tx_signature, letter_message, letter_tx_signature,
        beneficiaries ( id, name, email, pct, claimed_at, claim_token, payout_tx_signature )
      `,
      )
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
        id: b.id,
        name: b.name,
        email: b.email,
        pct: Number(b.pct),
        claimed_at: b.claimed_at,
        claim_token: b.claim_token,
        payout_tx_signature: b.payout_tx_signature,
      })),
      created_at: (row.created_at as string).slice(0, 10),
      vault_pda: row.vault_pda,
      tx_signature: row.tx_signature,
      letter_message: row.letter_message,
      letter_tx_signature:
        (row as { letter_tx_signature?: string | null }).letter_tx_signature ?? null,
    };
  });

// ─── Create ───────────────────────────────────────────────────────────

const conditionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("time"), unlock_date: z.string() }),
  z.object({
    kind: z.literal("inactivity"),
    inactivity_days: z.number().int().min(1).max(3650),
    last_checkin: z.string(),
  }),
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
  letter_message: z.string().max(280).optional().nullable(),
});

export const createVault = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createInputSchema.parse(d))
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      id: string;
      vault_pda: string;
      tx_signature: string;
      owner_pubkey: string;
      hot_pubkey: string;
      letter_tx_signature: string | null;
      claim_demo: { name: string; email: string; token: string } | null;
    }> => {
      const { supabase, userId } = context;

      // Reuse the user's signup system wallet — never generate a new one here.
      const ownerPubkey = await getUserPubkey(userId);
      if (!ownerPubkey) {
        throw new Error(
          "Your system wallet hasn't been provisioned yet. Please complete signup before creating a vault.",
        );
      }

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
          inactivity_days:
            data.condition.kind === "inactivity" ? data.condition.inactivity_days : null,
          last_checkin: data.condition.kind === "inactivity" ? data.condition.last_checkin : null,
          letter_message: data.letter_message?.trim() || null,
        })
        .select("id")
        .single();
      if (insertErr) throw insertErr;
      const vaultId = inserted.id as string;

      try {
        // On-chain init (simulated unless SOLANA_PROGRAM_ID is set)
        await supabase.from("vaults").update({ last_step: "init_chain" }).eq("id", vaultId);
        const init = await initVaultOnChain({
          ownerPubkey,
          vaultId,
          amountCadCents: Math.round(data.amount_cad * 100),
        });

        // Real on-chain proof: user's system wallet sends 0.001 devnet SOL to
        // the platform hot wallet. This proves the user wallet works end-to-end.
        const proof = await sendUserToHotProof(userId, 0.001);
        const fund = { signature: proof.signature };

        // Run on-ramp to bring fiat into custodial USDC
        await supabase.from("vaults").update({ last_step: "onramp" }).eq("id", vaultId);
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
            status: "released",
            last_step: "beneficiaries",
          })
          .eq("id", vaultId);

        // Beneficiaries
        const beneficiaryRows = data.beneficiaries.map((b) => ({
          vault_id: vaultId,
          name: b.name,
          email: b.email,
          pct: b.pct,
          claim_token: crypto.randomUUID(),
        }));
        if (data.beneficiaries.length) {
          const { error: benErr } = await supabase.from("beneficiaries").insert(beneficiaryRows);
          if (benErr) throw benErr;
        }

        // Anchor the optional letter on-chain via SPL Memo (non-critical).
        let letterTx: string | null = null;
        const letterText = data.letter_message?.trim();
        if (letterText) {
          const anchored = await anchorLetterMessage(userId, vaultId, letterText);
          if (anchored?.signature) {
            letterTx = anchored.signature;
            await supabase
              .from("vaults")
              .update({ letter_tx_signature: letterTx })
              .eq("id", vaultId);
            await supabase.from("vault_events").insert({
              vault_id: vaultId,
              actor_id: userId,
              kind: "fund",
              detail: "Letter to beneficiary anchored on-chain (SPL Memo)",
              tx_signature: letterTx,
            });
          }
        }

        // Audit trail + mark complete
        await supabase.from("vault_events").insert([
          {
            vault_id: vaultId,
            actor_id: userId,
            kind: "fund",
            detail: `Vault funded · CA$${data.amount_cad}${isSimulatedMode() ? " (simulated)" : ""} · ramp ${onramp.providerRef}`,
            tx_signature: fund.signature,
          },
        ]);
        await supabase.from("vaults").update({ last_step: null }).eq("id", vaultId);

        return {
          id: vaultId,
          vault_pda: init.vaultPda,
          tx_signature: fund.signature,
          owner_pubkey: proof.fromPubkey,
          hot_pubkey: proof.toPubkey,
          letter_tx_signature: letterTx,
          claim_demo: beneficiaryRows[0]
            ? {
                name: beneficiaryRows[0].name,
                email: beneficiaryRows[0].email,
                token: beneficiaryRows[0].claim_token,
              }
            : null,
        };
      } catch (err) {
        console.error("createVault failed", err);
        // Mark vault as failed and bump retry counter so the dashboard can
        // surface a "Continue where you left off" / "Contact support" CTA.

        const { data: cur } = await supabase
          .from("vaults")
          .select("failure_count")
          .eq("id", vaultId)
          .maybeSingle();
        const next = ((cur as { failure_count?: number } | null)?.failure_count ?? 0) + 1;
        await supabase
          .from("vaults")
          .update({ status: "failed", failure_count: next })
          .eq("id", vaultId);
        throw err;
      }
    },
  );

// ─── Retry a failed vault ─────────────────────────────────────────────

export const retryVault = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ vault_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("vaults")
      .select("id, name, amount_cad, condition_kind, unlock_date, inactivity_days, last_checkin")
      .eq("id", data.vault_id)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Vault not found");

    const ownerPubkey = (await ensureCustodialWallet(userId)).pubkey;
    try {
      const init = await initVaultOnChain({
        ownerPubkey,
        vaultId: row.id as string,
        amountCadCents: Math.round(Number(row.amount_cad) * 100),
      });
      const proof = await sendUserToHotProof(userId, 0.001);
      const fund = { signature: proof.signature };
      await supabase
        .from("vaults")
        .update({
          vault_pda: init.vaultPda,
          usdc_ata: init.usdcAta,
          init_tx: init.signature,
          tx_signature: fund.signature,
          solana_pubkey: ownerPubkey,
          status: "active",
          last_step: null,
        })
        .eq("id", row.id);
      await supabase.from("vault_events").insert([
        {
          vault_id: row.id,
          actor_id: userId,
          kind: "fund",
          detail: `Vault retry succeeded · CA$${row.amount_cad}`,
          tx_signature: fund.signature,
        },
      ]);
      return { id: row.id as string, ok: true as const };
    } catch (err) {
      console.error("retryVault failed", err);
      const { data: cur } = await supabase
        .from("vaults")
        .select("failure_count")
        .eq("id", row.id)
        .maybeSingle();
      const next = ((cur as { failure_count?: number } | null)?.failure_count ?? 0) + 1;
      await supabase
        .from("vaults")
        .update({ status: "failed", failure_count: next })
        .eq("id", row.id);
      throw err;
    }
  });

// ─── Update beneficiaries ─────────────────────────────────────────────

export const replaceBeneficiaries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        vault_id: z.string().uuid(),
        beneficiaries: z.array(beneficiaryInputSchema).min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // RLS protects ownership; we only need to swap rows.
    await supabase.from("beneficiaries").delete().eq("vault_id", data.vault_id);
    const { error } = await supabase.from("beneficiaries").insert(
      data.beneficiaries.map((b) => ({
        vault_id: data.vault_id,
        name: b.name,
        email: b.email,
        pct: b.pct,
      })),
    );
    if (error) throw error;
    return { ok: true };
  });

// ─── Update letter message ────────────────────────────────────────────

export const updateVaultLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ vault_id: z.string().uuid(), message: z.string().max(8000) }).parse(d),
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

    const sig = v.vault_pda ? (await checkInOnChain({ vaultPda: v.vault_pda })).signature : null;
    const today = new Date().toISOString();
    const { error } = await supabase
      .from("vaults")
      .update({ last_checkin: today })
      .eq("id", data.vault_id);
    if (error) throw error;

    await supabase.from("vault_events").insert({
      vault_id: data.vault_id,
      actor_id: userId,
      kind: "checkin",
      detail: "Owner checked in",
      tx_signature: sig,
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
        supabase.from("beneficiaries").update({ claim_token: crypto.randomUUID() }).eq("id", b.id),
      );
    await Promise.all(updates);

    await supabase
      .from("vaults")
      .update({ status: "released", tx_signature: sig })
      .eq("id", data.vault_id);

    await supabase.from("vault_events").insert({
      vault_id: data.vault_id,
      actor_id: userId,
      kind: "release",
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
        vault_id: v.id,
        kind: "release",
        detail: `Auto-released by condition (${v.condition_kind})`,
        tx_signature: sig,
      });
      released.push(v.id);
    }
    return { released };
  });

// ─── Update condition ─────────────────────────────────────────────────

export const updateVaultCondition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ vault_id: z.string().uuid(), condition: conditionSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const c = data.condition;
    const { error } = await supabase
      .from("vaults")
      .update({
        condition_kind: c.kind,
        unlock_date: c.kind === "time" ? c.unlock_date : null,
        inactivity_days: c.kind === "inactivity" ? c.inactivity_days : null,
        last_checkin: c.kind === "inactivity" ? c.last_checkin : null,
      })
      .eq("id", data.vault_id);
    if (error) throw error;
    return { ok: true };
  });

// ─── Add funds ────────────────────────────────────────────────────────

export const addVaultFunds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ vault_id: z.string().uuid(), amount_cad: z.number().positive() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: v, error: getErr } = await supabase
      .from("vaults")
      .select("amount_cad, vault_pda")
      .eq("id", data.vault_id)
      .single();
    if (getErr) throw getErr;

    const fund = v.vault_pda
      ? await fundVaultOnChain({ vaultPda: v.vault_pda, amountCad: data.amount_cad })
      : { signature: `sim_fund_${Date.now()}` };

    const newAmount = Number(v.amount_cad) + data.amount_cad;
    const { error } = await supabase
      .from("vaults")
      .update({ amount_cad: newAmount })
      .eq("id", data.vault_id);
    if (error) throw error;

    await supabase.from("vault_events").insert({
      vault_id: data.vault_id,
      actor_id: userId,
      kind: "fund",
      detail: `Added CA$${data.amount_cad}`,
      tx_signature: fund.signature,
    });
    return { ok: true, amount_cad: newAmount, tx_signature: fund.signature };
  });

// ─── Beneficiary claim by email (resolves token server-side) ──────────

export const beneficiaryClaimByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ vault_id: z.string().uuid(), email: z.string().email() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Verify the user is signed in (auth middleware), then use admin to
    // bypass column revoke on beneficiaries.claim_token. The owner check
    // still happens via RLS on the vault read.
    const { data: vaultRow } = await context.supabase
      .from("vaults")
      .select("id")
      .eq("id", data.vault_id)
      .maybeSingle();
    if (!vaultRow) throw new Error("Vault not found or not visible");

    const { data: ben, error } = await supabaseAdmin
      .from("beneficiaries")
      .select("claim_token")
      .eq("vault_id", data.vault_id)
      .ilike("email", data.email)
      .maybeSingle();
    if (error) throw error;
    if (!ben?.claim_token) throw new Error("No claim token issued for this email yet");
    return { claim_token: ben.claim_token };
  });

// ─── Beneficiary claim (called from /claim page) ──────────────────────

export const beneficiaryClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ vault_id: z.string().uuid(), claim_token: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Fetch vault for owner wallet + amount
    const { data: v } = await supabase
      .from("vaults")
      .select("id, name, owner_id, amount_cad")
      .eq("id", data.vault_id)
      .maybeSingle();
    if (!v) throw new Error("Vault not found or not visible");

    const { data: pendingBen, error: pendingErr } = await supabaseAdmin
      .from("beneficiaries")
      .select("id, claimed_at")
      .eq("vault_id", data.vault_id)
      .eq("claim_token", data.claim_token)
      .maybeSingle();
    if (pendingErr) throw pendingErr;
    if (!pendingBen?.id) throw new Error("Invalid claim link");
    if (pendingBen.claimed_at) throw new Error("This share has already been claimed");

    // On-chain claim proof: platform hot wallet → owner's existing system wallet.
    const payout = await sendHotToUserSystemWallet(v.owner_id, 0.001);
    const sig = payout.signature;

    // Atomically consume the token and emit audit event
    const { data: result, error } = await supabase.rpc("consume_claim_token", {
      _vault_id: data.vault_id,
      _token: data.claim_token,
      _payout_signature: sig,
    });
    if (error) throw error;

    const row = (
      result as Array<{
        beneficiary_id: string;
        vault_name: string;
        pct: number;
        amount_cad: number;
        email: string;
      }> | null
    )?.[0];
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
    const { supabase, userId } = context;
    const { error } = await supabase.rpc("seed_demo_for_user");
    if (error) throw error;
    const { data: seededVaults, error: vErr } = await supabaseAdmin
      .from("vaults")
      .select("id, beneficiaries(id, claim_token)")
      .eq("owner_id", userId);
    if (vErr) throw vErr;
    await Promise.all(
      (seededVaults ?? []).flatMap((vault) =>
        (vault.beneficiaries ?? []).map((b) =>
          supabaseAdmin
            .from("beneficiaries")
            .update({ claim_token: crypto.randomUUID() })
            .eq("id", b.id),
        ),
      ),
    );
    return { ok: true };
  });

// ─── Ensure claim tokens for all beneficiaries (used by "Send PDF") ───

export const ensureClaimTokens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ vault_id: z.string().uuid() }).parse(d))
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      beneficiaries: Array<{
        id: string;
        name: string;
        email: string;
        pct: number;
        claim_token: string;
      }>;
    }> => {
      const { supabase, userId } = context;

      // Owner check via RLS
      const { data: vaultRow, error: vErr } = await supabase
        .from("vaults")
        .select("id, owner_id")
        .eq("id", data.vault_id)
        .maybeSingle();
      if (vErr) throw vErr;
      if (!vaultRow || vaultRow.owner_id !== userId) throw new Error("Vault not found");

      const { data: bens, error: bErr } = await supabaseAdmin
        .from("beneficiaries")
        .select("id, name, email, pct, claim_token")
        .eq("vault_id", data.vault_id);
      if (bErr) throw bErr;

      const updates = (bens ?? [])
        .filter((b) => !b.claim_token)
        .map(async (b) => {
          const token = crypto.randomUUID();
          await supabaseAdmin.from("beneficiaries").update({ claim_token: token }).eq("id", b.id);
          b.claim_token = token;
        });
      await Promise.all(updates);

      return {
        beneficiaries: (bens ?? []).map((b) => ({
          id: b.id,
          name: b.name,
          email: b.email,
          pct: Number(b.pct),
          claim_token: b.claim_token!,
        })),
      };
    },
  );

// ─── PUBLIC: Look up a claim by token (no auth — token IS the auth) ──

export const publicLookupClaim = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ vault_id: z.string().uuid(), token: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: vault, error: vErr } = await supabaseAdmin
      .from("vaults")
      .select(
        "id, name, amount_cad, status, condition_kind, unlock_date, inactivity_days, last_checkin, letter_message, letter_tx_signature, owner_id",
      )
      .eq("id", data.vault_id)
      .maybeSingle();
    if (vErr) throw vErr;
    if (!vault) throw new Error("Vault not found");

    const { data: ben, error: bErr } = await supabaseAdmin
      .from("beneficiaries")
      .select("id, name, email, pct, claimed_at, payout_tx_signature")
      .eq("vault_id", data.vault_id)
      .eq("claim_token", data.token)
      .maybeSingle();
    if (bErr) throw bErr;
    if (!ben) throw new Error("Invalid claim link");

    // Best-effort owner display name (RLS bypassed via admin client).
    let ownerName: string | null = null;
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("display_name, first_name, last_name")
      .eq("id", vault.owner_id)
      .maybeSingle();
    if (prof) {
      const dn = prof.display_name as string | null;
      const full = [prof.first_name, prof.last_name].filter(Boolean).join(" ").trim();
      ownerName = dn ?? (full || null);
    }

    return {
      vault: {
        id: vault.id,
        name: vault.name,
        amount_cad: Number(vault.amount_cad),
        status: statusToUi(vault.status as string),
        condition: rowToCondition(vault as never),
        letter_message: (vault as { letter_message?: string | null }).letter_message ?? null,
        letter_tx_signature:
          (vault as { letter_tx_signature?: string | null }).letter_tx_signature ?? null,
        owner_name: ownerName,
      },
      beneficiary: {
        id: ben.id,
        name: ben.name,
        email: ben.email,
        pct: Number(ben.pct),
        payout_cad: (Number(vault.amount_cad) * Number(ben.pct)) / 100,
        claimed_at: ben.claimed_at,
        payout_tx_signature: ben.payout_tx_signature,
      },
    };
  });

// ─── PUBLIC: Consume claim token (no auth) ───────────────────────────

export const publicClaimByToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ vault_id: z.string().uuid(), token: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: vault, error: vErr } = await supabaseAdmin
      .from("vaults")
      .select("id, name, amount_cad, status, owner_id")
      .eq("id", data.vault_id)
      .maybeSingle();
    if (vErr) throw vErr;
    if (!vault) throw new Error("Vault not found");
    if ((vault.status as string) !== "released") throw new Error("Vault not yet released");

    const { data: ben, error: bErr } = await supabaseAdmin
      .from("beneficiaries")
      .select("id, name, email, pct, claimed_at")
      .eq("vault_id", data.vault_id)
      .eq("claim_token", data.token)
      .maybeSingle();
    if (bErr) throw bErr;
    if (!ben) throw new Error("Invalid claim link");
    if (ben.claimed_at) throw new Error("This share has already been claimed");

    const amount_cad = (Number(vault.amount_cad) * Number(ben.pct)) / 100;

    // Demo on-chain payout: platform hot wallet → owner's existing system wallet.
    // Vault creation is the opposite direction (user system wallet → hot wallet).
    const payout = await sendHotToUserSystemWallet(vault.owner_id, 0.001);
    const sig = payout.signature;

    const { error: uErr } = await supabaseAdmin
      .from("beneficiaries")
      .update({ claimed_at: new Date().toISOString(), payout_tx_signature: sig })
      .eq("id", ben.id);
    if (uErr) throw uErr;

    await supabaseAdmin.from("vault_events").insert({
      vault_id: data.vault_id,
      kind: "release",
      detail: `Beneficiary claim: ${ben.email} · 0.001 SOL hot wallet → user system wallet`,
      tx_signature: sig,
    });

    const ramp = getRampProvider();
    const off = await ramp.offramp({
      beneficiaryEmail: ben.email,
      amountCad: amount_cad,
      reference: data.vault_id,
      payoutMethod: "interac",
    });

    return {
      vault_name: vault.name,
      amount_cad,
      pct: Number(ben.pct),
      email: ben.email,
      tx_signature: sig,
      offramp_ref: off.providerRef,
    };
  });
