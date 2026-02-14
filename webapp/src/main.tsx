import { createRoot } from "react-dom/client";
import App from "./App.js";
import "./index.css";

// Build version stamp — changes on every build, used to detect stale cache
const BUILD_VERSION = __BUILD_TIMESTAMP__;
const STORED_VERSION_KEY = "optirecipe_build_version";

// If the stored version doesn't match, clear old caches and force reload once
const storedVersion = localStorage.getItem(STORED_VERSION_KEY);
if (storedVersion && storedVersion !== String(BUILD_VERSION)) {
  localStorage.setItem(STORED_VERSION_KEY, String(BUILD_VERSION));
  // Hard reload bypassing cache
  window.location.reload();
} else {
  localStorage.setItem(STORED_VERSION_KEY, String(BUILD_VERSION));
}

createRoot(document.getElementById("root")!).render(<App />);
