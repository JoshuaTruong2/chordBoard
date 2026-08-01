# Chord Transposer

Paste a chord sheet, change its key, and get it back with the chords re-aligned
over the lyrics - then download it as a PDF or export it to ChordPro.

Most of the app runs in your browser. You can paste a chord sheet, upload a
file, or **import a free Ultimate Guitar Chords URL** (via a small API route that
fetches the page server-side).

## Features

- **Paste or upload** a chord sheet (`.txt`, `.cho`, `.pro`, `.crd`), or type one.
- **Two input formats**, auto-detected:
  - Plain "chords over lyrics" text (the usual copy-from-a-site format).
  - ChordPro (`[G]Amazing [C]grace`) - unambiguous and whitespace-proof.
- **Transpose** by:
  - Half step / whole step up or down, or
  - Picking a target key directly.
- **Sharps or flats** spelling toggle.
- **Chords are highlighted** so you can confirm the parse at a glance. If a line
  is misdetected, click the **C**/**L** badge (on hover) to flip it between
  chord and lyric.
- **Alignment is preserved** through transposition: even when a chord name
  changes width (`C` -> `C#`), it stays over the correct syllable.
- **Download** the result as **PDF** or plain **`.txt`**.

## Getting the chord sheet in

1. **Ultimate Guitar link** — paste a free *Chords* tab URL and hit Import
   (Official/Pro tabs are not supported).
2. **Or paste** — copy the chord block from any site and paste it in.
3. **Or upload** a `.txt` / `.cho` / `.pro` / `.crd` file.

## Run it locally

Requires Node 18+.

```bash
npm install
npm run dev
```

Then open http://localhost:5173. Import works locally via the Vite `/api/import-ug` proxy.

For iPad on the same Wi‑Fi: `npm run dev -- --host`, then open the Network URL.

## Deploy on Vercel

The production Import endpoint is `api/import-ug.js` (same `{ url }` → `{ text, meta }` contract as local).

1. Put the project on GitHub (this folder is not a git repo yet — `git init` + push).
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
3. Leave defaults (Vite / `npm run build` / `dist`) and deploy.
4. Open the live URL → paste a UG Chords link → Import.

Or from this folder after logging in:

```bash
npx vercel
```

## How it works

1. **Parse** (`src/lib/parse.js`) - turns the pasted text into a line-based
   model. For plain text, each line is classified as a chord line or a lyric
   line using a heuristic (a line is a chord line if nearly all of its tokens
   look like chords). ChordPro brackets are parsed directly. Each chord records
   its column.
2. **Transpose** (`src/lib/transpose.js`, `src/lib/sheet.js`) - shifts each
   chord's root and bass note by N semitones, keeping the quality suffix
   (`m7`, `sus4`, ...). Chord lines are rebuilt from the recorded columns so
   alignment survives width changes.
3. **Render** (`src/components/ChordSheet.jsx`) - draws the chords (highlighted)
   in a monospace layout above the lyrics.
4. **Export** (`src/lib/download.js`) - captures the rendered sheet to PDF via
   `html2pdf.js`, or writes the transposed sheet as plain text.

## Notes

- Detection is a heuristic; the highlight + per-line toggle let you verify and
  fix any edge cases. ChordPro input avoids ambiguity entirely.
- For personal use with chord sheets you have the right to use.

## Project structure

```
api/
  import-ug.js            Vercel serverless UG import
server/
  ugExtract.js            fetch + extract UG chord text
  ugImportPlugin.js       Vite dev/preview /api/import-ug
vercel.json
src/
  components/SheetInput.jsx   UG URL import + paste
  lib/importUg.js             client → /api/import-ug
  ...
```
