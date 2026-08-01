// Chord parsing and transposition.
//
// A chord is: root note (A-G) + optional accidental (# or b) + quality suffix
// (m, 7, sus4, maj7, add9, ...) + optional /bass note. We shift the root and
// bass by a number of semitones while leaving the quality suffix untouched.

const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

// Map every spelling of a note to its pitch class index (0-11).
const NOTE_TO_INDEX = {
  C: 0,
  "B#": 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  "E#": 5,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};

// Keys that are conventionally written with flats.
const FLAT_KEYS = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm", "Abm"]);

// Preferred key spelling per pitch class, chosen to avoid awkward keys with
// double accidentals (e.g. Eb rather than D#, Bb rather than A#). The only
// genuine ties have 6 accidentals either way, so the sharps/flats preference
// breaks them: F#/Gb for major, D#m/Ebm for minor.
const MAJOR_KEYS_SHARP = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MAJOR_KEYS_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const MINOR_KEYS_SHARP = ["Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "Bbm", "Bm"];
const MINOR_KEYS_FLAT = ["Cm", "C#m", "Dm", "Ebm", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "Bbm", "Bm"];

function preferredKeyName(pc, minor, useFlats) {
  const idx = (((pc % 12) + 12) % 12);
  if (minor) return (useFlats ? MINOR_KEYS_FLAT : MINOR_KEYS_SHARP)[idx];
  return (useFlats ? MAJOR_KEYS_FLAT : MAJOR_KEYS_SHARP)[idx];
}

// Selectable major target keys for the dropdown, using the preferred spellings
// so the current key is always present and never an awkward enharmonic.
export function keyOptions(useFlats) {
  return useFlats ? [...MAJOR_KEYS_FLAT] : [...MAJOR_KEYS_SHARP];
}

// Matches a single chord token. Group 1 = root+accidental, group 2 = quality,
// group 3 = bass note (after a slash).
const CHORD_RE = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/;

// Valid chord quality: a run of known quality keywords and modifier characters.
// This rejects ordinary words and section labels (e.g. "Bridge", "Chorus")
// that happen to start with a note letter.
const QUALITY_RE = /^(?:maj|min|sus|add|dim|aug|m|M|b|#|\+|-|Δ|ø|°|\d|\(|\)|,)*$/;

export function isChordToken(token) {
  if (!token) return false;
  const m = token.match(CHORD_RE);
  if (!m) return false;
  return QUALITY_RE.test(m[2] || "");
}

// Decide whether a given key uses flats.
export function keyUsesFlats(key) {
  if (!key) return false;
  return FLAT_KEYS.has(key);
}

function noteToIndex(note) {
  return NOTE_TO_INDEX[note];
}

function indexToNote(index, useFlats) {
  const table = useFlats ? FLAT : SHARP;
  return table[((index % 12) + 12) % 12];
}

// Transpose a single note name (root or bass) by semitones.
function transposeNote(note, semitones, useFlats) {
  const idx = noteToIndex(note);
  if (idx == null) return note;
  return indexToNote(idx + semitones, useFlats);
}

// Transpose a full chord token. Returns the original string if it does not
// parse as a chord.
export function transposeChord(chord, semitones, useFlats) {
  const m = chord.match(CHORD_RE);
  if (!m) return chord;
  const [, root, quality = "", bass] = m;
  const newRoot = transposeNote(root, semitones, useFlats);
  let result = newRoot + quality;
  if (bass) {
    result += "/" + transposeNote(bass, semitones, useFlats);
  }
  return result;
}

// --- Key-aware, interval-based transposition ------------------------------
//
// Transposing by a raw semitone count can't spell notes correctly, because the
// same interval in semitones has two letter names (e.g. +1 could be C#, a
// chromatic semitone, or Db, a minor second). To spell like a musician, we
// transpose by the *diatonic interval* between the source and target keys:
// advance the letter name by the interval's number and adjust the accidental
// by the pitch difference. Spelling then follows the target key automatically.

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Parse a bare note name ("C", "F#", "Bb", even "G##") into letter/accidental.
function parseNoteName(note) {
  const m = note.match(/^([A-G])([#b]*)$/);
  if (!m) return null;
  let acc = 0;
  for (const ch of m[2]) acc += ch === "#" ? 1 : -1;
  return { letter: m[1], acc, pc: (((LETTER_PC[m[1]] + acc) % 12) + 12) % 12 };
}

function spellAccidental(n) {
  if (n > 0) return "#".repeat(n);
  if (n < 0) return "b".repeat(-n);
  return "";
}

// The (letterShift 0-6, semitoneShift 0-11) that takes one note to another.
function intervalBetween(fromNote, toNote) {
  const a = parseNoteName(fromNote);
  const b = parseNoteName(toNote);
  if (!a || !b) return { letterShift: 0, semitoneShift: 0 };
  return {
    letterShift: (LETTERS.indexOf(b.letter) - LETTERS.indexOf(a.letter) + 7) % 7,
    semitoneShift: (b.pc - a.pc + 12) % 12,
  };
}

// Transpose one note by a diatonic interval, keeping a correct spelling.
function transposeNoteByInterval(note, letterShift, semitoneShift) {
  const n = parseNoteName(note);
  if (!n) return note;
  const newLetter = LETTERS[(LETTERS.indexOf(n.letter) + letterShift) % 7];
  const targetPc = (n.pc + semitoneShift) % 12;
  let acc = targetPc - LETTER_PC[newLetter];
  while (acc > 6) acc -= 12;
  while (acc < -6) acc += 12;
  return newLetter + spellAccidental(acc);
}

function transposeChordByInterval(chord, letterShift, semitoneShift) {
  const m = chord.match(CHORD_RE);
  if (!m) return chord;
  const [, root, quality = "", bass] = m;
  let result = transposeNoteByInterval(root, letterShift, semitoneShift) + quality;
  if (bass) result += "/" + transposeNoteByInterval(bass, letterShift, semitoneShift);
  return result;
}

// Build a transposer bound to a specific source key + offset. Spelling is
// derived from the resulting target key, so accidentals come out musically
// correct (e.g. F -> Bb, not A#). `inverse` maps a chord back to the source
// key, used to store manual edits as a base chord at zero transposition.
//
// When the source key is unknown (no chord detected yet), we fall back to the
// simpler chromatic spelling controlled by the sharps/flats preference.
export function createTransposer({ fromKey, semitones, useFlats }) {
  if (!fromKey) {
    return {
      transpose: (c) => transposeChord(c, semitones, useFlats),
      inverse: (c) => transposeChord(c, -semitones, useFlats),
      targetKey: null,
    };
  }
  const toKey = shiftKey(fromKey, semitones, useFlats);
  const { letterShift, semitoneShift } = intervalBetween(stripMinor(fromKey), stripMinor(toKey));
  const invLetterShift = (7 - letterShift) % 7;
  const invSemitoneShift = (12 - semitoneShift) % 12;
  return {
    transpose: (c) => transposeChordByInterval(c, letterShift, semitoneShift),
    inverse: (c) => transposeChordByInterval(c, invLetterShift, invSemitoneShift),
    targetKey: toKey,
  };
}

// Compute the semitone distance from an original key to a target key.
export function semitonesBetweenKeys(fromKey, toKey) {
  const from = noteToIndex(stripMinor(fromKey));
  const to = noteToIndex(stripMinor(toKey));
  if (from == null || to == null) return 0;
  return (((to - from) % 12) + 12) % 12;
}

function stripMinor(key) {
  if (!key) return key;
  return key.replace(/m$/, "");
}

// Given a starting key and a semitone offset, return the resulting key name,
// using the preferred spelling so we never land on an awkward enharmonic key.
export function shiftKey(key, semitones, useFlats) {
  if (!key) return key;
  const minor = /m$/.test(key);
  const idx = noteToIndex(stripMinor(key));
  if (idx == null) return key;
  return preferredKeyName(idx + semitones, minor, useFlats);
}
