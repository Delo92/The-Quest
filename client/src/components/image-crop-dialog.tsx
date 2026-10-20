import { useRef } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { DEFAULT_TALENT_IMAGE_CROP_POSITION } from "@shared/image-crop";

export interface ImageCropPosition {
  x: number;
  y: number;
}

interface ImageCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt: string;
  position: ImageCropPosition;
  onPositionChange: (position: ImageCropPosition) => void;
  onSave: () => void;
  isSaving: boolean;
  title?: string;
  description?: string;
  secondaryPreviewLabel?: string;
}

export default function ImageCropDialog({
  open,
  onOpenChange,
  src,
  alt,
  position,
  onPositionChange,
  onSave,
  isSaving,
  title = "Adjust public image framing",
  description = "Drag the photo or use the controls to adjust its public framing.",
  secondaryPreviewLabel = "Profile gallery",
}: ImageCropDialogProps) {
  const dragStart = useRef<{ x: number; y: number; position: ImageCropPosition } | null>(null);
  const objectPosition = `${position.x}% ${position.y}%`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto border-white/15 bg-zinc-950 text-white sm:w-full">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-white/55">{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-start">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-white/55">Competition card</p>
            <div
              className="relative aspect-[4/5] touch-none cursor-move overflow-hidden rounded-xl bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
              role="application"
              aria-label="Drag the image to adjust its public framing"
              tabIndex={0}
              data-testid="image-crop-preview-card"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                dragStart.current = {
                  x: event.clientX,
                  y: event.clientY,
                  position: { ...position },
                };
              }}
              onPointerMove={(event) => {
                if (!dragStart.current) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                onPositionChange({
                  x: Math.max(0, Math.min(100, dragStart.current.position.x - ((event.clientX - dragStart.current.x) / bounds.width) * 100)),
                  y: Math.max(0, Math.min(100, dragStart.current.position.y - ((event.clientY - dragStart.current.y) / bounds.height) * 100)),
                });
              }}
              onPointerUp={() => { dragStart.current = null; }}
              onPointerCancel={() => { dragStart.current = null; }}
              onKeyDown={(event) => {
                const step = event.shiftKey ? 10 : 2;
                if (event.key === "ArrowLeft") onPositionChange({ ...position, x: Math.max(0, position.x - step) });
                else if (event.key === "ArrowRight") onPositionChange({ ...position, x: Math.min(100, position.x + step) });
                else if (event.key === "ArrowUp") onPositionChange({ ...position, y: Math.max(0, position.y - step) });
                else if (event.key === "ArrowDown") onPositionChange({ ...position, y: Math.min(100, position.y + step) });
              }}
            >
              <img src={src} alt={alt} draggable={false} className="h-full w-full select-none object-cover" style={{ objectPosition }} />
              <span className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/45 to-transparent pb-2 text-xs text-white/90">
                Drag to reposition
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-white/55">{secondaryPreviewLabel}</p>
            <div className="aspect-square overflow-hidden rounded-md bg-black" data-testid="image-crop-preview-gallery">
              <img src={src} alt="" className="h-full w-full object-cover" style={{ objectPosition }} />
            </div>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-white/75">
            <span className="flex justify-between"><span>Left / right</span><span>{Math.round(position.x)}%</span></span>
            <Slider
              aria-label="Adjust image left and right"
              value={[position.x]}
              min={0}
              max={100}
              step={1}
              onValueChange={([x]) => onPositionChange({ ...position, x })}
              data-testid="slider-image-crop-x"
            />
          </label>
          <label className="space-y-2 text-sm text-white/75">
            <span className="flex justify-between"><span>Up / down</span><span>{Math.round(position.y)}%</span></span>
            <Slider
              aria-label="Adjust image up and down"
              value={[position.y]}
              min={0}
              max={100}
              step={1}
              onValueChange={([y]) => onPositionChange({ ...position, y })}
              data-testid="slider-image-crop-y"
            />
          </label>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="min-h-10 justify-center text-white/70 hover:bg-white/10 hover:text-white sm:mr-auto"
            onClick={() => onPositionChange({ ...DEFAULT_TALENT_IMAGE_CROP_POSITION })}
            data-testid="button-reset-image-crop"
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Reset
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="ghost" className="min-h-10 text-white/65" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-10 bg-orange-500 text-white hover:bg-orange-400"
              onClick={onSave}
              disabled={isSaving}
              data-testid="button-save-image-crop"
            >
              {isSaving ? "Saving…" : "Save framing"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
