import { importChordUrl } from "../server/chordImport.js";

// Kept for backward compatibility — prefer POST /api/import.

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
    const result = await importChordUrl(url);
    res.status(200).json(result);
  } catch (err) {
    const message = err?.message || "Import failed.";
    const status =
      /Missing url|doesn’t look like|Supported sites|Only |No chord|not valid JSON|layout may have changed|Official\/Pro|free “Chords”|returned \d+|Could not find/i.test(
        message
      )
        ? 400
        : 502;
    res.status(status).json({ error: message });
  }
}
