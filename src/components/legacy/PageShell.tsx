import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function PageShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`min-h-screen w-full bg-cream ${className}`}
      style={{ background: "var(--cream)" }}
    >
      {children}
    </motion.main>
  );
}

export function Blob({
  className = "",
  color = "var(--forest)",
  opacity = 0.05,
}: {
  className?: string;
  color?: string;
  opacity?: number;
}) {
  return <div className={`ll-blob ll-drift ${className}`} style={{ background: color, opacity }} />;
}
