import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initFirebase } from "./lib/firebase";

initFirebase().catch(console.error);

createRoot(document.getElementById("root")!).render(<App />);
