import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { differenceInDays, parseISO } from "date-fns";
import { formatCAD, type Vault } from "@/lib/legacy-data";
import { solscanUrl } from "@/lib/solana-explorer";

function StatusPill({ status }: { status: Vault["status"] }) {
  const styles =
    status === "Active"
      ? { background: "var(--sage)", color: "var(--forest)" }
      : status === "Pending"
      ? { background: "var(--honey)", color: "var(--forest)" }
      : status === "Failed" || status === "Draft"
      ? { background: "#F4D9C4", color: "#8B3A1A" }
      : { background: "#D9D7D1", color: "var(--warm-gray)" };
  const label = status === "Failed" || status === "Draft" ? "Incomplete" : status;
  return (
    <span style={styles} className="px-3 py-1 rounded-full text-xs font-medium">
      {label}
    </span>
  );
}

function Initials({ name, i }: { name: string; i: number }) {
  const initials = name.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2"
      style={{ background: "var(--forest)", color: "var(--cream)", borderColor: "var(--card-white)", marginLeft: i === 0 ? 0 : -10 }}
    >
      {initials}
    </div>
  );
}

export function VaultCard({ vault, onCheckIn }: { vault: Vault; onCheckIn?: (id: string) => void }) {
  const cond = vault.condition;
  let conditionText = "";
  let progress = 0;

  if (cond.kind === "time") {
    const target = parseISO(cond.unlock_date);
    const total = differenceInDays(target, parseISO(vault.created_at));
    const elapsed = differenceInDays(new Date(), parseISO(vault.created_at));
    progress = Math.max(0, Math.min(100, (elapsed / Math.max(total, 1)) * 100));
    conditionText = `Releases ${target.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}`;
  } else if (cond.kind === "inactivity") {
    const last = parseISO(cond.last_checkin);
    const elapsed = differenceInDays(new Date(), last);
    progress = Math.max(0, Math.min(100, (elapsed / cond.inactivity_days) * 100));
    conditionText = `Releases if silent for ${cond.inactivity_days} days`;
  } else {
    conditionText = "Manual release · You're in control";
  }

  const incomplete = vault.status === "Failed" || vault.status === "Draft";
  const demoBeneficiary = vault.beneficiaries[0];

  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: "0 16px 48px rgba(26,46,26,0.14)" }}
      transition={{ duration: 0.2 }}
      className="ll-card p-6 flex flex-col gap-4 relative"
      style={
        incomplete
          ? {
              borderStyle: "dashed",
              borderWidth: 2,
              borderColor: "#C97B4A",
              background: "rgba(244, 217, 196, 0.18)",
            }
          : undefined
      }
    >
      {incomplete && (
        <div
          className="absolute -top-3 left-4 px-3 py-1 rounded-full text-xs font-semibold shadow-sm"
          style={{ background: "#C97B4A", color: "white" }}
        >
          ⚠ Incomplete — Tap to resume
        </div>
      )}
      <div className="flex items-start justify-between">
        <h3 className="ll-display-serif text-lg font-semibold">{vault.name}</h3>
        <StatusPill status={vault.status} />
      </div>
      <div className="text-center py-3">
        <div style={{ fontFamily: "var(--font-serif)", color: "var(--forest)", fontSize: 32, fontWeight: 600 }}>
          {formatCAD(vault.amount_cad)}
        </div>
        <p className="text-sm mt-1" style={{ color: "var(--warm-gray)" }}>{conditionText}</p>
      </div>
      {(cond.kind === "time" || cond.kind === "inactivity") && !incomplete && (
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(26,46,26,0.08)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "var(--honey)" }} />
        </div>
      )}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center">
          {vault.beneficiaries.map((b, i) => <Initials key={b.email} name={b.name} i={i} />)}
        </div>
        <Link
          to="/vault/$id"
          params={{ id: vault.id }}
          className="text-sm font-medium"
          style={{ color: incomplete ? "#C97B4A" : "var(--honey)" }}
        >
          {incomplete ? "Resume →" : "View Details →"}
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-1">
        {demoBeneficiary?.claim_token && !incomplete && (
          <Link
            to="/claim"
            search={{ vault: vault.id, token: demoBeneficiary.claim_token }}
            className="ll-pill ll-pill-secondary text-sm"
            style={{ padding: "0.5rem 1.1rem" }}
          >
            View claim demo · {demoBeneficiary.name}
          </Link>
        )}
        {demoBeneficiary?.claimed_at && demoBeneficiary.payout_tx_signature && (
          <a
            href={solscanUrl("tx", demoBeneficiary.payout_tx_signature)}
            target="_blank"
            rel="noreferrer"
            className="text-xs underline"
            style={{ color: "var(--honey)" }}
          >
            Claim tx ↗
          </a>
        )}
        {vault.letter_tx_signature && (
          <a
            href={solscanUrl("tx", vault.letter_tx_signature)}
            target="_blank"
            rel="noreferrer"
            className="text-xs underline"
            style={{ color: "var(--honey)" }}
            title={vault.letter_message ?? undefined}
          >
            Letter tx ↗
          </a>
        )}
        {cond.kind === "inactivity" && onCheckIn && !incomplete && (
          <button
            onClick={() => onCheckIn(vault.id)}
            className="ll-pill ll-pill-sage text-sm"
            style={{ padding: "0.5rem 1.1rem" }}
          >
            ✓ Check In
          </button>
        )}
      </div>
    </motion.div>
  );
}
