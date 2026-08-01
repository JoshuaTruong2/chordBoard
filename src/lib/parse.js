// Turn a raw pasted/uploaded chord sheet into a structured, line-based model.
//
// Model: { meta, lines }
//   meta  = { title, artist, key }   (best-effort, may be empty)
//   lines = array of line objects, each one of:
//     { id, kind: "chord", raw, tokens: [{ text, col, isChord }] }
//     { id, kind: "lyric", raw }
//     { id, kind: "empty" }
//
// Both plain "chords over lyrics" text and ChordPro (inline [C] brackets) are
// normalized into this same shape so rendering, transposition, and export all
// share one code path. `kind` can be overridden per line by the UI.

import { isChordToken } from "./transpose.js";

// Fraction of tokens on a line that must be chords for it to count as a chord line.
const CHORD_LINE_THRESHOLD = 0.7;

let idCounter = 0;
function nextId() {
  return `l${idCounter++}`;
}

// Split a line into whitespace-delimited tokens, recording each token's column.
function tokenize(line) {
  const tokens = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    tokens.push({ text: m[0], col: m.index });
  }
  return tokens;
}

// Classify a single plain-text line into a model line.
export function classifyLine(raw) {
  if (raw.trim() === "") {
    return { id: nextId(), kind: "empty", raw: "" };
  }
  const tokens = tokenize(raw).map((t) => ({
    ...t,
    isChord: isChordToken(t.text),
  }));
  const chordCount = tokens.filter((t) => t.isChord).length;
  const isChordLine = tokens.length > 0 && chordCount / tokens.length >= CHORD_LINE_THRESHOLD;
  if (isChordLine) {
    return { id: nextId(), kind: "chord", raw, tokens };
  }
  return { id: nextId(), kind: "lyric", raw };
}

// Detect ChordPro: at least one inline bracket whose contents parse as a chord,
// or any {directive}.
function looksLikeChordPro(text) {
  if (/^\s*\{[^}]+\}\s*$/m.test(text)) return true;
  const brackets = text.match(/\[([^\]]+)\]/g);
  if (!brackets) return false;
  return brackets.some((b) => isChordToken(b.slice(1, -1)));
}

// Parse ChordPro directives for meta info.
function parseDirectives(text) {
  const meta = { title: "", artist: "", key: "" };
  const map = {
    title: "title",
    t: "title",
    artist: "artist",
    subtitle: "artist",
    st: "artist",
    key: "key",
  };
  const re = /\{\s*([a-zA-Z_]+)\s*:\s*([^}]*)\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1].toLowerCase();
    if (map[name] && !meta[map[name]]) {
      meta[map[name]] = m[2].trim();
    }
  }
  return meta;
}

// Build a raw chord-row string by placing chord texts at their columns.
function buildChordRow(chords) {
  let row = "";
  for (const c of chords) {
    if (row.length < c.col) row += " ".repeat(c.col - row.length);
    else if (row.length > c.col && row.length > 0) row += " ";
    row += c.text;
  }
  return row.replace(/\s+$/, "");
}

// Convert one ChordPro line into a chord line + lyric line pair.
function expandChordProLine(line) {
  const out = [];
  const re = /\[([^\]]+)\]/g;
  let lyric = "";
  let lastIndex = 0;
  const chords = [];
  let m;
  while ((m = re.exec(line)) !== null) {
    lyric += line.slice(lastIndex, m.index);
    const chordText = m[1];
    if (isChordToken(chordText)) {
      chords.push({ text: chordText, col: lyric.length, isChord: true });
    }
    lastIndex = re.lastIndex;
  }
  lyric += line.slice(lastIndex);

  if (chords.length > 0) {
    const raw = buildChordRow(chords);
    out.push({ id: nextId(), kind: "chord", raw, tokens: chords });
  }
  if (lyric.trim() !== "") {
    out.push({ id: nextId(), kind: "lyric", raw: lyric.replace(/\s+$/, "") });
  } else if (chords.length === 0) {
    out.push({ id: nextId(), kind: "empty", raw: "" });
  }
  return out;
}

function parseChordPro(text) {
  const meta = parseDirectives(text);
  const lines = [];
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    // Skip directive-only lines.
    if (/^\s*\{[^}]+\}\s*$/.test(raw)) continue;
    if (raw.trim() === "") {
      lines.push({ id: nextId(), kind: "empty", raw: "" });
      continue;
    }
    if (/\[([^\]]+)\]/.test(raw)) {
      lines.push(...expandChordProLine(raw));
    } else {
      lines.push({ id: nextId(), kind: "lyric", raw: raw.replace(/\s+$/, "") });
    }
  }
  return { meta, lines };
}

function parsePlain(text) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((raw) => classifyLine(raw));
  return { meta: { title: "", artist: "", key: "" }, lines };
}

export function parseSheet(text) {
  if (!text || text.trim() === "") {
    return { meta: { title: "", artist: "", key: "" }, lines: [] };
  }
  return looksLikeChordPro(text) ? parseChordPro(text) : parsePlain(text);
}
