import { useCallback, useEffect, useState } from "react";
import { remainingScroll, useAutoScroll } from "../hooks/useAutoScroll.js";

// The scroll engine works in pixels/second, but the UI presents a friendlier
// 1..25 "pace" scale stepping by 1. Each level is worth PX_PER_LEVEL px/sec.
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 25;
export const PX_PER_LEVEL = 2.5;

export const MIN_PACE = MIN_LEVEL * PX_PER_LEVEL;
export const MAX_PACE = MAX_LEVEL * PX_PER_LEVEL;

const clampLevel = (n) => Math.min(Math.max(Math.round(n), MIN_LEVEL), MAX_LEVEL);
const speedToLevel = (px) => clampLevel(px / PX_PER_LEVEL);
const levelToSpeed = (level) => clampLevel(level) * PX_PER_LEVEL;

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M7 4.5v15l12-7.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <rect x="6" y="4.5" width="4.5" height="15" rx="1" />
      <rect x="13.5" y="4.5" width="4.5" height="15" rx="1" />
    </svg>
  );
}

export default function AutoScrollBar({ targetRef, playing, onPlayingChange, pace, onPaceChange }) {
  const stop = useCallback(() => onPlayingChange(false), [onPlayingChange]);

  useAutoScroll(targetRef, { playing, speed: pace, onReachEnd: stop });

  const level = speedToLevel(pace);
  const [draft, setDraft] = useState(null); // string while the field is focused

  const commitDraft = () => {
    if (draft === null) return;
    const n = parseInt(draft, 10);
    if (!Number.isNaN(n)) onPaceChange(levelToSpeed(n));
    setDraft(null);
  };

  const toggle = useCallback(() => {
    if (!playing) {
      const el = targetRef.current;
      // Resume from wherever the user is. Only jump to the top when there's
      // nowhere left to scroll (already at the bottom).
      if (el && remainingScroll(el) < 1) {
        el.scrollTop = 0;
      }
    }
    onPlayingChange(!playing);
  }, [playing, targetRef, onPlayingChange]);

  // Pause automatically when the user grabs or scrolls the sheet themselves,
  // so manual interaction doesn't fight the animation.
  useEffect(() => {
    const el = targetRef.current;
    if (!el || !playing) return;
    const pause = () => onPlayingChange(false);
    const opts = { passive: true };
    el.addEventListener("wheel", pause, opts);
    el.addEventListener("touchstart", pause, opts);
    el.addEventListener("mousedown", pause, opts);
    el.addEventListener("keydown", pause);
    return () => {
      el.removeEventListener("wheel", pause, opts);
      el.removeEventListener("touchstart", pause, opts);
      el.removeEventListener("mousedown", pause, opts);
      el.removeEventListener("keydown", pause);
    };
  }, [targetRef, playing, onPlayingChange]);

  return (
    <div className="autoscroll-bar">
      <button
        type="button"
        className={`btn autoscroll-toggle ${playing ? "is-playing" : ""}`}
        onClick={toggle}
        aria-pressed={playing}
        aria-label={playing ? "Pause auto-scroll" : "Start auto-scroll"}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <div className="autoscroll-pace">
        <span className="autoscroll-label">Pace</span>
        <div className="pace-stepper">
          <button
            type="button"
            className="btn pace-step"
            onClick={() => onPaceChange(levelToSpeed(level - 1))}
            disabled={level <= MIN_LEVEL}
            aria-label="Slower"
          >
            −
          </button>
          <input
            type="number"
            className="autoscroll-value"
            min={MIN_LEVEL}
            max={MAX_LEVEL}
            step={1}
            value={draft ?? level}
            aria-label="Auto-scroll pace level (1-25)"
            onFocus={(e) => {
              setDraft(String(level));
              e.target.select();
            }}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
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
          <button
            type="button"
            className="btn pace-step"
            onClick={() => onPaceChange(levelToSpeed(level + 1))}
            disabled={level >= MAX_LEVEL}
            aria-label="Faster"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
