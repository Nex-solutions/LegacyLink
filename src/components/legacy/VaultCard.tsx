import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { differenceInDays, parseISO } from "date-fns";
import { formatCAD, type Vault } from "@/lib/legacy-data";

function StatusPill({ status }: { status: Vault["status"] }) {
  const styles =
    status === "Active"
      ? { background: "var(--sage)", color: "var(--forest)" }
      : status === "Pending"
      ? { background: "var(--honey)", color: "var(--forest)" }
      : { background: "#D9D7D1", color: "var(--warm-gray)" };
  return (
    <span style={styles} className="px-3 py-1 rounded-full text-xs font-medium">
      {status}
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

  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: "0 16px 48px rgba(26,46,26,0.14)" }}
      transition={{ duration: 0.2 }}
      className="ll-card p-6 flex flex-col gap-4 relative"
    >
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
      {(cond.kind === "time" || cond.kind === "inactivity") && (
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
          style={{ color: "var(--honey)" }}
        >
          View Details →
        </Link>
      </div>
      {cond.kind === "inactivity" && onCheckIn && (
        <button
          onClick={() => onCheckIn(vault.id)}
          className="ll-pill ll-pill-sage text-sm self-start"
          style={{ padding: "0.5rem 1.1rem" }}
        >
          ✓ Check In
        </button>
      )}
    </motion.div>
  );
}
