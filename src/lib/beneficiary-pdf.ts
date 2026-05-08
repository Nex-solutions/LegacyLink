// Per-beneficiary "legacy letter + claim instructions" PDF.
// Runs entirely in the browser using pdf-lib (already installed).

import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import { format } from "date-fns";
import type { Vault, Beneficiary } from "./legacy-data";
import { conditionSummary } from "./vault-release";
import { formatCAD } from "./legacy-data";

const FOREST = rgb(0.102, 0.18, 0.102);
const HONEY = rgb(0.855, 0.647, 0.125);
const GRAY = rgb(0.36, 0.36, 0.36);

export type BeneficiaryPdfInput = {
  vault: Vault;
  beneficiary: Beneficiary;
  ownerName: string;
  letterMessage?: string | null;
  claimUrl: string;
};

const DEFAULT_LETTER =
  "If you are reading this, it means I wanted to make sure you were taken care of. " +
  "I set this aside for you so that, whatever else is happening, you have one less thing to worry about. " +
  "Use it well, and know that you were thought of.";

export async function generateBeneficiaryPdf({
  vault,
  beneficiary,
  ownerName,
  letterMessage,
  claimUrl,
}: BeneficiaryPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 56;
  let y = 842 - margin;

  page.drawRectangle({ x: 0, y: 842 - 8, width: 595, height: 8, color: HONEY });

  page.drawText("LegacyLink", { x: margin, y, size: 22, font: serifBold, color: FOREST });
  y -= 18;
  page.drawText(`A message for ${beneficiary.name}`, { x: margin, y, size: 11, font: sans, color: GRAY });
  y -= 36;

  // Vault summary
  page.drawText(vault.name, { x: margin, y, size: 24, font: serifBold, color: FOREST });
  y -= 22;
  const share = vault.amount_cad * Number(beneficiary.pct) / 100;
  page.drawText(`Your share: ${beneficiary.pct}% — ${formatCAD(share)}`, {
    x: margin, y, size: 13, font: sansBold, color: HONEY,
  });
  y -= 14;
  page.drawText(conditionSummary(vault), { x: margin, y, size: 10, font: sans, color: GRAY });
  y -= 32;

  // Letter
  page.drawText(`From ${ownerName}`, { x: margin, y, size: 11, font: serifBold, color: FOREST });
  y -= 18;
  y = drawWrapped(page, letterMessage?.trim() || DEFAULT_LETTER, {
    x: margin, y, maxWidth: 595 - margin * 2, font: serif, size: 12, color: FOREST, lineHeight: 18,
  });
  y -= 24;

  // Claim instructions
  page.drawText("How to claim", { x: margin, y, size: 13, font: serifBold, color: FOREST });
  y -= 8;
  page.drawLine({ start: { x: margin, y }, end: { x: 595 - margin, y }, color: HONEY, thickness: 1 });
  y -= 18;

  const steps = [
    `1. Visit the claim link below.`,
    `2. Sign in or create a free account using ${beneficiary.email}.`,
    `3. Confirm your details to receive your share via Interac e-Transfer.`,
  ];
  for (const s of steps) {
    y = drawWrapped(page, s, {
      x: margin, y, maxWidth: 595 - margin * 2, font: sans, size: 11, color: FOREST, lineHeight: 16,
    });
  }
  y -= 6;

  page.drawText("Claim link:", { x: margin, y, size: 10, font: sansBold, color: FOREST });
  y -= 14;
  y = drawWrapped(page, claimUrl, {
    x: margin, y, maxWidth: 595 - margin * 2, font: sans, size: 10, color: HONEY, lineHeight: 14,
  });
  y -= 8;

  if (beneficiary.claim_token) {
    page.drawText("Claim token (if asked):", { x: margin, y, size: 10, font: sansBold, color: FOREST });
    y -= 14;
    page.drawText(beneficiary.claim_token, { x: margin, y, size: 10, font: sans, color: GRAY });
    y -= 22;
  }

  // Footer
  y = Math.max(y, 80);
  page.drawLine({ start: { x: margin, y }, end: { x: 595 - margin, y }, color: rgb(0.85, 0.83, 0.78), thickness: 0.5 });
  y -= 16;
  page.drawText(`Vault ID: ${vault.id}`, { x: margin, y, size: 9, font: sans, color: GRAY });
  page.drawText(`Issued ${format(new Date(), "MMMM d, yyyy")}`, { x: 595 - margin - 160, y, size: 9, font: sans, color: GRAY });
  y -= 12;
  page.drawText("Certainty is a gift. — LegacyLink", { x: margin, y, size: 9, font: sans, color: GRAY });

  return await pdf.save();
}

function drawWrapped(page: PDFPage, text: string, opts: {
  x: number; y: number; maxWidth: number;
  font: PDFFont; size: number; color: ReturnType<typeof rgb>; lineHeight: number;
}) {
  const { x, maxWidth, font, size, color, lineHeight } = opts;
  let { y } = opts;
  const paragraphs = text.split(/\n+/);
  for (const para of paragraphs) {
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth) {
        page.drawText(line, { x, y, size, font, color });
        y -= lineHeight;
        line = w;
      } else {
        line = test;
      }
    }
    if (line) {
      page.drawText(line, { x, y, size, font, color });
      y -= lineHeight;
    }
    y -= 4;
  }
  return y;
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
