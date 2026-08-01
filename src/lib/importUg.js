// Client helper: ask the local/dev API to fetch & extract an Ultimate Guitar tab.

export async function importFromUltimateGuitar(url) {
  const res = await fetch("/api/import-ug", {
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
