// Client helper: ask the API to fetch & extract a chord sheet from a supported URL.

export async function importFromChordUrl(url) {
  const res = await fetch("/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: url.trim() }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok) {
    throw new Error(data?.error || `Import failed (${res.status}).`);
  }
  if (!data?.text) {
    throw new Error("Import returned an empty sheet.");
  }
  return data;
}
