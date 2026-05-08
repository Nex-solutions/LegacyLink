// Advisor link layer (mock). Mirrors the future shape of advisor_clients
// rows + an outbound invite for advisors that aren't on the platform yet.
// On real backend: external invites become a `pending_advisor_invites` row
// keyed by email, and platform connections become `advisor_clients` rows.

export type AdvisorLinkSource = "platform" | "external";
export type AdvisorLinkStatus = "pending" | "connected";

export type AdvisorLink = {
  id: string;
  source: AdvisorLinkSource;
  status: AdvisorLinkStatus;
  name: string;
  email: string;
  firm?: string;
  city?: string;
  focus?: string;
  invitedAt: string;
};

export type RecommendedAdvisor = {
  id: string;
  name: string;
  firm: string;
  city: string;
  focus: string;
  rating: string;
  email: string;
};

export const recommendedAdvisors: RecommendedAdvisor[] = [
  { id: "rec-1", name: "Élise Tremblay, CFP®", firm: "Boréal Wealth", city: "Montréal · QC", focus: "Estate & legacy planning", rating: "4.9", email: "elise@borealwealth.ca" },
  { id: "rec-2", name: "Marcus Bell, CIM", firm: "Pine Ridge Advisors", city: "Toronto · ON", focus: "Family trusts & insurance", rating: "4.8", email: "marcus@pineridge.ca" },
  { id: "rec-3", name: "Priya Nair, CFP®", firm: "Aster Private Wealth", city: "Vancouver · BC", focus: "Cross-border estates", rating: "5.0", email: "priya@asterwealth.ca" },
];

const KEY = "legacylink:advisor-links";

export function getAdvisorLinks(): AdvisorLink[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

export function saveAdvisorLinks(links: AdvisorLink[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(links));
}

export function addAdvisorLink(link: AdvisorLink) {
  const links = getAdvisorLinks();
  if (links.some(l => l.email.toLowerCase() === link.email.toLowerCase())) return;
  saveAdvisorLinks([link, ...links]);
}

export function removeAdvisorLink(id: string) {
  saveAdvisorLinks(getAdvisorLinks().filter(l => l.id !== id));
}
