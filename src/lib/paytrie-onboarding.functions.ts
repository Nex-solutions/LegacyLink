// Server functions for Paytrie KYC onboarding + status reads.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateApiLink, paytrieOnboardingEnabled } from "./paytrie-onboarding.server";

const KycSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  address1: z.string().trim().min(1).max(200),
  address2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().min(1).max(100),
  province: z.string().trim().length(2),
  postal: z.string().trim().min(3).max(10),
  occupation: z.string().trim().min(1).max(120),
  pep: z.boolean(),
  tpd: z.boolean(),
});

export const submitKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => KycSchema.parse(d))
  .handler(async ({ context, data }) => {
    // Need email from auth user
    const { data: u, error: uerr } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (uerr || !u.user?.email) throw new Error("user email unavailable");

    const result = await generateApiLink({
      first_name: data.first_name,
      last_name: data.last_name,
      email: u.user.email,
      phone: data.phone || "0000000",
      dob: data.dob,
      address1: data.address1,
      address2: data.address2 || undefined,
      city: data.city,
      province: data.province.toLowerCase(),
      postal: data.postal.toUpperCase().replace(/\s/g, ""),
      occupation: data.occupation,
      pep: data.pep,
      tpd: data.tpd,
    });

    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        dob: data.dob,
        address1: data.address1,
        address2: data.address2 || null,
        city: data.city,
        province: data.province,
        postal: data.postal,
        occupation: data.occupation,
        pep: data.pep,
        tpd: data.tpd,
        kyc_status: "pending_verification",
        paytrie_verification_link: result.verificationLink,
        paytrie_user_id: result.paytrieUserId ?? null,
        kyc_submitted_at: new Date().toISOString(),
      })
      .eq("id", context.userId);
    if (pErr) throw pErr;

    return {
      verificationLink: result.verificationLink,
      simulated: result.simulated,
    };
  });

export const getMyKycStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("kyc_status,paytrie_verification_link,kyc_submitted_at,first_name,last_name")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return {
      status: (data?.kyc_status as string | undefined) ?? "not_started",
      verificationLink: data?.paytrie_verification_link as string | null,
      submittedAt: data?.kyc_submitted_at as string | null,
      firstName: data?.first_name as string | null,
      lastName: data?.last_name as string | null,
      paytrieLive: paytrieOnboardingEnabled(),
    };
  });

export const simulateKycApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ kyc_status: "verified" })
      .eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
