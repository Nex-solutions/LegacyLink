import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AuthSplit } from "@/components/legacy/AuthSplit";
import { supabase } from "@/integrations/supabase/client";
import { submitKyc, getMyKycStatus, simulateKycApproval } from "@/lib/paytrie-onboarding.functions";
import { prepareBrowserWalletFunding, provisionWallet } from "@/lib/wallet.functions";

import { solscanUrl } from "@/lib/solana-explorer";
const solanaExplorerUrl = (kind: "address" | "tx", value: string) => solscanUrl(kind, value);

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const Route = createFileRoute("/signup_/kyc")({
  head: () => ({ meta: [{ title: "Verify your identity — LegacyLink" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    reason: typeof s.reason === "string" ? s.reason : undefined,
  }),
  component: SignupKyc,
});

const PROVINCES = [
  ["AB", "Alberta"],
  ["BC", "British Columbia"],
  ["MB", "Manitoba"],
  ["NB", "New Brunswick"],
  ["NL", "Newfoundland and Labrador"],
  ["NS", "Nova Scotia"],
  ["ON", "Ontario"],
  ["PE", "Prince Edward Island"],
  ["QC", "Quebec"],
  ["SK", "Saskatchewan"],
  ["NT", "Northwest Territories"],
  ["NU", "Nunavut"],
  ["YT", "Yukon"],
] as const;

type KycForm = {
  first_name: string;
  last_name: string;
  phone: string;
  dob: string;
  address1: string;
  address2: string;
  city: string;
  province: string;
  postal: string;
  occupation: string;
  pep: boolean;
  tpd: boolean;
};

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDummy(): KycForm {
  const streets = [
    "Bloor",
    "Yonge",
    "King",
    "Queen",
    "Bay",
    "College",
    "Dundas",
    "Spadina",
    "Bathurst",
    "Robson",
  ];
  const suffixes = ["St", "Ave", "Rd", "Blvd"];
  const cities = ["Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa", "Edmonton", "Halifax"];
  const provinces = ["ON", "BC", "QC", "AB", "NS"];
  const occupations = [
    "Software Engineer",
    "Teacher",
    "Designer",
    "Nurse",
    "Accountant",
    "Architect",
    "Consultant",
    "Project Manager",
  ];
  const num = Math.floor(100 + Math.random() * 8900);
  const phone = "416" + String(Math.floor(1000000 + Math.random() * 8999999));
  const year = 1970 + Math.floor(Math.random() * 30);
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, "0");
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, "0");
  const letters = "ABCEGHJKLMNPRSTVXY";
  const digits = "0123456789";
  const postal =
    pick(letters.split("")) +
    pick(digits.split("")) +
    pick(letters.split("")) +
    pick(digits.split("")) +
    pick(letters.split("")) +
    pick(digits.split(""));
  return {
    first_name: "",
    last_name: "",
    phone,
    dob: `${year}-${month}-${day}`,
    address1: `${num} ${pick(streets)} ${pick(suffixes)}`,
    address2: "",
    city: pick(cities),
    province: pick(provinces),
    postal,
    occupation: pick(occupations),
    pep: true,
    tpd: true,
  };
}

