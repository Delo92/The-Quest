import { Zap } from "lucide-react";

interface CBLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

export default function CBLogo({ size = "md", showText = false, className = "" }: CBLogoProps) {
  const sizes = {
    sm: { letters: "text-3xl", zap: "w-4 h-4", zapOffset: "-left-2", sub: "text-[8px]" },
    md: { letters: "text-5xl", zap: "w-6 h-6", zapOffset: "-left-3", sub: "text-[10px]" },
    lg: { letters: "text-7xl", zap: "w-9 h-9", zapOffset: "-left-4", sub: "text-sm" },
  };
  const s = sizes[size];

  return (
    <div className={`flex flex-col items-center leading-none select-none ${className}`}>
      <div className={`flex items-center font-black uppercase tracking-tight ${s.letters}`}>
        <span style={{
          background: "linear-gradient(180deg, #999 0%, #444 45%, #666 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          WebkitTextStroke: "1.5px rgba(255,255,255,0.2)",
          paintOrder: "stroke fill",
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.9))",
        }}>C</span>
        <span className="relative inline-flex items-center" style={{
          background: "linear-gradient(180deg, #86efac 0%, #22c55e 40%, #15803d 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          filter: "drop-shadow(0 2px 8px rgba(34,197,94,0.6)) drop-shadow(0 -1px 1px rgba(255,255,255,0.2))",
        }}>
          <Zap className={`absolute ${s.zapOffset} text-white fill-white ${s.zap}`} style={{ top: "50%", transform: "translateY(-50%)" }} />
          B
        </span>
      </div>
      {showText && (
        <span className={`text-white font-bold uppercase tracking-[0.2em] mt-1 ${s.sub}`}>Publishing</span>
      )}
    </div>
  );
}
