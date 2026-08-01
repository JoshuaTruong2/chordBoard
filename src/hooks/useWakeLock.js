import { useEffect } from "react";

// Keeps the screen awake while `active` is true (e.g. during auto-scroll so an
// iPad doesn't sleep mid-song). Safely no-ops where the API is unsupported and
// re-acquires the lock when the tab becomes visible again, since browsers
// release it automatically on tab/window blur.
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;

    let sentinel = null;
    let released = false;

    const request = async () => {
      try {
        sentinel = await navigator.wakeLock.request("screen");
      } catch {
        // Ignore: unsupported, denied, or not allowed in this context.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !released) request();
    };

    request();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibility);
      sentinel?.release().catch(() => {});
    };
  }, [active]);
}