function SignupKyc() {
  const navigate = useNavigate();
  const { reason } = Route.useSearch();
  const submit = useServerFn(submitKyc);
  const status = useServerFn(getMyKycStatus);
  const approve = useServerFn(simulateKycApproval);
  useEffect(() => {
    if (reason === "funds") {
      toast.message("Let's finish your profile first ✨", {
        description:
          "We just need a few details before you can fund your trust — takes under 2 minutes.",
      });
    }
  }, [reason]);
  const provision = useServerFn(provisionWallet);
  const prepareBrowserFunding = useServerFn(prepareBrowserWalletFunding);
  const [loading, setLoading] = useState(false);
  const [verificationLink, setVerificationLink] = useState<string | null>(null);
  const [simulated, setSimulated] = useState(false);
  const [wallet, setWallet] = useState<{
    pubkey: string;
    airdropSig: string | null;
    airdropFailed: boolean;
  } | null>(null);
  const [form, setForm] = useState(() => randomDummy());

  useEffect(() => {
    if (!simulated) return;
    (async () => {
      try {
        const r = await provision({ data: undefined } as never);
        let fundingSig = r.airdropSig;
        let fundingFailed = r.airdropFailed;
        if (!fundingSig) {
          try {
            const { Connection, PublicKey } = await import("@solana/web3.js");
            const connection = new Connection("https://api.devnet.solana.com", "confirmed");
            const existingTxs = await connection.getSignaturesForAddress(new PublicKey(r.pubkey), { limit: 1 });
            fundingSig = existingTxs[0]?.signature ?? null;
            if (!fundingSig) {
              const { blockhash } = await connection.getLatestBlockhash("confirmed");
              const signed = await prepareBrowserFunding({
                data: { toPubkey: r.pubkey, recentBlockhash: blockhash },
              });
              fundingSig = await connection.sendRawTransaction(
                base64ToBytes(signed.signedTransactionBase64),
                { skipPreflight: false, preflightCommitment: "confirmed" },
              );
            }
            fundingFailed = false;
          } catch (browserFundingError) {
            console.warn("browser wallet funding", browserFundingError);
          }
        }
        setWallet({
          pubkey: r.pubkey,
          airdropSig: fundingSig,
          airdropFailed: fundingFailed,
        });
      } catch (e) {
        console.warn("wallet provisioning", e);
      }
    })();
  }, [simulated, provision, prepareBrowserFunding]);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate({ to: "/login" });
        return;
      }
      const meta = sess.session.user.user_metadata as { display_name?: string } | undefined;
      const fallback = (meta?.display_name ?? "").trim();
      const [fbFirst, ...fbRest] = fallback.split(/\s+/);
      const fbLast = fbRest.join(" ");
      try {
        const s = await status({ data: undefined } as never);
        setForm((f) => ({
          ...f,
          first_name: s.firstName || fbFirst || f.first_name,
          last_name: s.lastName || fbLast || f.last_name,
        }));
        if (s.verificationLink) {
          setVerificationLink(s.verificationLink);
          setSimulated(true);
        }
      } catch {
        if (fbFirst) setForm((f) => ({ ...f, first_name: fbFirst, last_name: fbLast }));
      }
    })();
  }, [navigate, status]);

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.first_name || !form.last_name)
      return toast.error("Please enter your full legal name.");
    if (!form.dob) return toast.error("Date of birth is required.");
    if (!form.address1 || !form.city || !form.postal)
      return toast.error("Please complete your address.");
    if (!form.occupation) return toast.error("Occupation is required.");
    setLoading(true);
    try {
      const r = await submit({ data: form });
      setVerificationLink(r.verificationLink);
      setSimulated(true);
      toast.success("Thanks — your profile is ready.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't submit KYC.");
    } finally {
      setLoading(false);
    }
  }

  if (verificationLink) {
    if (simulated) {
      return (
        <AuthSplit quote="Welcome home — your legacy is in safe hands.">
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 36,
              fontWeight: 600,
              color: "var(--forest)",
            }}
          >
            You're all set, {form.first_name || "friend"} 🌿
          </h1>
          <p className="mt-3" style={{ color: "var(--warm-gray)" }}>
            Your identity is verified and your vault is ready. Thank you for trusting us with what
            matters most — let's begin building your legacy.
          </p>
          <div
            className="mt-5 p-4 rounded-xl text-sm"
            style={{
              background: "rgba(212,165,116,0.10)",
              border: "1px solid rgba(212,165,116,0.35)",
              color: "var(--forest)",
            }}
          >
            <div className="flex items-center gap-2 font-medium">
              <span>🔗</span>
              <span>Demo wallet created on Solana devnet</span>
            </div>
            {wallet ? (
              <>
                <div
                  className="mt-2 text-xs font-mono break-all"
                  style={{ color: "var(--warm-gray)" }}
                >
                  {wallet.pubkey}
                </div>
                {wallet.airdropSig && (
                  <a
                    href={solanaExplorerUrl("tx", wallet.airdropSig)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs underline mr-3"
                    style={{ color: "var(--forest)" }}
                  >
                    View funding tx ↗
                  </a>
                )}
                <a
                  href={solanaExplorerUrl("address", wallet.pubkey)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-xs underline"
                  style={{ color: "var(--forest)" }}
                >
                  View address ↗
                </a>
                <div className="mt-2 text-xs" style={{ color: "var(--warm-gray)" }}>
                  {wallet.airdropSig
                    ? "Funded with 0.005 devnet SOL from the demo treasury. Open the funding tx first if the address page is slow to update."
                    : wallet.airdropFailed
                      ? "Demo wallet is ready. Funding is still syncing, but you can continue to your dashboard."
                      : "Demo wallet is ready and funding is syncing."}
                </div>
              </>
            ) : (
              <div className="mt-2 text-xs" style={{ color: "var(--warm-gray)" }}>
                Provisioning your custodial wallet…
              </div>
            )}
          </div>
          <button
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                await approve({ data: undefined } as never);
                toast.success("Identity verified ✓");
                navigate({ to: "/dashboard" });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not finalize.");
              } finally {
                setLoading(false);
              }
            }}
            className="ll-pill ll-pill-primary w-full mt-6 inline-flex items-center justify-center"
            style={{ height: 52, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Finalizing…" : "Take me to my dashboard →"}
          </button>
        </AuthSplit>
      );
    }
    return (
      <AuthSplit quote="Identity verified once. Trusted forever.">
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 36,
            fontWeight: 600,
            color: "var(--forest)",
          }}
        >
          One last step
        </h1>
        <p className="mt-3" style={{ color: "var(--warm-gray)" }}>
          Click below to complete identity verification with our compliance partner. It usually
          takes under 3 minutes.
        </p>
        <button
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              await approve({ data: undefined } as never);
              toast.success("You're verified — welcome in ✨");
              navigate({ to: "/dashboard" });
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Could not finalize.");
            } finally {
              setLoading(false);
            }
          }}
          className="ll-pill ll-pill-primary w-full mt-6 inline-flex items-center justify-center"
          style={{ height: 52, opacity: loading ? 0.7 : 1 }}
        >
          {loading ? "Finalizing…" : "Continue →"}
        </button>
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          className="mt-4 w-full text-sm"
          style={{ color: "var(--warm-gray)" }}
        >
          Skip for now — I'll verify before creating a trust
        </button>
      </AuthSplit>
    );
  }

  return (
    <AuthSplit quote="A verified identity protects every legacy you build.">
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 32,
          fontWeight: 600,
          color: "var(--forest)",
        }}
      >
        Now let's get to know you better
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--warm-gray)" }}>
        Required by Canadian regulations to fund your vault. Takes 2 minutes.
      </p>
      <div
        className="mt-4 px-3 py-2 rounded-lg text-xs"
        style={{
          background: "rgba(232,160,32,0.14)",
          color: "var(--forest)",
          border: "1px solid rgba(232,160,32,0.35)",
        }}
      >
        <strong style={{ color: "var(--honey)" }}>Test mode:</strong> dummy data has been pre-filled
        so you can breeze through. Just confirm your name and continue.
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="ll-label">Legal first name</label>
            <input
              className="ll-input"
              value={form.first_name}
              onChange={(e) => update("first_name", e.target.value)}
            />
          </div>
          <div>
            <label className="ll-label">Legal last name</label>
            <input
              className="ll-input"
              value={form.last_name}
              onChange={(e) => update("last_name", e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="ll-label">Date of birth</label>
            <input
              type="date"
              className="ll-input"
              value={form.dob}
              onChange={(e) => update("dob", e.target.value)}
            />
          </div>
          <div>
            <label className="ll-label">Phone</label>
            <input
              className="ll-input"
              placeholder="4165551234"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="ll-label">Address</label>
          <input
            className="ll-input"
            placeholder="123 Main Street"
            value={form.address1}
            onChange={(e) => update("address1", e.target.value)}
          />
        </div>
        <div>
          <label className="ll-label">Apartment / Unit (optional)</label>
          <input
            className="ll-input"
            value={form.address2}
            onChange={(e) => update("address2", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="ll-label">City</label>
            <input
              className="ll-input"
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
            />
          </div>
          <div>
            <label className="ll-label">Province</label>
            <select
              className="ll-input"
              value={form.province}
              onChange={(e) => update("province", e.target.value)}
            >
              {PROVINCES.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="ll-label">Postal</label>
            <input
              className="ll-input"
              placeholder="M5V1A1"
              value={form.postal}
              onChange={(e) => update("postal", e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="ll-label">Occupation</label>
          <input
            className="ll-input"
            placeholder="Software Engineer"
            value={form.occupation}
            onChange={(e) => update("occupation", e.target.value)}
          />
        </div>
        <label
          className="flex items-start gap-2 text-sm pt-1"
          style={{ color: "var(--warm-gray)" }}
        >
          <input
            type="checkbox"
            className="mt-1 accent-[var(--honey)]"
            checked={form.pep}
            onChange={(e) => update("pep", e.target.checked)}
          />
          I am a Politically Exposed Person (PEP).
        </label>
        <label className="flex items-start gap-2 text-sm" style={{ color: "var(--warm-gray)" }}>
          <input
            type="checkbox"
            className="mt-1 accent-[var(--honey)]"
            checked={form.tpd}
            onChange={(e) => update("tpd", e.target.checked)}
          />
          I am acting on behalf of a third party.
        </label>

        <button
          disabled={loading}
          type="submit"
          className="ll-pill ll-pill-primary w-full mt-2"
          style={{ height: 52, opacity: loading ? 0.7 : 1 }}
        >
          {loading ? "Preparing verification…" : "Continue"}
        </button>
        <Link
          to="/dashboard"
          className="block text-center text-xs mt-2"
          style={{ color: "var(--warm-gray)" }}
        >
          Skip for now — I'll verify before creating a trust
        </Link>
      </form>
    </AuthSplit>
  );
}
