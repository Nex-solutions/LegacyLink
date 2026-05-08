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
} from "./vault.functions";
import { setVaultsCache, type Vault, type VaultCondition, type Beneficiary } from "./legacy-data";

export async function hydrateVaults(): Promise<Vault[]> {
  const data = await listVaults();
  // server returns same shape (id, name, amount_cad, status, condition, beneficiaries, created_at)
  setVaultsCache(data as unknown as Vault[]);
  return data as unknown as Vault[];
}

export async function evaluateAndHydrate(): Promise<{ released: string[]; vaults: Vault[] }> {
  const { released } = await evaluateReleasesServer();
  const vaults = await hydrateVaults();
  return { released, vaults };
}

export async function serverCreateVault(input: {
  name: string;
  amount_cad: number;
  condition: VaultCondition;
  beneficiaries: { name: string; email: string; pct: number }[];
}): Promise<{ id: string }> {
  const res = await createVault({ data: input });
  await hydrateVaults();
  return { id: res.id };
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
      beneficiaries: beneficiaries.map((b) => ({ name: b.name, email: b.email, pct: Number(b.pct) })),
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
