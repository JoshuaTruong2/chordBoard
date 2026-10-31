import { useRef, useState } from "react";
import FullscreenButton from "./FullscreenButton.jsx";
import AutoScrollBar from "./AutoScrollBar.jsx";
import { importFromChordUrl } from "../lib/importChords.js";

export default function SheetInput({
  value,
  onChange,
  isFullscreen,
  onToggleFullscreen,
  pace,
  onPaceChange,
}) {
  const fileRef = useRef(null);
  const textareaRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result || ""));
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleImportUrl(e) {
    e.preventDefault();
    const url = importUrl.trim();
    if (!url || importing) return;
    setImporting(true);
    setImportError("");
    try {
      const { text } = await importFromChordUrl(url);
      onChange(text);
    } catch (err) {
      setImportError(err?.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className={`panel input-panel ${isFullscreen ? "fullscreen" : ""}`}>
      <div className="panel-header">
        <h2>Add a song</h2>
        <div className="panel-actions">
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>
            Upload file
          </button>
          {value && (
            <button className="btn ghost" onClick={() => onChange("")}>
              Clear
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.cho,.pro,.crd,text/plain"
            onChange={handleFile}
            hidden
          />
        </div>
      </div>

      <div className="input-path">
        <span className="input-path-label">Chord site link</span>
        <form className="import-url-row" onSubmit={handleImportUrl}>
          <input
            type="url"
            className="import-url-input"
            placeholder="Ultimate Guitar or Kpopchords URL…"
            value={importUrl}
            onChange={(e) => {
              setImportUrl(e.target.value);
              if (importError) setImportError("");
            }}
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={importing}
            aria-label="Chord site URL"
          />
          <button className="btn" type="submit" disabled={importing || !importUrl.trim()}>
            {importing ? "Importing…" : "Import"}
          </button>
        </form>
        {importError && (
          <p className="import-error">
            {importError} You can paste the chord sheet below instead.
          </p>
        )}
      </div>

      <div className="input-path">
        <span className="input-path-label">Or paste the chord sheet</span>
        <textarea
          ref={textareaRef}
          className="sheet-textarea"
          placeholder={
            "If the link doesn’t work, copy the chords and paste them here.\n\nChords over lyrics, or ChordPro ([G]Amazing [C]grace), both work."
          }
          value={value}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>

      <p className="hint">
        Supports <strong>Ultimate Guitar</strong> (free Chords tabs) and <strong>Kpopchords</strong>.
        If import fails, paste the sheet manually — same result.
      </p>
      {value && (
        <AutoScrollBar
          targetRef={textareaRef}
          playing={playing}
          onPlayingChange={setPlaying}
          pace={pace}
          onPaceChange={onPaceChange}
        />
      )}
      <FullscreenButton isFullscreen={isFullscreen} onClick={onToggleFullscreen} />
    </div>
  );
}
