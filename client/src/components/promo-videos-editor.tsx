import { useRef, useState } from "react";
import { Film, Link2, Loader2, Play, Plus, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import * as tus from "tus-js-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import { ensureVideoLoop } from "@/lib/media-utils";

const MAX_VIDEOS = 3;

interface PromoVideosEditorProps {
  competitionId: number;
  videos: string[];
  role?: "host" | "admin";
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function playerUrlFor(videoUri: string): Promise<string> {
  const videoId = videoUri.replace("/videos/", "");
  try {
    const response = await fetch(`/api/admin/vimeo/video/${videoId}/embed-url`, { headers: authHeaders() });
    if (response.ok) {
      const data = await response.json();
      if (data.playerEmbedUrl) return data.playerEmbedUrl;
    }
  } catch { /* fall back to the plain player URL */ }
  return `https://player.vimeo.com/video/${videoId}`;
}

export default function PromoVideosEditor({ competitionId, videos, role = "host" }: PromoVideosEditorProps) {
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState<null | "saving" | "uploading">(null);
  const [progress, setProgress] = useState(0);
  const full = videos.length >= MAX_VIDEOS;
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const thumbs = useQuery<{ thumbnails: (string | null)[] }>({
    queryKey: ["promo-thumbnails", competitionId, videos],
    queryFn: async () => {
      const response = await fetch(`/api/competitions/${competitionId}/promo-thumbnails`);
      if (!response.ok) throw new Error("Thumbnails unavailable");
      return response.json();
    },
    enabled: videos.length > 0,
    staleTime: 60_000,
  });

  const save = async (next: string[]) => {
    const response = await fetch(`/api/competitions/${competitionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ promoVideos: next }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || "Could not save the video.");
    }
    await queryClient.invalidateQueries({ queryKey: ["/api/host/competitions"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
    await queryClient.invalidateQueries({ queryKey: [`/api/competitions/${competitionId}`] });
  };

  const run = async (kind: "saving" | "uploading", task: () => Promise<void>, success: string) => {
    setBusy(kind);
    try {
      await task();
      toast({ title: success });
    } catch (error) {
      toast({ title: "Promo video not saved", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(null);
      setProgress(0);
    }
  };

  const addLink = () => {
    const value = link.trim();
    if (!value) return;
    void run("saving", async () => { await save([...videos, value]); setLink(""); }, "Promo video added");
  };

  const upload = (file: File) => {
    void run("uploading", async () => {
      const ticketResponse = await fetch(`/api/${role}/competitions/${competitionId}/cover-vimeo-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ fileSize: file.size }),
      });
      if (!ticketResponse.ok) throw new Error("Could not start the upload.");
      const ticket = await ticketResponse.json();
      await new Promise<void>((resolve, reject) => {
        new tus.Upload(file, {
          uploadUrl: ticket.uploadLink,
          onProgress: (sent, total) => setProgress(Math.round((sent / total) * 100)),
          onError: (error) => reject(new Error(error.message || "Upload failed")),
          onSuccess: () => resolve(),
        }).start();
      });
      if (ticket.completeUri) {
        try { await fetch(`https://api.vimeo.com${ticket.completeUri}`, { method: "DELETE" }); } catch { /* optional */ }
      }
      await save([...videos, await playerUrlFor(ticket.videoUri)]);
    }, "Promo video uploaded");
  };

  return (
    <div className="space-y-3" data-testid={`promo-videos-editor-${competitionId}`}>
      <div>
        <Label className="text-xs text-white/70">Promo videos ({videos.length}/{MAX_VIDEOS})</Label>
        <p className="mt-1 text-xs text-white/60">Shown at the top of your competition page, above the description.</p>
      </div>
      {videos.length > 0 && (
        <ul className="space-y-2">
          {videos.map((url, index) => (
            <li key={url} className="flex items-center gap-3 rounded-md border border-white/10 bg-black/25 p-2">
              <button
                type="button"
                onClick={() => setPreviewIndex(index)}
                className="group relative aspect-video w-28 shrink-0 overflow-hidden rounded bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
                aria-label={`Preview promo video ${index + 1}`}
              >
                {thumbs.data?.thumbnails[index] ? (
                  <img src={thumbs.data.thumbnails[index]!} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Film className="mx-auto h-5 w-5 text-white/40" aria-hidden="true" />
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/35 group-hover:bg-black/50">
                  <Play className="h-5 w-5 fill-white text-white" aria-hidden="true" />
                </span>
              </button>
              <span className="min-w-0 flex-1 text-sm font-medium text-white">Promo video {index + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0 text-white/60 hover:bg-red-400/10 hover:text-red-300"
                aria-label={`Remove promo video ${index + 1}`}
                disabled={busy !== null}
                onClick={() => void run("saving", () => save(videos.filter((value) => value !== url)), "Promo video removed")}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {full ? (
        <p className="text-xs text-white/60">Remove a video to add another.</p>
      ) : (
        <div className="space-y-3">
          <input
            ref={fileInput}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload(file);
              event.target.value = "";
            }}
            data-testid={`promo-video-file-${competitionId}`}
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full gap-2 border-white/20 text-white sm:w-auto"
            disabled={busy !== null}
            onClick={() => fileInput.current?.click()}
          >
            {busy === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
            {busy === "uploading" ? `Uploading ${progress}%` : "Upload a video"}
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" aria-hidden="true" />
              <Input
                value={link}
                onChange={(event) => setLink(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addLink(); } }}
                placeholder="Or paste a video link"
                aria-label="Video link"
                inputMode="url"
                className="min-h-11 pl-9"
                disabled={busy !== null}
              />
            </div>
            <Button type="button" className="min-h-11" disabled={!link.trim() || busy !== null} onClick={addLink}>
              {busy === "saving" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Add"}
            </Button>
          </div>
        </div>
      )}
      <Dialog open={previewIndex !== null} onOpenChange={(open) => { if (!open) setPreviewIndex(null); }}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-3xl border-white/10 bg-[#161616] p-3 text-white sm:p-4">
          <DialogHeader>
            <DialogTitle>Promo video {previewIndex !== null ? previewIndex + 1 : ""}</DialogTitle>
          </DialogHeader>
          {previewIndex !== null && videos[previewIndex] && (
            <div className="aspect-video w-full overflow-hidden rounded bg-black">
              {/\.(mp4|webm|mov|m4v)(\?|$)/i.test(videos[previewIndex]) ? (
                <video src={videos[previewIndex]} controls loop playsInline className="h-full w-full" />
              ) : (
                <iframe src={ensureVideoLoop(videos[previewIndex])} title={`Promo video ${previewIndex + 1}`} allow="fullscreen; picture-in-picture" allowFullScreen className="h-full w-full border-0" />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
