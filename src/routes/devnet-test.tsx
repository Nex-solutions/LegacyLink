import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import idl from "@/lib/idl/vault.json";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/devnet-test")({
  ssr: false,
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);
    if (!roles?.some((r) => r.role === "admin")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: DevnetTest,
});

function DevnetTest() {
  const [log, setLog] = useState<string>("");

  const append = (msg: string) => setLog((l) => `${new Date().toLocaleTimeString()}  ${msg}\n${l}`);

  async function checkProgram() {
    try {
      const { Connection, PublicKey } = await import("@solana/web3.js");
      const programId = new PublicKey(import.meta.env.VITE_PROGRAM_ID);
      const connection = new Connection(
        import.meta.env.VITE_SOLANA_RPC || "https://api.devnet.solana.com",
        "confirmed",
      );
      append(`RPC: ${connection.rpcEndpoint}`);
      const info = await connection.getAccountInfo(programId);
      if (!info) {
        append(`❌ Program ${programId.toBase58()} not found on this RPC.`);
        return;
      }
      append(
        `✅ Program found. Executable=${info.executable}, owner=${info.owner.toBase58()}, ${info.data.length} bytes.`,
      );
    } catch (e) {
      append(`❌ ${(e as Error).message}`);
    }
  }

  async function checkBalance() {
    const { PublicKey, LAMPORTS_PER_SOL, Connection } = await import("@solana/web3.js");
    const input = window.prompt("Wallet address to check");
    if (!input) return append("Enter a wallet address first.");
    const wallet = new PublicKey(input);
    const connection = new Connection(
      import.meta.env.VITE_SOLANA_RPC || "https://api.devnet.solana.com",
      "confirmed",
    );
    const lamports = await connection.getBalance(wallet);
    append(`Wallet ${wallet.toBase58()} = ${lamports / LAMPORTS_PER_SOL} SOL`);
  }

  async function listAccounts() {
    try {
      const accountTypes = Array.isArray((idl as { accounts?: unknown[] }).accounts)
        ? ((idl as { accounts?: Array<{ name?: string }> }).accounts ?? [])
            .map((a) => a.name)
            .filter(Boolean)
        : [];
      if (accountTypes.length === 0) {
        append(
          "⚠️ IDL has no account types. Replace src/lib/idl/vault.json with the real IDL from Solana Playground.",
        );
        return;
      }
      append(`IDL accounts: ${accountTypes.join(", ")}`);
    } catch (e) {
      append(`❌ ${(e as Error).message}`);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold">Devnet smoke test</h1>
        <p className="text-sm text-muted-foreground">
          Program: <code>{import.meta.env.VITE_PROGRAM_ID || "not configured"}</code>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={checkProgram} variant="outline">
          1. Check program exists
        </Button>
        <Button onClick={checkBalance} variant="outline">
          2. My SOL balance
        </Button>
        <Button onClick={listAccounts} variant="outline">
          3. List IDL accounts
        </Button>
      </div>

      <pre className="whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-xs font-mono min-h-[200px]">
        {log || "Click a button above to run a devnet smoke test."}
      </pre>
    </div>
  );
}
