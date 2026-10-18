import { createRoot } from "react-dom/client";
import CBLogo from "@/components/cb-logo";
import "./index.css";

function LogoSourcePreview() {
  return (
    <main
      style={{
        width: 720,
        height: 180,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        background: "#0b0d0e",
      }}
    >
      <CBLogo size="sm" showText={false} />
      <span className="font-serif text-xl font-bold text-white">The Quest</span>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Logo preview root element is missing");
createRoot(root).render(<LogoSourcePreview />);
