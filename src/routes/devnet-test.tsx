import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import idl from "@/lib/idl/vault.json";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/devnet-test")({
  component: DevnetTest,
});

const PROGRAM_ID = new PublicKey(import.meta.env.VITE_PROGRAM_ID);

function DevnetTest() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [log, setLog] = useState<string>("");

  const append = (msg: string) =>
    setLog((l) => `${new Date().toLocaleTimeString()}  ${msg}\n${l}`);

  async function checkProgram() {
    try {
      append(`RPC: ${connection.rpcEndpoint}`);
      const info = await connection.getAccountInfo(PROGRAM_ID);
      if (!info) {
        append(`❌ Program ${PROGRAM_ID.toBase58()} not found on this RPC.`);
        return;
      }
      append(
        `✅ Program found. Executable=${info.executable}, owner=${info.owner.toBase58()}, ${info.data.length} bytes.`
      );
    } catch (e) {
      append(`❌ ${(e as Error).message}`);
    }
  }

  async function checkBalance() {
    if (!wallet.publicKey) return append("Connect a wallet first.");
    const lamports = await connection.getBalance(wallet.publicKey);
    append(`Wallet ${wallet.publicKey.toBase58()} = ${lamports / LAMPORTS_PER_SOL} SOL`);
  }

  async function listAccounts() {
    if (!wallet.publicKey || !wallet.signTransaction) {
      return append("Connect a wallet first.");
    }
    try {
      const provider = new AnchorProvider(
        connection,
        wallet as Parameters<typeof AnchorProvider>[1],
        { commitment: "confirmed" }
      );
      const program = new Program(idl as Idl, PROGRAM_ID, provider);
      const accountTypes = Object.keys(program.account);
      if (accountTypes.length === 0) {
        append(
          "⚠️ IDL has no account types. Replace src/lib/idl/vault.json with the real IDL from Solana Playground."
        );
        return;
      }
      append(`IDL accounts: ${accountTypes.join(", ")}`);
      // @ts-expect-error dynamic key
      const all = await program.account[accountTypes[0]].all();
      append(`✅ Fetched ${all.length} ${accountTypes[0]} account(s).`);
    } catch (e) {
      append(`❌ ${(e as Error).message}`);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold">Devnet smoke test</h1>
        <p className="text-sm text-muted-foreground">
          Program: <code>{PROGRAM_ID.toBase58()}</code>
        </p>
      </div>

      <WalletMultiButton />

      <div className="flex flex-wrap gap-2">
        <Button onClick={checkProgram} variant="outline">1. Check program exists</Button>
        <Button onClick={checkBalance} variant="outline">2. My SOL balance</Button>
        <Button onClick={listAccounts} variant="outline">3. List program accounts</Button>
      </div>

      <pre className="whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-xs font-mono min-h-[200px]">
        {log || "Click a button above. Connect Phantom (set to Devnet) first."}
      </pre>
    </div>
  );
}
