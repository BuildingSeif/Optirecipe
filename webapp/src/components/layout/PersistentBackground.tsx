import { memo, useEffect } from "react";

// Memoized background component - renders once, never re-renders
// Uses Unicorn Studio aura background
export const PersistentBackground = memo(function PersistentBackground() {
  useEffect(() => {
    // Load Unicorn Studio script once
    const win = window as unknown as Record<string, Record<string, unknown>>;
    if (!win.UnicornStudio) {
      win.UnicornStudio = { isInitialized: false };
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.29/dist/unicornStudio.umd.js";
      script.onload = () => {
        const us = win.UnicornStudio;
        if (us && !us.isInitialized) {
          (us as unknown as { init: () => void }).init();
          us.isInitialized = true;
        }
      };
      (document.head || document.body).appendChild(script);
    }
  }, []);

  return (
    <div className="fixed inset-0 z-0 bg-black">
      <div
        data-us-project="yWZ2Tbe094Fsjgy9NRnD"
        className="absolute w-full h-full left-0 top-0"
        style={{ pointerEvents: "none" }}
      />
    </div>
  );
});
