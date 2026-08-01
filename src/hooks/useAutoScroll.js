import { useEffect, useRef } from "react";

/** Pixels of scroll still available below the current position. */
export function remainingScroll(el) {
  if (!el) return 0;
  return Math.max(0, el.scrollHeight - el.clientHeight - el.scrollTop);
}

// Smoothly scrolls the given element downward at `speed` pixels per second
// while `playing` is true. Uses requestAnimationFrame with delta-time so slow
// paces stay smooth, and accumulates fractional pixels between frames.
// Resuming always continues from the element's current scrollTop.
export function useAutoScroll(targetRef, { playing, speed, onReachEnd }) {
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const accRef = useRef(0);

  useEffect(() => {
    const el = targetRef.current;
    if (!el || !playing || speed <= 0) return;

    lastRef.current = performance.now();
    accRef.current = 0;

    const step = (now) => {
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;

      accRef.current += speed * dt;
      const whole = Math.trunc(accRef.current);
      if (whole !== 0) {
        accRef.current -= whole;
        el.scrollTop += whole;
      }

      // Stop once we can't scroll any further.
      if (remainingScroll(el) < 1) {
        onReachEnd?.();
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [targetRef, playing, speed, onReachEnd]);
}
