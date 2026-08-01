import { fetchUltimateGuitar } from "../server/ugExtract.js";

// Vercel serverless function: POST /api/import-ug { url } → { text, meta }
// Same contract as the Vite dev middleware in server/ugImportPlugin.js.

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: 'Use POST with { "url": "..." }' });
    return;
  }

  try {
    const url = String(req.body?.url || "").trim();
    if (!url) {
      res.status(400).json({ error: "Missing url." });
      return;
    }

    const result = await fetchUltimateGuitar(url);
    res.status(200).json(result);
  } catch (err) {
    const message = err?.message || "Import failed.";
    const status = /Only Ultimate Guitar|Missing url|No chord sheet|not valid JSON|layout may have changed|Official\/Pro|doesn’t look like|free “Chords”|returned \d+/i.test(
      message
    )
      ? 400
      : 502;
    res.status(status).json({ error: message });
  }
}
