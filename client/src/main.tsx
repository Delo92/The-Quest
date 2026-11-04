import { createRoot } from "react-dom/client";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getAuthToken } from "./hooks/use-auth";
import App from "./App";
import "./index.css";
import { initFirebase } from "./lib/firebase";
import { reloadForNewBuild } from "./lib/stale-build-recovery";

// After a deploy, an open tab still points at bundles that no longer exist.
// Reload once to pick up the current build instead of showing an error page.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadForNewBuild()) event.preventDefault();
});

setAuthTokenGetter(getAuthToken);
initFirebase().catch(console.error);

createRoot(document.getElementById("root")!).render(<App />);
