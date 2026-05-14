// Client-side bridge between the legacy sync data layer and the real
// server functions. Pages call these helpers; they invoke the server
// fn, then refresh the in-memory cache so UI updates immediately.

import {
  listVaults,
  createVault,
  checkInVault,
  releaseVault,
  evaluateReleasesServer,
  replaceBeneficiaries,
  updateVaultCondition,
  updateVaultLetter,
  addVaultFunds,
  beneficiaryClaim,
  beneficiaryClaimByEmail,
  resetDemoServer,
  ensureClaimTokens,
  retryVault,
} from "./vault.functions";
import {
  setVaultsCache,
  getVaults,
  type Vault,
  type VaultCondition,
  type Beneficiary,
} from "./legacy-data";

function isAuthResponse(e: unknown): boolean {
  return typeof Response !== "undefined" && e instanceof Response;
}

export async function hydrateVaults(): Promise<Vault[]> {
  try {
    const data = await listVaults();
    setVaultsCache(data as unknown as Vault[]);
    return data as unknown as Vault[];
  } catch (e) {
    if (isAuthResponse(e)) {
      console.warn("[vault-client] hydrateVaults: not authenticated, using cache");
      return getVaults();
    }
    throw e;
  }
}

export async function evaluateAndHydrate(): Promise<{ released: string[]; vaults: Vault[] }> {
  try {
    const { released } = await evaluateReleasesServer();
    const vaults = await hydrateVaults();
    return { released, vaults };
  } catch (e) {
    if (isAuthResponse(e)) {
      console.warn("[vault-client] evaluateAndHydrate: not authenticated");
      return { released: [], vaults: getVaults() };
    }
    throw e;
  }
}

export async function serverCreateVault(input: {
  name: string;
  amount_cad: number;
  condition: VaultCondition;
  beneficiaries: { name: string; email: string; pct: number }[];
  letter_message?: string | null;
}): Promise<{
  id: string;
  vault_pda: string;
  tx_signature: string;
  owner_pubkey: string;
  hot_pubkey: string;
  letter_tx_signature: string | null;
  claim_demo: { name: string; email: string; token: string } | null;
}> {
  const res = await createVault({ data: input });
  await hydrateVaults();
  return {
    id: res.id,
    vault_pda: res.vault_pda,
    tx_signature: res.tx_signature,
    owner_pubkey: res.owner_pubkey,
    hot_pubkey: res.hot_pubkey,
    letter_tx_signature: res.letter_tx_signature,
    claim_demo: res.claim_demo,
  };
}

export async function serverCheckIn(vaultId: string) {
  await checkInVault({ data: { vault_id: vaultId } });
  await hydrateVaults();
}

export async function serverRelease(vaultId: string) {
  await releaseVault({ data: { vault_id: vaultId } });
  await hydrateVaults();
}

export async function serverReplaceBeneficiaries(vaultId: string, beneficiaries: Beneficiary[]) {
  await replaceBeneficiaries({
    data: {
      vault_id: vaultId,
      beneficiaries: beneficiaries.map((b) => ({
        name: b.name,
        email: b.email,
        pct: Number(b.pct),
      })),
    },
  });
  await hydrateVaults();
}

export async function serverUpdateCondition(vaultId: string, condition: VaultCondition) {
  await updateVaultCondition({ data: { vault_id: vaultId, condition } });
  await hydrateVaults();
}

export async function serverUpdateLetter(vaultId: string, message: string) {
  await updateVaultLetter({ data: { vault_id: vaultId, message } });
}

export async function serverAddFunds(vaultId: string, amount: number) {
  await addVaultFunds({ data: { vault_id: vaultId, amount_cad: amount } });
  await hydrateVaults();
}

export async function serverClaimByEmail(vaultId: string, email: string) {
  const { claim_token } = await beneficiaryClaimByEmail({ data: { vault_id: vaultId, email } });
  const result = await beneficiaryClaim({ data: { vault_id: vaultId, claim_token } });
  await hydrateVaults();
  return result;
}

export async function serverResetDemo() {
  await resetDemoServer();
  await hydrateVaults();
}

export async function serverEnsureClaimTokens(vaultId: string) {
  const res = await ensureClaimTokens({ data: { vault_id: vaultId } });
  await hydrateVaults();
  return res.beneficiaries;
}

export async function serverRetryVault(vaultId: string) {
  await retryVault({ data: { vault_id: vaultId } });
  await hydrateVaults();
}
