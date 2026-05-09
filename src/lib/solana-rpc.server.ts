type RpcSuccess<T> = { jsonrpc: "2.0"; id: string; result: T };
type RpcFailure = { jsonrpc: "2.0"; id: string; error: { code: number; message: string; data?: unknown } };
type RpcResponse<T> = RpcSuccess<T> | RpcFailure;

export function getSolanaRpcUrl(): string {
  const rpcUrl = process.env.SOLANA_RPC;
  if (!rpcUrl) throw new Error("SOLANA_RPC env var not set");
  return rpcUrl;
}

async function rpcRequest<T>(method: string, params: unknown[] = []): Promise<T> {
  const response = await fetch(getSolanaRpcUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method, params }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} RPC failed: ${response.status} ${response.statusText}: ${text}`);

  let payload: RpcResponse<T>;
  try {
    payload = JSON.parse(text) as RpcResponse<T>;
  } catch {
    throw new Error(`${method} RPC returned invalid JSON: ${text.slice(0, 200)}`);
  }
  if ("error" in payload) throw new Error(`${method} RPC error ${payload.error.code}: ${payload.error.message}`);
  return payload.result;
}

export async function getBalanceLamports(pubkey: string): Promise<number> {
  const result = await rpcRequest<{ value: number }>("getBalance", [pubkey, { commitment: "confirmed" }]);
  return result.value;
}

export async function getLatestBlockhashDirect(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  const result = await rpcRequest<{ value: { blockhash: string; lastValidBlockHeight: number } }>("getLatestBlockhash", [
    { commitment: "confirmed" },
  ]);
  return result.value;
}

export async function sendRawTransactionDirect(serializedTx: Uint8Array): Promise<string> {
  return rpcRequest<string>("sendTransaction", [Buffer.from(serializedTx).toString("base64"), {
    encoding: "base64",
    skipPreflight: false,
    preflightCommitment: "confirmed",
  }]);
}

export async function requestAirdropDirect(pubkey: string, lamports: number): Promise<string> {
  return rpcRequest<string>("requestAirdrop", [pubkey, lamports]);
}

export async function getLatestSignatureForAddress(pubkey: string): Promise<string | undefined> {
  const result = await rpcRequest<Array<{ signature: string }>>("getSignaturesForAddress", [pubkey, { limit: 1 }]);
  return result[0]?.signature;
}