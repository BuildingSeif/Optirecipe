import { memo } from "react";

// Memoized background component - never re-renders
export const PersistentBackground = memo(function PersistentBackground() {
  return (
    <div className="fixed inset-0 z-0 bg-black">
      {/* Static gradient fallback - shows immediately */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#091525]" />

      {/* Animated gradient orbs as CSS fallback */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-accent/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
      </div>

      {/* Spline 3D Background - loads on top */}
      <iframe
        src="https://my.spline.design/celestialflowabstractdigitalform-ObUlVgj70g2y4bbx5vBKSfxN/"
        frameBorder="0"
        width="100%"
        height="100%"
        id="persistent-spline-bg"
        title="Background Animation"
        style={{
          pointerEvents: "none",
          position: "absolute",
          inset: 0,
        }}
        loading="lazy"
      />
    </div>
  );
});
