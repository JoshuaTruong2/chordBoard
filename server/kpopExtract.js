// Extract a ChordPro-style chord sheet from a kpopchords.com page.
//
// Each visual line is a .cpress_line containing .cpress_line_section blocks.
// Every chord position stores 12 transpose variants (key-…-0 … key-…-11);
// key-0 is the default (visible) spelling — that's what we keep.

const KPOP_HOSTS = new Set(["www.kpopchords.com", "kpopchords.com"]);

export function isKpopChordsUrl(raw) {
  try {
    const u = new URL(raw);
    return (u.protocol === "http:" || u.protocol === "https:") && KPOP_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

function decodeEntities(str) {
  return String(str || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripTags(html) {
  return decodeEntities(String(html || "").replace(/<[^>]+>/g, ""));
}

function articleHtml(html) {
  // Prefer the post body so footer spam / widgets are ignored.
  const start = html.search(/<div[^>]*class="[^"]*entry-content[^"]*"/i);
  if (start < 0) return html;
  const from = html.indexOf(">", start) + 1;
  const endMarkers = [
    html.indexOf("Related posts", from),
    html.indexOf('class="entry-footer"', from),
    html.indexOf('id="comments"', from),
    html.indexOf("</article>", from),
  ].filter((i) => i > from);
  const end = endMarkers.length ? Math.min(...endMarkers) : html.length;
  return html.slice(from, end);
}

function extractTitle(html) {
  const h1 = html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) {
    return stripTags(h1[1])
      .replace(/\s*\(Chords[^)]*\)\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  const pre = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  if (pre) {
    const artist = pre[1].match(/Artist:\s*(.+)/i)?.[1]?.trim();
    const title = pre[1].match(/Title:\s*(.+)/i)?.[1]?.trim();
    if (title && artist) return `${title} - ${artist}`;
    return title || artist || "";
  }
  return "";
}

function extractMetaPre(html) {
  const pre = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  if (!pre) return "";
  return decodeEntities(pre[1]).replace(/\r\n/g, "\n").trim();
}

/** Pick the default (key-0 / visible) chord text from a line section. */
function chordFromSection(sectionHtml) {
  const key0 = sectionHtml.match(
    /class="chord[^"]*key-[^"]*-0"[^>]*>\s*<span class="chordshort">([^<]*)<\/span>/i
  );
  if (key0) return decodeEntities(key0[1]).trim();

  const chordDivs = [...sectionHtml.matchAll(/<div class="chord\b([^>]*)>([\s\S]*?)<\/div>/gi)];
  for (const m of chordDivs) {
    if (/display\s*:\s*none/i.test(m[1])) continue;
    const name = m[2].match(/chordshort">([^<]*)/i);
    if (name) return decodeEntities(name[1]).trim();
  }
  return "";
}

function lyricFromSection(sectionHtml) {
  const m = sectionHtml.match(/<div class="lyric">([\s\S]*?)<\/div>/i);
  return m ? stripTags(m[1]) : "";
}

/** Slice one .cpress_line block starting at `start` (index of the open tag). */
function sliceCpressLine(html, start) {
  const open = '<div class="cpress_line">';
  let i = start + open.length;
  let depth = 1;
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf("<div", i);
    const nextClose = html.indexOf("</div>", i);
    if (nextClose < 0) break;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 4;
    } else {
      depth -= 1;
      i = nextClose + 6;
    }
  }
  return html.slice(start, i);
}

function lineFromCpressLine(lineHtml) {
  const comment = lineHtml.match(/class="cpress_comment">([^<]+)/i);
  if (comment) {
    return { kind: "comment", text: decodeEntities(comment[1]).trim() };
  }

  const starts = [];
  const re = /<div class="cpress_line_section">/gi;
  let m;
  while ((m = re.exec(lineHtml)) !== null) starts.push(m.index);
  if (starts.length === 0) return null;

  let chordPro = "";
  for (let i = 0; i < starts.length; i++) {
    const from = starts[i];
    const to = i + 1 < starts.length ? starts[i + 1] : lineHtml.length;
    const section = lineHtml.slice(from, to);
    const chord = chordFromSection(section);
    const lyric = lyricFromSection(section);
    if (chord) chordPro += `[${chord}]`;
    chordPro += lyric;
  }

  return { kind: "chordpro", text: chordPro.replace(/[ \t]+$/g, "") };
}

export function extractFromKpopHtml(html) {
  const title = extractTitle(html);
  const metaPre = extractMetaPre(html);
  const bodyHtml = articleHtml(html);

  const lineStarts = [];
  const re = /<div class="cpress_line">/gi;
  let m;
  while ((m = re.exec(bodyHtml)) !== null) lineStarts.push(m.index);

  if (lineStarts.length === 0) {
    throw new Error("Could not find a chord sheet on that Kpopchords page. The layout may have changed.");
  }

  const lines = [];
  let seenIntro = false;
  let insertedSplit = false;

  for (const start of lineStarts) {
    const slice = sliceCpressLine(bodyHtml, start);
    const parsed = lineFromCpressLine(slice);
    if (!parsed || !parsed.text.trim()) continue;

    if (parsed.kind === "comment") {
      const label = parsed.text;
      if (/^intro$/i.test(label)) {
        if (seenIntro && !insertedSplit) {
          lines.push("");
          lines.push("---");
          lines.push("");
          insertedSplit = true;
        }
        seenIntro = true;
      }
      lines.push(`[${label}]`);
      continue;
    }

    lines.push(parsed.text);
  }

  const body = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!body) {
    throw new Error("No chords or lyrics found on that Kpopchords page.");
  }

  const headerParts = [];
  if (title) headerParts.push(title);
  if (metaPre) headerParts.push(metaPre);
  const text = headerParts.length ? `${headerParts.join("\n\n")}\n\n${body}` : body;

  return {
    text,
    meta: {
      title: title || "",
      artist: "",
      type: "Kpopchords",
      url: "",
    },
  };
}

export async function fetchKpopChords(url) {
  if (!isKpopChordsUrl(url)) {
    throw new Error("Only Kpopchords links are supported for this importer (kpopchords.com).");
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
    throw new Error(`Kpopchords returned ${res.status}. Check the link and try again.`);
  }

  const page = await res.text();
  const result = extractFromKpopHtml(page);
  result.meta.url = url;
  return result;
}
