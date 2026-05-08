// Public webhook endpoint for Paytrie. HMAC verified.
// On buy completion: sweep user wallet → master, record ledger entries.
// On sell completion: mark intent complete.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyPaytrieSignature, paytrieEnabled } from "@/lib/paytrie.server";
import { sweepUserToMaster } from "@/lib/sweep.server";
import { recordOnRampAndSweep } from "@/lib/ledger.server";

type RampIntentRow = {
  id: string;
  user_id: string | null;
  kind: "onramp" | "offramp";
  status: string;
  paytrie_tx_id: string | null;
  amount_usdc: number | null;
  amount_cad: number | null;
  reference: string | null;
};

async function handleEvent(payload: Record<string, unknown>) {
  const txId = (payload.tx_id ?? payload.tx) as string | undefined;
  const status = (payload.status ?? "") as string;
  if (!txId) {
    console.warn("[paytrie:webhook] missing tx_id", payload);
    return;
  }

  const { data: intent, error } = await supabaseAdmin
    .from("ramp_intents")
    .select("*")
    .eq("paytrie_tx_id", txId)
    .maybeSingle<RampIntentRow>();
  if (error) {
    console.error("[paytrie:webhook] db error", error);
    return;
  }
  if (!intent) {
    console.warn("[paytrie:webhook] no intent for tx", txId);
    return;
  }

  // Always reflect remote status + payload
  await supabaseAdmin
    .from("ramp_intents")
    .update({ status, last_webhook: payload })
    .eq("id", intent.id);

  const isComplete = status === "complete" || status.startsWith("sending USDC-SOL");
  if (intent.kind === "onramp" && isComplete && intent.user_id && intent.amount_usdc) {
    // Idempotency: only sweep if not already swept
    if (intent.status === "swept" || intent.status === "complete-swept") return;
    try {
      const sweep = await sweepUserToMaster({
        userId: intent.user_id,
        amountUsdc: Number(intent.amount_usdc),
      });
      await recordOnRampAndSweep({
        userId: intent.user_id,
        amountUsdc: Number(intent.amount_usdc),
        externalRef: txId,
        reference: intent.reference ?? undefined,
        sweepTxSignature: sweep.signature,
        sweepGasLamports: sweep.gasLamports,
      });
      await supabaseAdmin
        .from("ramp_intents")
        .update({
          status: "complete-swept",
          sweep_tx_signature: sweep.signature,
        })
        .eq("id", intent.id);
    } catch (e) {
      console.error("[paytrie:webhook] sweep failed", e);
      await supabaseAdmin
        .from("ramp_intents")
        .update({ status: "sweep_failed" })
        .eq("id", intent.id);
    }
  }
}

export const Route = createFileRoute("/api/public/paytrie-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();

        // If Paytrie keys are set, require signature. In dev (no keys), accept
        // unsigned payloads so the mock provider can be tested locally.
        if (paytrieEnabled()) {
          const sig =
            request.headers.get("x-paytrie-signature") ??
            request.headers.get("x-webhook-signature");
          const ok = await verifyPaytrieSignature(body, sig);
          if (!ok) return new Response("invalid signature", { status: 401 });
        }

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("invalid json", { status: 400 });
        }

        try {
          await handleEvent(payload);
        } catch (e) {
          console.error("[paytrie:webhook] handler error", e);
          // 200 anyway so Paytrie doesn't retry forever; we logged it.
        }
        return new Response("ok");
      },
    },
  },
});
