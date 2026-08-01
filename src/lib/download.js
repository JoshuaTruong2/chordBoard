// Small helpers for triggering browser downloads and generating a PDF from the
// rendered chord sheet.

import html2pdf from "html2pdf.js";

export function downloadText(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function sanitizeFilename(name) {
  return (name || "chord-sheet").replace(/[\\/:*?"<>|]+/g, "").trim() || "chord-sheet";
}

export async function downloadPdf(element, filename) {
  if (!element) return;
  const opt = {
    margin: [10, 10, 10, 10],
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, backgroundColor: "#ffffff" },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css", "legacy"] },
  };
  await html2pdf().set(opt).from(element).save();
}
