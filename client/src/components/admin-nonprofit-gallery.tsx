import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ImagePlus, Link2, LoaderCircle, Trash2, Upload, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ensureVideoLoop } from "@/lib/media-utils";

type GalleryItem = {
  id: string;
  title: string;
  caption: string | null;
  organizationName: string | null;
  mediaUrl: string;
  mediaType: "image" | "video";
  embedUrl: string | null;
  createdAt: string;
};

const MAX_GALLERY_UPLOAD_BYTES = 35 * 1024 * 1024;

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return typeof body.message === "string" ? body.message : "The upload could not be completed.";
  } catch {
    return "The upload could not be completed.";
  }
}

export default function AdminNonprofitGallery() {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data: items, isLoading, isError, refetch } = useQuery<GalleryItem[]>({
    queryKey: ["/api/nonprofits/gallery"],
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Add a title for this gallery item.");
      if (!file && !videoUrl.trim()) throw new Error("Choose an image or video file, or add a Vimeo or YouTube link.");
      if (file && file.size > MAX_GALLERY_UPLOAD_BYTES) throw new Error("Files must be 35 MB or smaller.");

      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("caption", caption.trim());
      formData.append("organizationName", organizationName.trim());
      if (file) formData.append("image", file);
      if (!file && videoUrl.trim()) formData.append("videoUrl", videoUrl.trim());

      const token = getAuthToken();
      const response = await fetch("/api/admin/nonprofits/gallery", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!response.ok) throw new Error(await readError(response));
      return response.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/nonprofits/gallery"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/livery"] }),
      ]);
      setTitle("");
      setCaption("");
      setOrganizationName("");
      setVideoUrl("");
      setFile(null);
      const fileInput = document.querySelector<HTMLInputElement>('[data-testid="input-nonprofit-gallery-file"]');
      if (fileInput) fileInput.value = "";
      toast({ title: "Added to the community gallery", description: "This item is now visible on the nonprofit page." });
    },
    onError: (error: Error) => {
      toast({ title: "Gallery upload failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/nonprofits/gallery/${encodeURIComponent(id)}`);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/nonprofits/gallery"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/livery"] }),
      ]);
      toast({ title: "Gallery item removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Could not remove gallery item", description: error.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  return (
    <section className="mb-8 rounded-xl border border-white/10 bg-zinc-950/70 p-4 sm:p-6" aria-labelledby="admin-nonprofit-gallery-title">
      <div className="mb-5 flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-300/80">The Quest · Nonprofits</p>
          <h2 id="admin-nonprofit-gallery-title" className="mt-1 text-lg font-semibold text-white">Community gallery</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/50">
            Add approved photos and footage to the public nonprofit page. Uploaded items appear there as soon as they finish processing. Files are limited to 35 MB; use a Vimeo or YouTube link for longer videos.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/50 sm:self-auto">
          <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" /> Public media
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nonprofit-gallery-title" className="text-xs text-white/65">Title</Label>
              <Input
                id="nonprofit-gallery-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                placeholder="A short description of the moment"
                className="border-white/15 bg-white/[0.06] text-white placeholder:text-white/30"
                data-testid="input-nonprofit-gallery-title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nonprofit-gallery-organization" className="text-xs text-white/65">Organization (optional)</Label>
              <Input
                id="nonprofit-gallery-organization"
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
                maxLength={180}
                placeholder="Organization name"
                className="border-white/15 bg-white/[0.06] text-white placeholder:text-white/30"
                data-testid="input-nonprofit-gallery-organization"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nonprofit-gallery-caption" className="text-xs text-white/65">Caption (optional)</Label>
            <Textarea
              id="nonprofit-gallery-caption"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              maxLength={600}
              rows={3}
              placeholder="Add context for visitors"
              className="resize-y border-white/15 bg-white/[0.06] text-white placeholder:text-white/30"
              data-testid="textarea-nonprofit-gallery-caption"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nonprofit-gallery-file" className="text-xs text-white/65">Upload an image or video</Label>
            <Input
              id="nonprofit-gallery-file"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                setFile(nextFile);
                if (nextFile) setVideoUrl("");
              }}
              className="min-h-11 cursor-pointer border-white/15 bg-white/[0.06] text-xs text-white file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
              data-testid="input-nonprofit-gallery-file"
            />
            {file && (
              <p className="break-all text-[10px] text-white/45" data-testid="text-nonprofit-gallery-file">
                {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-white/35" aria-hidden="true">
            <span className="h-px flex-1 bg-white/10" /> OR <span className="h-px flex-1 bg-white/10" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nonprofit-gallery-video-url" className="flex items-center gap-2 text-xs text-white/65">
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" /> Vimeo or YouTube video link
            </Label>
            <Input
              id="nonprofit-gallery-video-url"
              type="url"
              value={videoUrl}
              onChange={(event) => {
                setVideoUrl(event.target.value);
                if (event.target.value) setFile(null);
              }}
              placeholder="https://vimeo.com/…"
              className="border-white/15 bg-white/[0.06] text-white placeholder:text-white/30"
              data-testid="input-nonprofit-gallery-video-url"
            />
          </div>

          <Button
            type="button"
            onClick={() => uploadMutation.mutate()}
            disabled={uploadMutation.isPending || !title.trim() || (!file && !videoUrl.trim())}
            className="min-h-11 w-full rounded-full bg-orange-500 px-5 font-semibold text-white hover:bg-orange-400"
            data-testid="button-upload-nonprofit-gallery"
          >
            {uploadMutation.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {uploadMutation.isPending ? "Adding media…" : "Add to gallery"}
          </Button>
        </div>
      </div>

      <div className="mt-8 border-t border-white/10 pt-5">
        <div className="mb-3 flex items-center gap-2">
          <Video className="h-4 w-4 text-orange-300" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-white">Published gallery items</h3>
          <span className="text-xs text-white/35">{items?.length ?? 0}</span>
        </div>

        {isLoading ? (
          <p className="py-6 text-sm text-white/45" role="status">Loading gallery items…</p>
        ) : isError ? (
          <div className="flex flex-wrap items-center gap-3 py-5 text-sm text-white/55" role="alert">
            <span>Gallery items could not be loaded.</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void refetch()} data-testid="button-retry-admin-nonprofit-gallery">
              Try again
            </Button>
          </div>
        ) : !items?.length ? (
          <p className="py-6 text-sm text-white/40">No media has been added yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-lg border border-white/10 bg-black/30" data-testid={`admin-gallery-item-${item.id}`}>
                <div className="aspect-[16/9] bg-black">
                  {item.embedUrl ? (
                    <iframe
                      src={ensureVideoLoop(item.embedUrl)}
                      title={item.title}
                      className="h-full w-full"
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : item.mediaType === "video" ? (
                    <video src={item.mediaUrl} className="h-full w-full object-cover" controls loop preload="metadata" playsInline />
                  ) : (
                    <img src={item.mediaUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
                  )}
                </div>
                <div className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-medium text-white">{item.title}</h4>
                    {item.organizationName && <p className="mt-1 truncate text-[10px] uppercase tracking-wider text-orange-200/70">{item.organizationName}</p>}
                    {item.caption && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/45">{item.caption}</p>}
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${item.title} from the nonprofit gallery`}
                    onClick={() => {
                      if (window.confirm(`Remove “${item.title}” from the public gallery?`)) deleteMutation.mutate(item.id);
                    }}
                    disabled={deleteMutation.isPending}
                    className="h-9 w-9 shrink-0 rounded-full text-red-300 hover:bg-red-500/10 hover:text-red-200"
                    data-testid={`button-delete-nonprofit-gallery-${item.id}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
