import { useEffect, useMemo, useRef, useState } from "react";
import SheetInput from "./components/SheetInput.jsx";
import TransposeControls from "./components/TransposeControls.jsx";
import ChordSheet from "./components/ChordSheet.jsx";
import { parseSheet } from "./lib/parse.js";
import { transposeSheet, layoutRow } from "./lib/sheet.js";
import { createTransposer, isChordToken } from "./lib/transpose.js";
import { downloadPdf, downloadText, sanitizeFilename } from "./lib/download.js";
import { useWakeLock } from "./hooks/useWakeLock.js";

const STORAGE_KEY = "chord-transposer:v1";

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      rawText: typeof data.rawText === "string" ? data.rawText : "",
      semitones: Number.isFinite(data.semitones) ? data.semitones : 0,
      useFlats: typeof data.useFlats === "boolean" ? data.useFlats : true,
      chordEdits: data.chordEdits && typeof data.chordEdits === "object" ? data.chordEdits : {},
      pace: Number.isFinite(data.pace) ? Math.min(Math.max(data.pace, 2.5), 62.5) : 40,
    };
  } catch {
    return null;
  }
}

export default function App() {
  const persisted = loadPersistedState();
  const [rawText, setRawText] = useState(persisted?.rawText ?? "");
  const [semitones, setSemitones] = useState(persisted?.semitones ?? 0);
  const [useFlats, setUseFlats] = useState(persisted?.useFlats ?? true);
  const [chordEdits, setChordEdits] = useState(persisted?.chordEdits ?? {});
  const [pace, setPace] = useState(persisted?.pace ?? 40);
  const [exporting, setExporting] = useState(false);
  const [fullscreen, setFullscreen] = useState(null); // null | "input" | "output"
  const sheetRef = useRef(null);

  // Keep the screen awake the whole time the app is open (e.g. while
  // performing from an iPad), not just during auto-scroll.
  useWakeLock(true);

  // Persist the sheet and transposition so a reload doesn't lose work.
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ rawText, semitones, useFlats, chordEdits, pace })
      );
    } catch {
      // Ignore storage failures (e.g. private mode or quota).
    }
  }, [rawText, semitones, useFlats, chordEdits, pace]);

  // Allow Escape to exit fullscreen, and lock body scroll while active.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setFullscreen(null);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [fullscreen]);

  const toggleFullscreen = (which) => setFullscreen((f) => (f === which ? null : which));

  // Base parse depends only on the raw text.
  const baseModel = useMemo(() => parseSheet(rawText), [rawText]);

  // Apply the user's per-chord manual corrections. Each edit is stored as a
  // base chord (at zero transposition) so it transposes along with the rest.
  const model = useMemo(() => {
    if (!Object.keys(chordEdits).length) return baseModel;
    return {
      meta: baseModel.meta,
      lines: baseModel.lines.map((line) => {
        if (line.kind !== "chord") return line;
        let changed = false;
        const tokens = line.tokens.map((t) => {
          const edit = chordEdits[`${line.id}:${t.col}`];
          if (!edit) return t;
          changed = true;
          return { ...t, text: edit.text, isChord: edit.isChord };
        });
        return changed ? { ...line, tokens } : line;
      }),
    };
  }, [baseModel, chordEdits]);

  // Detect the original key from the first chord in the sheet.
  const originalKey = useMemo(() => {
    for (const line of model.lines) {
      if (line.kind === "chord" && line.tokens.length) {
        const first = line.tokens.find((t) => t.isChord);
        if (first) {
          const m = first.text.match(/^([A-G][#b]?)(m(?!aj))?/);
          if (m) return m[1] + (m[2] ? "m" : "");
        }
      }
    }
    return null;
  }, [model]);

  // A key-aware transposer: spelling follows the resulting key, and `inverse`
  // maps an edited chord back to the source key for storage.
  const transposer = useMemo(
    () => createTransposer({ fromKey: originalKey, semitones, useFlats }),
    [originalKey, semitones, useFlats]
  );

  const currentKey = transposer.targetKey;

  function handleSetText(text) {
    setRawText(text);
    setChordEdits({});
    setSemitones(0);
  }

  // Save a manual chord correction. `newText` is what the user typed at the
  // current transposition; store it as a base chord so it keeps transposing.
  function handleEditChord(lineId, col, newText) {
    const key = `${lineId}:${col}`;
    const text = newText.trim();
    setChordEdits((prev) => {
      const next = { ...prev };
      if (text === "") {
        delete next[key];
      } else if (isChordToken(text)) {
        next[key] = { text: transposer.inverse(text), isChord: true };
      } else {
        next[key] = { text, isChord: false };
      }
      return next;
    });
  }

  function baseFilename() {
    const title = model.meta.title || "chord-sheet";
    const keyPart = currentKey ? ` (${currentKey})` : "";
    return sanitizeFilename(`${title}${keyPart}`);
  }

  async function handleDownloadPdf() {
    setExporting(true);
    // Let React re-render without the per-line toggles before capturing.
    await new Promise((r) => setTimeout(r, 60));
    try {
      await downloadPdf(sheetRef.current, `${baseFilename()}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  function handleDownloadText() {
    const transposed = transposeSheet(model, transposer.transpose);
    const text = transposed.lines
      .map((line) => {
        if (line.kind === "empty") return "";
        if (line.kind === "lyric") return line.raw;
        return layoutRow(line.tokens).text;
      })
      .join("\n");
    downloadText(`${baseFilename()}.txt`, text, "text/plain");
  }

  const hasContent = model.lines.some((l) => l.kind !== "empty");

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Chord Board</h1>
          <p className="tagline">Paste a UG link or chord sheet, change the key, download it. Play along with your favorite songs.</p>
        </div>
      </header>

      <TransposeControls
        semitones={semitones}
        onSemitonesChange={setSemitones}
        originalKey={originalKey}
        useFlats={useFlats}
        onUseFlatsChange={setUseFlats}
      />

      <div className="workspace">
        <SheetInput
          value={rawText}
          onChange={handleSetText}
          isFullscreen={fullscreen === "input"}
          onToggleFullscreen={() => toggleFullscreen("input")}
          pace={pace}
          onPaceChange={setPace}
        />

        <div className={`output-column ${fullscreen === "output" ? "fullscreen-col" : ""}`}>
          <ChordSheet
            ref={sheetRef}
            model={model}
            transposer={transposer}
            interactive={!exporting}
            onEditChord={handleEditChord}
            isFullscreen={fullscreen === "output"}
            onToggleFullscreen={() => toggleFullscreen("output")}
            pace={pace}
            onPaceChange={setPace}
          />
          {hasContent && (
            <p className="hint verify-hint">
              Chord lines are <span className="chord-sample">transposed &amp; highlighted</span>; other
              lines are shown exactly as typed. A chord looks wrong? Turn on{" "}
              <strong>Edit chords</strong> above, then click any chord to fix it.
            </p>
          )}
          {hasContent && (
            <div className="export-bar">
              <button className="btn" onClick={handleDownloadPdf} disabled={exporting}>
                {exporting ? "Preparing PDF..." : "Download PDF"}
              </button>
              <button className="btn" onClick={handleDownloadText}>
                Download .txt
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
