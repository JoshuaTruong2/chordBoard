import { useState } from "react";
import { keyOptions, shiftKey } from "../lib/transpose.js";

const MIN_OFFSET = -12;
const MAX_OFFSET = 12;
const clampOffset = (n) => Math.min(Math.max(n, MIN_OFFSET), MAX_OFFSET);

export default function TransposeControls({
  semitones,
  onSemitonesChange,
  originalKey,
  useFlats,
  onUseFlatsChange,
}) {
  const currentKey = originalKey ? shiftKey(originalKey, semitones, useFlats) : null;
  const keys = keyOptions(useFlats);
  const [draft, setDraft] = useState(null); // string while the offset field is focused

  function setByKey(targetKey) {
    if (!originalKey) return;
    // Find the smallest signed offset that maps original -> target.
    const raw = requireSemitonesBetween(originalKey, targetKey);
    onSemitonesChange(raw);
  }

  function commitOffsetDraft() {
    if (draft === null) return;
    const n = parseInt(draft, 10);
    if (!Number.isNaN(n)) onSemitonesChange(clampOffset(n));
    setDraft(null);
  }

  const offsetLabel = `${semitones > 0 ? "+" : ""}${semitones}`;

  return (
    <div className="panel controls-panel">
      <div className="controls-row">
        <div className="control-group">
          <span className="control-label">Transpose</span>
          <div className="stepper">
            <button className="btn" onClick={() => onSemitonesChange(semitones - 2)} title="Down a whole step">
              -1 step
            </button>
            <button className="btn" onClick={() => onSemitonesChange(semitones - 1)} title="Down a half step">
              -&frac12;
            </button>
            <input
              className="offset-pill"
              type="text"
              inputMode="numeric"
              value={draft ?? offsetLabel}
              title="Half-step offset — click and type a number (e.g. 4 or -3)"
              aria-label="Half-step offset"
              onFocus={(e) => {
                setDraft(String(semitones));
                e.target.select();
              }}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitOffsetDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setDraft(null);
                  e.currentTarget.blur();
                }
              }}
            />
            <button className="btn" onClick={() => onSemitonesChange(semitones + 1)} title="Up a half step">
              +&frac12;
            </button>
            <button className="btn" onClick={() => onSemitonesChange(semitones + 2)} title="Up a whole step">
              +1 step
            </button>
          </div>
          {semitones !== 0 && (
            <button className="btn ghost reset" onClick={() => onSemitonesChange(0)}>
              Reset
            </button>
          )}
        </div>

        <div className="control-group">
          <span className="control-label">Target key</span>
          <select
            className="key-select"
            value={currentKey && keys.includes(currentKey) ? currentKey : ""}
            onChange={(e) => setByKey(e.target.value)}
            disabled={!originalKey}
          >
            {!originalKey && <option value="">detect a chord first</option>}
            {originalKey &&
              keys.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
          </select>
        </div>

        <div className="control-group">
          <span className="control-label">Accidentals</span>
          <div className="toggle-group">
            <button
              className={`btn toggle ${!useFlats ? "active" : ""}`}
              onClick={() => onUseFlatsChange(false)}
            >
              Sharps #
            </button>
            <button
              className={`btn toggle ${useFlats ? "active" : ""}`}
              onClick={() => onUseFlatsChange(true)}
            >
              Flats ♭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Signed semitone distance in the range [-6, 6] that maps fromKey -> toKey.
function requireSemitonesBetween(fromKey, toKey) {
  const idx = (k) =>
    ({ C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 }[
      k.replace(/m$/, "")
    ]);
  const from = idx(fromKey);
  const to = idx(toKey);
  if (from == null || to == null) return 0;
  let d = (((to - from) % 12) + 12) % 12;
  if (d > 6) d -= 12;
  return d;
}
