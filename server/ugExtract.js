// Extract a plain chord sheet from an Ultimate Guitar tab page HTML.
// UG embeds page state in <div class="js-store" data-content="...json...">.

const UG_HOSTS = new Set([
  "tabs.ultimate-guitar.com",
  "www.ultimate-guitar.com",
  "ultimate-guitar.com",
]);

export function isUltimateGuitarUrl(raw) {
  try {
    const u = new URL(raw);
    if (!(u.protocol === "http:" || u.protocol === "https:")) return false;
    if (!UG_HOSTS.has(u.hostname)) return false;
    // Soft-block obvious Pro landing pages; free tabs live under /tab/...
    if (u.pathname.startsWith("/pro")) return false;
    return true;
  } catch {
    return false;
  }
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#0*34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function findJsStoreJson(html) {
  // data-content may appear before or after the js-store class.
  const patterns = [
    /<div[^>]*\bclass="[^"]*\bjs-store\b[^"]*"[^>]*\bdata-content="([^"]*)"/i,
    /<div[^>]*\bdata-content="([^"]*)"[^>]*\bclass="[^"]*\bjs-store\b[^"]*"/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeHtmlEntities(m[1]);
  }
  return null;
}

function stripUgMarkup(content) {
  return String(content || "")
    .replace(/\[\/?tab\]/gi, "")
    .replace(/\[\/?ch\]/gi, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

export function extractFromUgHtml(html) {
  const raw = findJsStoreJson(html);
  if (!raw) {
    throw new Error("Could not find Ultimate Guitar page data. The site layout may have changed.");
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Ultimate Guitar page data was not valid JSON.");
  }

  const page = data?.store?.page?.data;
  const tab = page?.tab;
  const content = page?.tab_view?.wiki_tab?.content;
  if (!content) {
    if (page?.has_official_version || page?.has_pro_tab_version || page?.official_version) {
      throw new Error(
        "That link opens an Official/Pro tab. Pick a free “Chords” version from the song’s list on Ultimate Guitar."
      );
    }
    throw new Error(
      "No chord sheet found on that page. Open a free Chords tab (not Pro/Official)."
    );
  }

  const type = String(tab?.type || "").toLowerCase();
  if (type && type !== "chords" && type !== "ukulele chords") {
    // Still return content if present — some pages mislabel — but warn via type.
  }

  const song = tab?.song_name || "";
  const artist = tab?.artist_name || "";
  const body = stripUgMarkup(content);
  const titleLine = song && artist ? `${song} - ${artist}` : song || artist;
  const text = titleLine ? `${titleLine}\n\n${body}` : body;
  return {
    text,
    meta: {
      title: song,
      artist,
      type: tab?.type || "",
      url: tab?.tab_url || "",
    },
  };
}

export async function fetchUltimateGuitar(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("That doesn’t look like a valid URL.");
  }
  if (parsed.pathname.startsWith("/pro")) {
    throw new Error(
      "That link is an Official/Pro page. Open the song on Ultimate Guitar and copy a free “Chords” tab URL instead."
    );
  }
  if (!isUltimateGuitarUrl(url)) {
    throw new Error("Only Ultimate Guitar tab URLs are supported right now.");
  }

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`Ultimate Guitar returned ${res.status}. Check the link and try again.`);
  }

  const html = await res.text();
  return extractFromUgHtml(html);
}
