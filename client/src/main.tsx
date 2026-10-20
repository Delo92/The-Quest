import { createRoot } from "react-dom/client";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getAuthToken } from "./hooks/use-auth";
import App from "./App";
import "./index.css";
import { initFirebase } from "./lib/firebase";

setAuthTokenGetter(getAuthToken);
initFirebase().catch(console.error);

createRoot(document.getElementById("root")!).render(<App />);
