import { forwardRef, useCallback, useRef, useState } from "react";
import { transposeTokens, layoutRow } from "../lib/sheet.js";
import FullscreenButton from "./FullscreenButton.jsx";
import AutoScrollBar from "./AutoScrollBar.jsx";

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ChordLine({ line, transpose, editing, onEditChord }) {
  const [editCol, setEditCol] = useState(null);
  const [draft, setDraft] = useState("");

  const transposed = transposeTokens(line.tokens, transpose);
  const { segments } = layoutRow(transposed);

  const startEdit = (seg) => {
    setEditCol(seg.col);
    setDraft(seg.text);
  };

  const commit = () => {
    if (editCol != null) onEditChord?.(editCol, draft);
    setEditCol(null);
  };

  return (
    <pre className="line chord-line">
      {segments.map((seg, i) => {
        if (seg.type === "space") {
          return <span key={i}>{seg.text}</span>;
        }
        const isChordSeg = seg.type === "chord";

        if (editing && editCol === seg.col) {
          return (
            <input
              key={i}
              className="chord-edit-input"
              value={draft}
              autoFocus
              size={Math.max(draft.length, 1)}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setEditCol(null);
                }
              }}
            />
          );
        }

        if (editing) {
          return (
            <span
              key={i}
              className={`${isChordSeg ? "chord " : ""}editable-token`}
              role="button"
              tabIndex={0}
              title="Click to edit"
              onClick={() => startEdit(seg)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  startEdit(seg);
                }
              }}
            >
              {seg.text}
            </span>
          );
        }

        return isChordSeg ? (
          <span key={i} className="chord">
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        );
      })}
    </pre>
  );
}

const ChordSheet = forwardRef(function ChordSheet(
  {
    model,
    transposer,
    interactive = true,
    onEditChord,
    isFullscreen,
    onToggleFullscreen,
    pace,
    onPaceChange,
  },
  ref
) {
  const { meta, lines } = model;
  const hasContent = lines.some((l) => l.kind !== "empty");
  const [playing, setPlaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const scrollRef = useRef(null);

  // Keep a local scroll ref for auto-scroll, and forward the same node to the
  // parent (used for PDF capture).
  const setSheetRef = useCallback(
    (node) => {
      scrollRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  const editMode = editing && interactive;

  return (
    <div className={`panel output-panel ${isFullscreen ? "fullscreen" : ""} ${editMode ? "editing" : ""}`}>
      <div className="panel-header">
        <h2>Transposed sheet</h2>
        {hasContent && interactive && (
          <div className="panel-actions">
            <button
              className={`btn toggle icon-btn ${editing ? "active" : ""}`}
              onClick={() => setEditing((v) => !v)}
              aria-pressed={editing}
              aria-label={editing ? "Done editing chords" : "Edit chords"}
              title={editing ? "Done editing" : "Edit chords — click a chord to correct it"}
            >
              {editing ? <CheckIcon /> : <PencilIcon />}
            </button>
          </div>
        )}
      </div>

      {!hasContent ? (
        <div className="empty-state">
          <p>Paste a chord sheet on the left to see it here.</p>
        </div>
      ) : (
        <div className={`sheet ${interactive ? "sheet-scroll" : ""}`} ref={setSheetRef}>
          {(meta.title || meta.artist) && (
            <div className="sheet-meta">
              {meta.title && <div className="sheet-title">{meta.title}</div>}
              {meta.artist && <div className="sheet-artist">{meta.artist}</div>}
            </div>
          )}

          {lines.map((line) => {
            if (line.kind === "empty") {
              return <div key={line.id} className="line empty-line" />;
            }
            const isChord = line.kind === "chord";
            return (
              <div key={line.id} className={`sheet-line ${isChord ? "is-chord" : "is-lyric"}`}>
                {isChord ? (
                  <ChordLine
                    line={line}
                    transpose={transposer.transpose}
                    editing={editMode}
                    onEditChord={(col, text) => onEditChord?.(line.id, col, text)}
                  />
                ) : (
                  <pre className="line lyric-line">{line.raw || " "}</pre>
                )}
              </div>
            );
          })}
        </div>
      )}
      {hasContent && interactive && (
        <AutoScrollBar
          targetRef={scrollRef}
          playing={playing}
          onPlayingChange={setPlaying}
          pace={pace}
          onPaceChange={onPaceChange}
        />
      )}
      <FullscreenButton isFullscreen={isFullscreen} onClick={onToggleFullscreen} />
    </div>
  );
});

export default ChordSheet;
