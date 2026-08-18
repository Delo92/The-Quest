import { useState, useRef, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function hexToHsv(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 1, 1];
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

interface ColorWheelPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export default function ColorWheelPicker({ value, onChange }: ColorWheelPickerProps) {
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(value));
  const [hexInput, setHexInput] = useState(value);
  const svCanvasRef = useRef<HTMLCanvasElement>(null);
  const hueCanvasRef = useRef<HTMLCanvasElement>(null);
  const svDragging = useRef(false);
  const hueDragging = useRef(false);

  const SV_SIZE = 180;
  const HUE_HEIGHT = 16;

  useEffect(() => {
    const newHsv = hexToHsv(value);
    setHsv(newHsv);
    setHexInput(value);
  }, [value]);

  const drawSvCanvas = useCallback((hue: number) => {
    const canvas = svCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        const s = x / w;
        const v = 1 - y / h;
        const hex = hsvToHex(hue, s, v);
        ctx.fillStyle = hex;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, []);

  const drawHueCanvas = useCallback(() => {
    const canvas = hueCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 360; i += 30) {
      gradient.addColorStop(i / 360, hsvToHex(i, 1, 1));
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, canvas.height);
  }, []);

  useEffect(() => {
    drawSvCanvas(hsv[0]);
    drawHueCanvas();
  }, [hsv[0], drawSvCanvas, drawHueCanvas]);

  const updateColor = useCallback((h: number, s: number, v: number) => {
    setHsv([h, s, v]);
    const hex = hsvToHex(h, s, v);
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  const handleSvInteraction = useCallback((e: React.MouseEvent | MouseEvent) => {
    const canvas = svCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    updateColor(hsv[0], x, 1 - y);
  }, [hsv, updateColor]);

  const handleHueInteraction = useCallback((e: React.MouseEvent | MouseEvent) => {
    const canvas = hueCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const hue = x * 360;
    updateColor(hue, hsv[1], hsv[2]);
    drawSvCanvas(hue);
  }, [hsv, updateColor, drawSvCanvas]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (svDragging.current) handleSvInteraction(e);
      if (hueDragging.current) handleHueInteraction(e);
    };
    const handleMouseUp = () => {
      svDragging.current = false;
      hueDragging.current = false;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleSvInteraction, handleHueInteraction]);

  const handleHexChange = (val: string) => {
    setHexInput(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      const [h, s, v] = hexToHsv(val);
      setHsv([h, s, v]);
      onChange(val.toUpperCase());
      drawSvCanvas(h);
    }
  };

  const presets = ["#FF5A09", "#E91E63", "#9C27B0", "#2196F3", "#00BCD4", "#4CAF50", "#FFEB3B", "#FF9800", "#F44336", "#FFFFFF"];

  return (
    <div className="space-y-3" data-testid="color-wheel-picker">
      <div className="flex flex-wrap gap-1.5">
        {presets.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => { onChange(c); setHsv(hexToHsv(c)); setHexInput(c); drawSvCanvas(hexToHsv(c)[0]); }}
            className="w-7 h-7 rounded-full border-2 transition-all"
            style={{ backgroundColor: c, borderColor: value.toUpperCase() === c ? "#fff" : "rgba(255,255,255,0.15)" }}
            data-testid={`button-preset-${c.replace('#', '')}`}
          />
        ))}
      </div>

      <div
        className="relative rounded-md overflow-hidden cursor-crosshair"
        style={{ width: SV_SIZE, height: SV_SIZE }}
      >
        <canvas
          ref={svCanvasRef}
          width={SV_SIZE}
          height={SV_SIZE}
          className="block"
          onMouseDown={(e) => { svDragging.current = true; handleSvInteraction(e); }}
          data-testid="canvas-saturation-brightness"
        />
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white pointer-events-none"
          style={{
            left: `${hsv[1] * 100}%`,
            top: `${(1 - hsv[2]) * 100}%`,
            transform: "translate(-50%, -50%)",
            boxShadow: "0 0 3px rgba(0,0,0,0.7)",
          }}
        />
      </div>

      <div className="relative rounded-full overflow-hidden cursor-pointer" style={{ width: SV_SIZE, height: HUE_HEIGHT }}>
        <canvas
          ref={hueCanvasRef}
          width={SV_SIZE}
          height={HUE_HEIGHT}
          className="block"
          onMouseDown={(e) => { hueDragging.current = true; handleHueInteraction(e); }}
          data-testid="canvas-hue-slider"
        />
        <div
          className="absolute top-0 w-3 rounded-full border-2 border-white pointer-events-none"
          style={{
            left: `${(hsv[0] / 360) * 100}%`,
            height: HUE_HEIGHT,
            transform: "translateX(-50%)",
            boxShadow: "0 0 3px rgba(0,0,0,0.7)",
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-md border border-white/20 flex-shrink-0"
          style={{ backgroundColor: value }}
        />
        <Input
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          placeholder="#FF5A09"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/20 font-mono text-sm"
          data-testid="input-hex-color"
        />
      </div>
    </div>
  );
}
