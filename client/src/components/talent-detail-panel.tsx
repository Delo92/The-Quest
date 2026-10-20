import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef, useMemo, useEffect } from "react";
import * as tus from "tus-js-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, Upload, Image, Trash2, Video, Play, Calendar, UserCheck, Phone, Check, X as XIcon } from "lucide-react";
import AdminAccountAccess from "@/components/admin-account-access";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAuthToken } from "@/hooks/use-auth";
import type { Competition } from "@shared/schema";

export type TalentDetailScope = "admin" | "host";

interface TalentUser {
  id: number;
  userId: string;
  displayName: string;
  stageName: string | null;
  bio: string | null;
  category: string | null;
  imageUrls: string[] | null;
  role: string;
}

interface EntryRow {
  contestantId: number;
  competitionId: number;
  competitionTitle: string;
  competitionStatus: string | null;
  applicationStatus: string;
}

function HostEntryActions({ entries, profileId }: { entries: EntryRow[]; profileId: number }) {
  const { toast } = useToast();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/host/users", profileId, "detail"] });
    queryClient.invalidateQueries({ queryKey: ["/api/host/contestants"] });
    queryClient.invalidateQueries({ queryKey: ["/api/host/competitions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/host/stats"] });
  };
  const onError = (error: Error) => toast({ title: "Could not update contestant", description: error.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/host/contestants/${id}/status`, { status });
    },
    onSuccess: () => { refresh(); toast({ title: "Entry updated" }); },
    onError,
  });
  const removeMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/admin/contestants/${id}`); },
    onSuccess: () => { refresh(); toast({ title: "Removed from your event", description: "Their account and personal page are unchanged." }); },
    onError,
  });
  const busy = statusMutation.isPending || removeMutation.isPending;
  return (
    <div className="rounded-md bg-white/5 border border-white/5 p-4" data-testid="host-entry-actions">
      <h3 className="text-xs uppercase tracking-widest text-orange-400 font-bold mb-3">Entry in your events</h3>
      {entries.length === 0 && <p className="text-xs text-white/40">No entries in your events.</p>}
      <div className="space-y-2">
        {entries.map((entry) => (
          <div key={entry.contestantId} className="flex flex-col gap-3 rounded-md bg-white/5 p-3 sm:flex-row sm:items-center sm:justify-between" data-testid={`host-entry-${entry.contestantId}`}>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{entry.competitionTitle}</p>
              <Badge className="mt-1 border-0 bg-white/10 text-white/70">{entry.applicationStatus}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {entry.applicationStatus !== "approved" && (
                <Button size="sm" className="min-h-10 bg-green-600 hover:bg-green-500 text-white" disabled={busy}
                  onClick={() => statusMutation.mutate({ id: entry.contestantId, status: "approved" })} data-testid={`button-host-approve-${entry.contestantId}`}>
                  <Check className="h-4 w-4 mr-1" /> Approve
                </Button>
              )}
              {entry.applicationStatus !== "rejected" && (
                <Button size="sm" variant="outline" className="min-h-10 border-white/15" disabled={busy}
                  onClick={() => statusMutation.mutate({ id: entry.contestantId, status: "rejected" })} data-testid={`button-host-reject-${entry.contestantId}`}>
                  <XIcon className="h-4 w-4 mr-1" /> Reject
                </Button>
              )}
              <Button size="sm" variant="outline" className="min-h-10 border-red-500/40 text-red-300" disabled={busy}
                onClick={() => {
                  if (window.confirm(`Remove this contestant from ${entry.competitionTitle}? Their account and personal page stay; only this event entry is deleted.`)) removeMutation.mutate(entry.contestantId);
                }} data-testid={`button-host-remove-${entry.contestantId}`}>
                <Trash2 className="h-4 w-4 mr-1" /> Remove from event
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface VotingStat {
  contestantId?: number;
  competitionId: number;
  competitionTitle: string;
  competitionStatus: string;
  applicationStatus: string;
  voteCount: number;
  totalVotes: number;
  votePercentage: number;
  rank: number | null;
  totalContestants: number;
}

interface DriveImage {
  id: string;
  name: string;
  imageUrl: string;
  thumbnailUrl: string;
}

interface VimeoVideo {
  uri: string;
  name: string;
  link: string;
  embedUrl: string;
  duration: number;
  thumbnail: string | null;
  competitionFolder: string | null;
}

interface UserDetailResponse {
  profile: TalentUser & { email: string | null; level: number; socialLinks: string | null; phone?: string | null; smsOptIn?: boolean };
  activeStats: VotingStat[];
  pastStats: VotingStat[];
  upcomingEvents: VotingStat[];
  entries?: EntryRow[];
  driveImages: DriveImage[];
  vimeoVideos: VimeoVideo[];
}


export default function TalentDetailModal({ profileId, competitions, scope = "admin" }: { profileId: number; competitions: Competition[] | undefined; scope?: TalentDetailScope }) {
  const isHost = scope === "host";
  const apiBase = `/api/${scope}/users`;
  const { toast } = useToast();
  const [assignCompId, setAssignCompId] = useState("");
  const [mediaCompetitionId, setMediaCompetitionId] = useState("none");
  const [mediaUploadType, setMediaUploadType] = useState<"image" | "video" | null>(null);
  const [mediaUploadProgress, setMediaUploadProgress] = useState(0);
  const [adminVideoTitle, setAdminVideoTitle] = useState("");
  const [playingVideoUri, setPlayingVideoUri] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery<UserDetailResponse>({
    queryKey: [apiBase, profileId, "detail"],
  });

  const { data: videosData, isLoading: videosLoading, refetch: refetchVideos } = useQuery<{ vimeoVideos: VimeoVideo[] }>({
    queryKey: [apiBase, profileId, "videos"],
    enabled: !!data, // only fetch after profile is loaded
    staleTime: 60_000,
  });

  const vimeoVideos = videosData?.vimeoVideos ?? [];
  const mediaCompetitions = useMemo(() => {
    const assigned = data ? [...data.activeStats, ...data.pastStats, ...data.upcomingEvents] : [];
    const assignedIds = new Set(assigned.map((stat) => stat.competitionId));
    const otherCompetitions = isHost ? [] : (competitions || [])
      .filter((competition) => !assignedIds.has(competition.id))
      .map((competition) => ({
        competitionId: competition.id,
        competitionTitle: competition.title,
        competitionStatus: competition.status,
        applicationStatus: "admin-selected",
      }));
    return [...assigned, ...otherCompetitions];
  }, [data, competitions]);

  useEffect(() => {
    if (mediaCompetitionId !== "none" && !mediaCompetitions.some((stat) => String(stat.competitionId) === mediaCompetitionId)) {
      setMediaCompetitionId("none");
    }
  }, [mediaCompetitionId, mediaCompetitions]);

  const assignMutation = useMutation({
    mutationFn: async ({ pId, competitionId }: { pId: number; competitionId: number }) => {
      await apiRequest("POST", `${apiBase}/${pId}/assign`, { competitionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBase, profileId, "detail"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contestants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setAssignCompId("");
      toast({ title: "Talent assigned to competition!" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const levelMutation = useMutation({
    mutationFn: async ({ userId, level }: { userId: string; level: number }) => {
      await apiRequest("PATCH", `${apiBase}/${userId}/level`, { level });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBase, profileId, "detail"] });
      queryClient.invalidateQueries({ queryKey: [apiBase] });
      toast({ title: "User level updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: async (fileId: string) => {
      await apiRequest("DELETE", `${apiBase}/${profileId}/images/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBase, profileId, "detail"] });
      toast({ title: "Photo removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const deleteVideoMutation = useMutation({
    mutationFn: async (videoUri: string) => {
      const videoId = videoUri.split("/").pop();
      await apiRequest("DELETE", `${apiBase}/${profileId}/videos/${videoId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBase, profileId, "videos"] });
      toast({ title: "Video removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const handleAdminImageUpload = async (file: File) => {
    setMediaUploadType("image");
    setMediaUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("image", file);
      if (mediaCompetitionId !== "none") formData.append("competitionId", mediaCompetitionId);
      const token = getAuthToken();
      const response = await fetch(`${apiBase}/${profileId}/images`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message || "Photo upload failed");
      }
      setMediaUploadProgress(100);
      queryClient.invalidateQueries({ queryKey: [apiBase, profileId, "detail"] });
      toast({ title: "Photo uploaded" });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setMediaUploadType(null);
      setMediaUploadProgress(0);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const handleAdminVideoUpload = async (file: File) => {
    const uploadCompetitionId = mediaCompetitionId !== "none" ? mediaCompetitionId : null;

    if (!uploadCompetitionId) {
      toast({ title: "Choose a competition", description: "Videos must be assigned to one of the user's competitions.", variant: "destructive" });
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }
    setMediaUploadType("video");
    setMediaUploadProgress(0);
    try {
      const token = getAuthToken();
      const ticketResponse = await fetch(`${apiBase}/${profileId}/videos/upload-ticket`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fileSize: file.size,
          competitionId: uploadCompetitionId,
          videoTitle: adminVideoTitle.trim(),
        }),
      });
      if (!ticketResponse.ok) {
        const error = await ticketResponse.json().catch(() => null);
        throw new Error(error?.message || "Failed to create video upload ticket");
      }
      const ticket = await ticketResponse.json();

      const uploadToVimeo = (uploadLink: string) => new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(file, {
          uploadUrl: uploadLink,
          onError: (error) => reject(new Error(error.message || "Video upload failed")),
          onProgress: (bytesUploaded, bytesTotal) => {
            setMediaUploadProgress(Math.round((bytesUploaded / bytesTotal) * 100));
          },
          onSuccess: () => resolve(),
        });
        upload.start();
      });

      await uploadToVimeo(ticket.uploadLink);

      const finalizeResponse = await fetch("/api/vimeo/finalize-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          videoUri: ticket.videoUri,
          competitionId: uploadCompetitionId,
          completeUri: ticket.completeUri || null,
          chronicTVCompleteUri: null,
          customFolderCompleteUri: null,
        }),
      });
      if (!finalizeResponse.ok) {
        const error = await finalizeResponse.json().catch(() => null);
        throw new Error(error?.message || "Video finalization failed");
      }

      let videoVisible = false;
      const videoId = String(ticket.videoUri || "").split("/").pop();
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const refreshed = await refetchVideos();
        videoVisible = !!refreshed.data?.vimeoVideos?.some((video) => {
          const listedId = String(video.uri || "").split("/").pop();
          return video.uri === ticket.videoUri || (!!videoId && listedId === videoId);
        });
        if (videoVisible || attempt === 7) break;
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      setAdminVideoTitle("");
      toast({
        title: videoVisible ? "Video uploaded" : "Video upload processing",
        description: videoVisible
          ? "One video was saved to the selected competition and is now visible."
          : "The upload completed, but Vimeo is still indexing it. It will appear in the Videos section when processing finishes.",
      });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setMediaUploadType(null);
      setMediaUploadProgress(0);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="user-detail-loading">
        <div className="text-white/40 text-sm">Loading talent details...</div>
      </div>
    );
  }

  if (!data) return <div className="text-white/40 text-sm py-8 text-center">Failed to load details.</div>;

  const { profile, activeStats, pastStats, upcomingEvents, driveImages } = data;

  let socialLinksObj: Record<string, string> = {};
  if (profile.socialLinks) {
    try { socialLinksObj = typeof profile.socialLinks === "string" ? JSON.parse(profile.socialLinks) : profile.socialLinks; } catch {}
  }

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1" data-testid="user-detail-content">
      <div className="rounded-md bg-white/5 border border-white/5 p-4" data-testid="user-detail-header">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16 ring-2 ring-orange-500/30">
            <AvatarImage src={profile.imageUrls?.[0] || ""} />
            <AvatarFallback className="bg-gradient-to-br from-orange-500/20 to-amber-500/20 text-orange-400 text-lg font-bold">
              {profile.displayName?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg" data-testid="user-detail-name">{profile.displayName}</h3>
            {profile.stageName && <p className="text-sm text-white/50" data-testid="user-detail-stage">{profile.stageName}</p>}
            {profile.email && <p className="text-xs text-white/30 mt-1" data-testid="user-detail-email">{profile.email}</p>}
            {profile.phone && (
              <p className="text-xs text-white/50 mt-1 flex flex-wrap items-center gap-2" data-testid="user-detail-phone">
                <Phone className="h-3 w-3" /> {profile.phone}
                <Badge className={`border-0 ${profile.smsOptIn ? "bg-green-500/20 text-green-300" : "bg-white/10 text-white/50"}`} data-testid="user-detail-sms-status">
                  {profile.smsOptIn ? "OK to text" : "Do not text"}
                </Badge>
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {profile.category && <Badge className="bg-orange-500/20 text-orange-400 border-0" data-testid="user-detail-category">{profile.category}</Badge>}
              <Badge className={`border-0 ${profile.level === 4 ? "bg-red-500/20 text-red-400" : profile.level === 3 ? "bg-purple-500/20 text-purple-300" : profile.level === 2 ? "bg-blue-500/20 text-blue-400" : "bg-white/10 text-white/60"}`} data-testid="user-detail-level">
                {profile.level === 4 ? "Admin" : profile.level === 3 ? "Host" : profile.level === 2 ? "Talent" : "Viewer"} (Level {profile.level})
              </Badge>
            </div>
            {profile.bio && <p className="text-xs text-white/40 mt-2 line-clamp-3" data-testid="user-detail-bio">{profile.bio}</p>}
            {Object.keys(socialLinksObj).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {Object.entries(socialLinksObj).map(([platform, url]) => (
                  <a key={platform} href={url as string} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-400 flex items-center gap-1" data-testid={`social-link-${platform}`}>
                    <ExternalLink className="h-3 w-3" /> {platform}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <AdminAccountAccess key={profile.userId} uid={profile.userId} email={profile.email} name={profile.displayName} scope={scope} />

      {isHost && <HostEntryActions entries={data.entries || []} profileId={profileId} />}

      {!isHost && <div className="rounded-md bg-white/5 border border-white/5 p-4" data-testid="user-detail-level-mgmt">
        <h3 className="text-xs uppercase tracking-widest text-orange-400 font-bold mb-3">Change User Level</h3>
        <div className="flex items-center gap-3">
          <Select
            value={String(profile.level)}
            onValueChange={(v) => {
              const newLevel = parseInt(v);
              if (newLevel !== profile.level) {
                levelMutation.mutate({ userId: profile.userId, level: newLevel });
              }
            }}
          >
            <SelectTrigger className="flex-1 bg-white/5 border-white/10 text-white" data-testid="select-user-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/10">
              <SelectItem value="1">Level 1 - Viewer</SelectItem>
              <SelectItem value="2">Level 2 - Talent</SelectItem>
              <SelectItem value="3">Level 3 - Host</SelectItem>
              <SelectItem value="4">Level 4 - Admin</SelectItem>
            </SelectContent>
          </Select>
          {levelMutation.isPending && <span className="text-xs text-white/40">Updating...</span>}
        </div>
      </div>}

      <div className="rounded-md bg-white/5 border border-white/5 p-4" data-testid="user-detail-media">
        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xs uppercase tracking-widest text-orange-400 font-bold">Media</h3>
          <div className="flex flex-wrap items-center gap-2">
            {!isHost && <><Select value={mediaCompetitionId} onValueChange={setMediaCompetitionId}>
              <SelectTrigger className="h-8 w-full sm:w-[210px] bg-white/5 border-white/10 text-xs text-white" data-testid="select-admin-media-competition">
                <SelectValue placeholder="Optional competition" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10">
                <SelectItem value="none">No competition (photo only)</SelectItem>
                {mediaCompetitions.map((stat) => (
                  <SelectItem key={stat.competitionId} value={String(stat.competitionId)}>
                    {stat.competitionTitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleAdminImageUpload(file);
              }}
              data-testid="input-admin-user-image"
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleAdminVideoUpload(file);
              }}
              data-testid="input-admin-user-video"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 border-white/15 text-xs"
              onClick={() => imageInputRef.current?.click()}
              disabled={mediaUploadType !== null}
              data-testid="button-admin-add-photo"
            >
              <Upload className="h-3 w-3 mr-1.5" /> Photo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 border-white/15 text-xs"
              onClick={() => videoInputRef.current?.click()}
              disabled={mediaUploadType !== null || mediaCompetitions.length === 0}
              data-testid="button-admin-add-video"
            >
              <Upload className="h-3 w-3 mr-1.5" /> Video
            </Button></>}
          </div>
        </div>
        {mediaUploadType && (
          <div className="mb-4 rounded-md border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-xs text-orange-200" data-testid="admin-media-upload-status">
            Uploading {mediaUploadType}... {mediaUploadProgress}%
          </div>
        )}
        {isHost && <p className="text-[11px] text-white/35 mb-3">Photos and bio are the contestant&apos;s own and are view-only. You can remove videos from your own events.</p>}
        {!isHost && <><div className="mb-3 max-w-2xl space-y-1.5">
          <Label htmlFor="admin-video-title" className="text-xs text-white/65">
            Video title (optional)
          </Label>
          <Input
            id="admin-video-title"
            value={adminVideoTitle}
            onChange={(event) => setAdminVideoTitle(event.target.value)}
            disabled={mediaUploadType !== null}
            maxLength={120}
            placeholder="Leave blank to use the contestant name"
            className="h-9 bg-white/5 border-white/10 text-sm text-white placeholder:text-white/30"
            data-testid="input-admin-video-title"
          />
          <p className="text-[11px] text-white/35">
            The contestant name stays first. The file name and extension are not included in the Vimeo title.
          </p>
        </div>
        <p className="text-[11px] text-white/30 mb-3">
          Select a competition before adding a video. Photos can be added without one; the selected competition also chooses the Drive/Vimeo destination.
        </p></>}
          {driveImages.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-white/40 mb-2 flex items-center gap-1"><Image className="h-3 w-3" /> Photos ({driveImages.length})</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {driveImages.map((img) => (
                  <div key={img.id} className="relative group" data-testid={`drive-img-${img.id}`}>
                    <a href={img.imageUrl} target="_blank" rel="noopener noreferrer" className="block">
                      <img src={img.thumbnailUrl} alt={img.name} className="w-full aspect-square object-cover rounded-md" />
                    </a>
                    {!isHost && <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Remove this photo from the user's profile?")) deleteImageMutation.mutate(img.id);
                      }}
                      className="absolute top-1 right-1 inline-flex items-center justify-center rounded-full bg-red-600/90 p-1.5 text-white shadow-lg hover:bg-red-500 disabled:opacity-50"
                      disabled={deleteImageMutation.isPending}
                      aria-label={`Delete ${img.name}`}
                      data-testid={`button-admin-delete-photo-${img.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {driveImages.length === 0 && (
            <p className="mb-3 text-xs text-white/20">No photos found.</p>
          )}
          <div>
            <p className="text-xs text-white/40 mb-2 flex items-center gap-1"><Video className="h-3 w-3" /> Videos{!videosLoading && ` (${vimeoVideos.length})`}</p>
            {videosLoading ? (
              <p className="text-xs text-white/20">Loading videos...</p>
            ) : vimeoVideos.length === 0 ? (
              <p className="text-xs text-white/20">No videos found</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {vimeoVideos.map((vid) => (
                  <div key={vid.uri} className="relative group rounded-md overflow-hidden bg-white/5 aspect-square" data-testid={`vimeo-vid-${vid.uri}`}>
                    {playingVideoUri === vid.uri ? (
                      <iframe
                        src={`${vid.embedUrl || `https://player.vimeo.com/video/${vid.uri.split("/").pop()}`}?autoplay=1&title=0&byline=0&portrait=0`}
                        className="w-full h-full"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                        frameBorder="0"
                        title={vid.name}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPlayingVideoUri(vid.uri)}
                        className="relative block w-full h-full text-left"
                        aria-label={`Play ${vid.name}`}
                      >
                        {vid.thumbnail ? (
                          <img src={vid.thumbnail} alt={vid.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-white/10 flex items-center justify-center">
                            <Video className="h-8 w-8 text-white/40" aria-hidden="true" />
                          </div>
                        )}
                        <span className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/35 transition-colors">
                          <span className="inline-flex items-center justify-center rounded-full bg-orange-500/95 text-white w-11 h-11 shadow-lg">
                            <Play className="h-5 w-5 ml-0.5 fill-current" aria-hidden="true" />
                          </span>
                        </span>
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pt-6 pb-2">
                          <span className="block text-xs font-medium text-white truncate">{vid.name}</span>
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Remove this video from the user's profile?")) deleteVideoMutation.mutate(vid.uri);
                      }}
                      className="absolute top-1 right-1 z-10 inline-flex items-center justify-center rounded bg-red-600/80 p-1.5 text-white hover:bg-red-500 disabled:opacity-50"
                      disabled={deleteVideoMutation.isPending}
                      aria-label={`Delete ${vid.name}`}
                      data-testid={`button-admin-delete-video-${vid.uri.replace(/\//g, "-")}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
      </div>

      {(activeStats.length > 0 || pastStats.length > 0) && (
        <div className="rounded-md bg-white/5 border border-white/5 p-4" data-testid="user-detail-voting">
          <h3 className="text-xs uppercase tracking-widest text-orange-400 font-bold mb-3">Voting Stats</h3>
          {activeStats.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-white/40 mb-2 font-semibold">Active Competitions</p>
              <div className="space-y-2">
                {activeStats.map((s) => (
                  <div key={s.competitionId} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white/5 p-3" data-testid={`active-stat-${s.competitionId}`}>
                    <div>
                      <p className="text-sm font-medium">{s.competitionTitle}</p>
                      <p className="text-xs text-white/30">{s.applicationStatus}</p>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-sm font-bold text-orange-400">{s.voteCount}</p>
                        <p className="text-[10px] text-white/30">votes</p>
                      </div>
                      {s.rank && (
                        <div>
                          <p className="text-sm font-bold">#{s.rank}</p>
                          <p className="text-[10px] text-white/30">of {s.totalContestants}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold">{s.votePercentage}%</p>
                        <p className="text-[10px] text-white/30">share</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {pastStats.length > 0 && (
            <div>
              <p className="text-xs text-white/40 mb-2 font-semibold">Past Competitions</p>
              <div className="space-y-2">
                {pastStats.map((s) => (
                  <div key={s.competitionId} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white/5 p-3" data-testid={`past-stat-${s.competitionId}`}>
                    <div>
                      <p className="text-sm font-medium">{s.competitionTitle}</p>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-sm font-bold text-white/60">{s.voteCount}</p>
                        <p className="text-[10px] text-white/30">votes</p>
                      </div>
                      {s.rank && (
                        <div>
                          <p className="text-sm font-bold text-white/60">#{s.rank}</p>
                          <p className="text-[10px] text-white/30">of {s.totalContestants}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-white/60">{s.votePercentage}%</p>
                        <p className="text-[10px] text-white/30">share</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {upcomingEvents.length > 0 && (
        <div className="rounded-md bg-white/5 border border-white/5 p-4" data-testid="user-detail-upcoming">
          <h3 className="text-xs uppercase tracking-widest text-orange-400 font-bold mb-3">Upcoming Events</h3>
          <div className="space-y-2">
            {upcomingEvents.map((e) => (
              <div key={e.competitionId} className="flex items-center gap-3 rounded-md bg-white/5 p-3" data-testid={`upcoming-event-${e.competitionId}`}>
                <Calendar className="h-4 w-4 text-orange-400/60 shrink-0" />
                <p className="text-sm font-medium">{e.competitionTitle}</p>
                <Badge className="bg-white/10 text-white/60 border-0 ml-auto">{e.competitionStatus}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-md bg-white/5 border border-white/5 p-4" data-testid="user-detail-assign">
        <h3 className="text-xs uppercase tracking-widest text-orange-400 font-bold mb-3">Assign to Competition</h3>
        <div className="flex items-center gap-3">
          <Select value={assignCompId} onValueChange={setAssignCompId}>
            <SelectTrigger className="flex-1 bg-white/5 border-white/10 text-white" data-testid="select-assign-competition">
              <SelectValue placeholder="Select competition..." />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/10">
              {competitions?.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => assignCompId && assignMutation.mutate({ pId: profileId, competitionId: parseInt(assignCompId) })}
            disabled={!assignCompId || assignMutation.isPending}
            className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white"
            data-testid="button-assign-competition"
          >
            <UserCheck className="h-4 w-4 mr-1" /> {assignMutation.isPending ? "Assigning..." : "Assign"}
          </Button>
        </div>
      </div>
    </div>
  );
}
