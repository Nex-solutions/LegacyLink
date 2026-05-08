// Generates a printable "legacy letter" PDF for a vault using pdf-lib.
// Runs entirely in the browser — no server roundtrip, no Worker concerns.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { format } from "date-fns";
import type { Vault } from "./legacy-data";
import { conditionSummary } from "./vault-release";
import { formatCAD } from "./legacy-data";

export type Signature = {
  name: string;
  role: "Owner" | "Advisor";
  signedAt: string; // ISO
};

export type LetterInput = {
  vault: Vault;
  ownerName: string;
  ownerEmail: string;
  message: string;
  signatures: Signature[];
};

const FOREST = rgb(0.102, 0.18, 0.102);   // ~#1A2E1A
const HONEY = rgb(0.855, 0.647, 0.125);   // ~#DAA520
const GRAY = rgb(0.36, 0.36, 0.36);

export async function buildLegacyLetterPdf({ vault, ownerName, ownerEmail, message }: LetterInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);

  const margin = 56;
  let y = 842 - margin;

  // Header bar
  page.drawRectangle({ x: 0, y: 842 - 8, width: 595, height: 8, color: HONEY });

  page.drawText("LegacyLink", { x: margin, y, size: 22, font: serifBold, color: FOREST });
  y -= 18;
  page.drawText("A letter for those who matter most.", { x: margin, y, size: 10, font: sans, color: GRAY });
  y -= 36;

  // Vault title
  page.drawText(vault.name, { x: margin, y, size: 28, font: serifBold, color: FOREST });
  y -= 26;
  page.drawText(`${formatCAD(vault.amount_cad)} held in trust`, { x: margin, y, size: 12, font: sans, color: HONEY });
  y -= 14;
  page.drawText(conditionSummary(vault), { x: margin, y, size: 10, font: sans, color: GRAY });
  y -= 32;

  // Hand-written message
  page.drawText("From " + ownerName, { x: margin, y, size: 11, font: serifBold, color: FOREST });
  y -= 18;
  y = drawWrapped(page, message, { x: margin, y, maxWidth: 595 - margin * 2, font: serif, size: 12, color: FOREST, lineHeight: 18 });
  y -= 24;

  // Beneficiaries
  page.drawText("To my beneficiaries", { x: margin, y, size: 13, font: serifBold, color: FOREST });
  y -= 8;
  page.drawLine({ start: { x: margin, y }, end: { x: 595 - margin, y }, color: HONEY, thickness: 1 });
  y -= 18;
  for (const b of vault.beneficiaries) {
    const share = formatCAD(vault.amount_cad * b.pct / 100);
    page.drawText(`${b.name}`, { x: margin, y, size: 12, font: serifBold, color: FOREST });
    page.drawText(b.email, { x: margin + 200, y, size: 10, font: sans, color: GRAY });
    page.drawText(`${b.pct}%`, { x: 595 - margin - 90, y, size: 12, font: serif, color: FOREST });
    page.drawText(share, { x: 595 - margin - 50, y, size: 11, font: sans, color: HONEY });
    y -= 18;
  }

  y -= 24;
  // Footer
  page.drawLine({ start: { x: margin, y }, end: { x: 595 - margin, y }, color: rgb(0.85, 0.83, 0.78), thickness: 0.5 });
  y -= 16;
  page.drawText(`Vault ID: ${vault.id}`, { x: margin, y, size: 9, font: sans, color: GRAY });
  page.drawText(`Issued ${format(new Date(), "MMMM d, yyyy")}`, { x: 595 - margin - 160, y, size: 9, font: sans, color: GRAY });
  y -= 12;
  page.drawText(`Owner: ${ownerName} · ${ownerEmail}`, { x: margin, y, size: 9, font: sans, color: GRAY });
  y -= 12;
  page.drawText("Certainty is a gift. — LegacyLink", { x: margin, y, size: 9, font: sans, color: GRAY });

  return await pdf.save();
}

function drawWrapped(page: import("pdf-lib").PDFPage, text: string, opts: {
  x: number; y: number; maxWidth: number;
  font: import("pdf-lib").PDFFont; size: number; color: ReturnType<typeof rgb>; lineHeight: number;
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
    y -= 6;
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
