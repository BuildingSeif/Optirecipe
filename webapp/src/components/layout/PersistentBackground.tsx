import { memo } from "react";

// Memoized background component - renders once, never re-renders
// Fixed position ensures it stays in place during navigation and scrolling
export const PersistentBackground = memo(function PersistentBackground() {
  return (
    <div className="fixed inset-0 z-0 bg-black">
      <div className="spline-container absolute top-0 left-0 w-full h-full -z-10">
        <iframe
          src="https://my.spline.design/nexbotrobotcharacterconcept-kLwr8f6hgKgaa5gmU6oB00Si"
          frameBorder="0"
          width="100%"
          height="100%"
          id="aura-spline"
          title="Background Animation"
          style={{
            pointerEvents: "none",
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            border: "none",
          }}
          loading="eager"
        />
      </div>
    </div>
  );
});
