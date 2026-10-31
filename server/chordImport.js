import { fetchUltimateGuitar, isUltimateGuitarUrl } from "./ugExtract.js";
import { fetchKpopChords, isKpopChordsUrl } from "./kpopExtract.js";

/** Route a chord-site URL to the right extractor. */
export async function importChordUrl(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) throw new Error("Missing url.");

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("That doesn’t look like a valid URL.");
  }

  if (isUltimateGuitarUrl(trimmed) || parsed.hostname.includes("ultimate-guitar.com")) {
    return fetchUltimateGuitar(trimmed);
  }
  if (isKpopChordsUrl(trimmed)) {
    return fetchKpopChords(trimmed);
  }

  throw new Error(
    "Supported sites: Ultimate Guitar (free Chords tabs) and Kpopchords. Or paste the sheet below."
  );
}

export function supportedImportHosts() {
  return ["tabs.ultimate-guitar.com", "www.kpopchords.com"];
}
