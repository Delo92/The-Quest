import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import CBLogo from "@/components/cb-logo";
import { Trophy, User, Image as ImageIcon, Video, Save, Upload, LogOut, X, Trash2, Loader2, FolderOpen, Pencil, Check, Share2, Copy, ExternalLink, Palette, ImagePlus, Globe, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { SiYoutube, SiInstagram, SiTiktok, SiFacebook } from "react-icons/si";
import ColorWheelPicker from "@/components/color-wheel-picker";
import { slugify } from "@shared/slugify";
import { InviteDialog } from "@/components/invite-dialog";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAuthToken } from "@/hooks/use-auth";
import type { TalentProfile, Competition } from "@shared/schema";
import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import * as tus from "tus-js-client";

interface Props {
  user: any;
  profile: TalentProfile | null;
}

export default function TalentDashboard({ user, profile }: Props) {
  const { logout } = useAuth();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(profile?.displayName || user.displayName || "");
  const [email, setEmail] = useState(profile?.email || user.email || "");
  const [showEmail, setShowEmail] = useState(profile?.showEmail ?? false);
  const [bio, setBio] = useState(profile?.bio || "");
  const [category, setCategory] = useState(profile?.category || "");
  const [location, setLocation] = useState(profile?.location || "");
  const [profileColor, setProfileColor] = useState(profile?.profileColor || "#FF5A09");
  const [profileBgImage, setProfileBgImage] = useState(profile?.profileBgImage || "");
  const parsedSocial = (() => {
    try {
      const raw = (profile as any)?.socialLinks;
      if (!raw) return {};
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch { return {}; }
  })();
  const [socialYoutube, setSocialYoutube] = useState(parsedSocial.youtube || "");
  const [socialInstagram, setSocialInstagram] = useState(parsedSocial.instagram || "");
  const [socialTiktok, setSocialTiktok] = useState(parsedSocial.tiktok || "");
  const [socialFacebook, setSocialFacebook] = useState(parsedSocial.facebook || "");
  const [bgImageUploading, setBgImageUploading] = useState(false);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const [selectedCompId, setSelectedCompId] = useState<string>("");
  const [imageUploading, setImageUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [videoUploadStep, setVideoUploadStep] = useState<"preparing" | "uploading" | "finalizing" | "done">("preparing");
  const [videoUploadSpeed, setVideoUploadSpeed] = useState("");
  const [videoUploadEta, setVideoUploadEta] = useState("");
  const [videoUploadFileName, setVideoUploadFileName] = useState("");
  const [videoUploadFileSize, setVideoUploadFileSize] = useState("");
  const [videoUploadComplete, setVideoUploadComplete] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadError, setUploadError] = useState<{ type: "image" | "video"; message: string } | null>(null);
  const uploadStartTimeRef = useRef<number>(0);
  const lastBytesRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const [editingVideoUri, setEditingVideoUri] = useState<string | null>(null);
  const [editingVideoName, setEditingVideoName] = useState("");

  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);
  const [editingPromoCode, setEditingPromoCode] = useState(false);
  const [customPromoCode, setCustomPromoCode] = useState("");
  const [promoCodeSaving, setPromoCodeSaving] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const { data: competitions } = useQuery<Competition[]>({
    queryKey: ["/api/competitions"],
  });

  const { data: myContests } = useQuery<any[]>({
    queryKey: ["/api/contestants/me"],
    enabled: !!profile,
  });

  const { data: myRefCode } = useQuery<{ code: string } | null>({
    queryKey: ["/api/referral/my-code"],
    enabled: !!profile,
  });

  const { data: driveImages, isLoading: imagesLoading } = useQuery<any[]>({
    queryKey: ["/api/drive/images"],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`/api/drive/images`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load images");
      return res.json();
    },
    enabled: !!profile,
  });

  const { data: vimeoVideos, isLoading: videosLoading } = useQuery<any[]>({
    queryKey: ["/api/vimeo/videos", selectedCompId],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`/api/vimeo/videos?competitionId=${selectedCompId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load videos");
      return res.json();
    },
    enabled: !!profile && !!selectedCompId,
  });

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      const socialLinks: Record<string, string> = {};
      if (socialYoutube.trim()) socialLinks.youtube = socialYoutube.trim();
      if (socialInstagram.trim()) socialLinks.instagram = socialInstagram.trim();
      if (socialTiktok.trim()) socialLinks.tiktok = socialTiktok.trim();
      if (socialFacebook.trim()) socialLinks.facebook = socialFacebook.trim();
      const data = { displayName, email, showEmail, bio, category, location, profileColor, profileBgImage: profileBgImage || null, socialLinks: Object.keys(socialLinks).length > 0 ? JSON.stringify(socialLinks) : null };
      if (profile) {
        await apiRequest("PATCH", "/api/talent-profiles/me", data);
      } else {
        await apiRequest("POST", "/api/talent-profiles", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/talent-profiles/me"] });
      toast({ title: "Profile saved!", description: "Your talent profile has been updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const handleBgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.(jpe?g)$/i.test(file.name)) {
      toast({ title: "Invalid file type", description: "Only JPEG images (.jpg, .jpeg) are allowed.", variant: "destructive" });
      if (bgImageInputRef.current) bgImageInputRef.current.value = "";
      return;
    }
    setBgImageUploading(true);
    try {
      const token = getAuthToken();
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/talent-profiles/me/bg-image", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Upload failed");
      }
      const { url } = await res.json();
      setProfileBgImage(url);
      queryClient.invalidateQueries({ queryKey: ["/api/talent-profiles/me"] });
      toast({ title: "Background uploaded!", description: "Your profile background image has been saved." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message || "Could not upload background image.", variant: "destructive" });
    } finally {
      setBgImageUploading(false);
      if (bgImageInputRef.current) bgImageInputRef.current.value = "";
    }
  };

  const [leaveTarget, setLeaveTarget] = useState<{ contestantId: number; title: string } | null>(null);
  const [leaveConfirmText, setLeaveConfirmText] = useState("");

  const applyMutation = useMutation({
    mutationFn: async (competitionId: number) => {
      await apiRequest("POST", `/api/competitions/${competitionId}/apply`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants/me"] });
      toast({ title: "Applied!", description: "Your application has been submitted for review." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async (contestantId: number) => {
      await apiRequest("DELETE", `/api/contestants/me/${contestantId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants/me"] });
      setLeaveTarget(null);
      setLeaveConfirmText("");
      toast({ title: "Left competition", description: "You have been removed from the competition." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: async (fileId: string) => {
      await apiRequest("DELETE", `/api/drive/images/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drive/images"] });
      queryClient.invalidateQueries({ queryKey: ["/api/talent-profiles/me"] });
      toast({ title: "Image removed", description: "The image has been removed from your profile." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const deleteVideoMutation = useMutation({
    mutationFn: async (videoUri: string) => {
      const videoId = videoUri.split("/").pop();
      await apiRequest("DELETE", `/api/vimeo/videos/${videoId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vimeo/videos", selectedCompId] });
      toast({ title: "Video removed", description: "The video has been removed from your profile." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const renameVideoMutation = useMutation({
    mutationFn: async ({ videoUri, name }: { videoUri: string; name: string }) => {
      const videoId = videoUri.split("/").pop();
      await apiRequest("PATCH", `/api/vimeo/videos/${videoId}`, { name });
    },
    onSuccess: () => {
      setEditingVideoUri(null);
      setEditingVideoName("");
      queryClient.invalidateQueries({ queryKey: ["/api/vimeo/videos", selectedCompId] });
      toast({ title: "Renamed", description: "Video name updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCompId) return;

    setImageUploading(true);
    setUploadError(null);
    setUploadStatus("Uploading photo to Google Drive...");
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("competitionId", selectedCompId);

      const token = getAuthToken();
      const res = await fetch("/api/drive/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }

      setUploadStatus("");
      queryClient.invalidateQueries({ queryKey: ["/api/drive/images"] });
      queryClient.invalidateQueries({ queryKey: ["/api/talent-profiles/me"] });
      toast({ title: "Uploaded!", description: "Your photo has been uploaded successfully." });
    } catch (err: any) {
      setUploadStatus("");
      setUploadError({ type: "image", message: err.message || "Photo upload failed" });
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }, [selectedCompId, toast]);

  const handleVideoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCompId) return;

    const fileSizeMb = (file.size / (1024 * 1024)).toFixed(1);
    setVideoUploading(true);
    setVideoUploadProgress(0);
    setVideoUploadStep("preparing");
    setVideoUploadSpeed("");
    setVideoUploadEta("");
    setVideoUploadFileName(file.name);
    setVideoUploadFileSize(`${fileSizeMb} MB`);
    setVideoUploadComplete(false);
    setUploadError(null);
    setUploadStatus("Requesting upload slot...");
    uploadStartTimeRef.current = Date.now();
    lastBytesRef.current = 0;
    lastTimeRef.current = Date.now();

    try {
      const token = getAuthToken();
      const ticketRes = await fetch("/api/vimeo/upload-ticket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          competitionId: selectedCompId,
        }),
      });

      if (!ticketRes.ok) {
        const err = await ticketRes.json();
        throw new Error(err.message || "Failed to create upload ticket");
      }

      const ticket = await ticketRes.json();
      setVideoUploadStep("uploading");
      setUploadStatus("Starting upload...");

      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(file, {
          uploadUrl: ticket.uploadLink,
          onError: (error) => {
            reject(new Error(error.message || "Video upload failed"));
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            const pct = Math.round((bytesUploaded / bytesTotal) * 100);
            setVideoUploadProgress(pct);
            const mbUploaded = (bytesUploaded / (1024 * 1024)).toFixed(1);
            const mbTotal = (bytesTotal / (1024 * 1024)).toFixed(1);
            setUploadStatus(`${mbUploaded} MB / ${mbTotal} MB`);

            const now = Date.now();
            const elapsed = (now - lastTimeRef.current) / 1000;
            if (elapsed >= 1) {
              const bytesDelta = bytesUploaded - lastBytesRef.current;
              const speed = bytesDelta / elapsed;
              lastBytesRef.current = bytesUploaded;
              lastTimeRef.current = now;

              if (speed > 0) {
                const speedMb = (speed / (1024 * 1024)).toFixed(1);
                setVideoUploadSpeed(`${speedMb} MB/s`);
                const remaining = bytesTotal - bytesUploaded;
                const etaSec = Math.round(remaining / speed);
                if (etaSec < 60) {
                  setVideoUploadEta(`~${etaSec}s remaining`);
                } else {
                  const min = Math.floor(etaSec / 60);
                  const sec = etaSec % 60;
                  setVideoUploadEta(`~${min}m ${sec}s remaining`);
                }
              }
            }
          },
          onSuccess: () => {
            resolve();
          },
        });
        upload.start();
      });

      setVideoUploadStep("finalizing");
      setVideoUploadProgress(100);
      setUploadStatus("Processing your video...");
      setVideoUploadSpeed("");
      setVideoUploadEta("");

      try {
        const token = getAuthToken();
        await fetch("/api/vimeo/finalize-upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            videoUri: ticket.videoUri,
            competitionId: selectedCompId,
            completeUri: ticket.completeUri || null,
          }),
        });
      } catch {}

      setVideoUploadStep("done");
      setVideoUploadComplete(true);
      setUploadStatus("Upload complete!");
      toast({ title: "Video uploaded!", description: "Your video has been saved. It may take a moment for the thumbnail to appear." });

      queryClient.invalidateQueries({ queryKey: ["/api/vimeo/videos", selectedCompId] });

      let pollCount = 0;
      const pollInterval = setInterval(() => {
        pollCount++;
        queryClient.invalidateQueries({ queryKey: ["/api/vimeo/videos", selectedCompId] });
        if (pollCount >= 6) clearInterval(pollInterval);
      }, 5000);

      setTimeout(() => {
        setVideoUploading(false);
        setVideoUploadProgress(0);
        setVideoUploadComplete(false);
      }, 4000);
    } catch (err: any) {
      setUploadStatus("");
      setUploadError({ type: "video", message: err.message || "Video upload failed" });
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      setVideoUploading(false);
      setVideoUploadProgress(0);
    } finally {
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  }, [selectedCompId, toast]);

  const activeCompetitions = competitions?.filter(
    (c) => c.status === "active" || c.status === "voting"
  ) || [];
  const appliedIds = new Set(myContests?.map((c: any) => c.competitionId) || []);
  const appliedContests = myContests?.filter((c: any) => c.applicationStatus === "approved" || c.applicationStatus === "pending") || [];
  const approvedContests = myContests?.filter((c: any) => c.applicationStatus === "approved") || [];
  const hasActiveEntry = appliedContests.length > 0;

  useEffect(() => {
    if (!selectedCompId && appliedContests.length > 0) {
      setSelectedCompId(String(appliedContests[0].competitionId));
    }
  }, [appliedContests, selectedCompId]);

  const handleSavePromoCode = async () => {
    if (!customPromoCode.trim()) return;
    setPromoCodeSaving(true);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");
      const res = await fetch("/api/referral/my-code", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newCode: customPromoCode.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to update code");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/referral/my-code"] });
      setEditingPromoCode(false);
      toast({ title: "Promo code updated!", description: `Your new code is ${customPromoCode.trim().toUpperCase()}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update promo code", variant: "destructive" });
    } finally {
      setPromoCodeSaving(false);
    }
  };

  const ensureRefCode = async (): Promise<string | null> => {
    if (myRefCode?.code) return myRefCode.code;
    try {
      const token = await getAuthToken();
      if (!token) return null;
      const res = await fetch("/api/referral/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        queryClient.invalidateQueries({ queryKey: ["/api/referral/my-code"] });
        return data.code || null;
      }
    } catch {}
    return null;
  };

  const buildShareUrl = (contest: any) => {
    const comp = competitions?.find(c => c.id === contest.competitionId);
    const catSlug = slugify(contest.competitionCategory || comp?.category || "competition");
    const compSlug = slugify(contest.competitionTitle || "contest");
    const talentSlug = slugify(displayName || profile?.displayName || "talent");
    return `${window.location.origin}/thequest/${catSlug}/${compSlug}/${talentSlug}?ref=${talentSlug}`;
  };

  const handleCopyShareLink = async (contest: any) => {
    const url = buildShareUrl(contest);
    const name = displayName || profile?.displayName || "me";
    const text = `Vote for ${name} on The Quest!\n${url}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopiedShareId(contest.id.toString());
    toast({ title: "Link copied!", description: "Your personal voting link has been copied. Share it anywhere!" });
    setTimeout(() => setCopiedShareId(null), 3000);
  };

  const handleNativeShare = async (contest: any) => {
    await handleCopyShareLink(contest);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="sticky top-0 z-50 bg-black/95 backdrop-blur-xl border-b border-white/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 h-16 lg:h-20">
          <Link href="/" className="flex items-center gap-2" data-testid="link-home">
            <CBLogo size="sm" showText={false} />
            <span className="font-serif text-xl font-bold">The Quest</span>
          </Link>
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 ring-2 ring-white/10">
              <AvatarImage src={user.profileImageUrl || ""} />
              <AvatarFallback className="bg-gradient-to-br from-orange-500/20 to-amber-500/20 text-orange-400 text-xs font-bold">
                {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium hidden sm:inline text-white/70">{user.displayName || user.email}</span>
            <Button size="icon" variant="ghost" className="text-white/40" onClick={() => logout()} data-testid="button-logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold" data-testid="text-dashboard-title">Talent Dashboard</h1>
            <p className="text-white/40 mt-1">Manage your profile, media, and competition applications.</p>
          </div>
          <InviteDialog senderLevel={2} />
        </div>

        <Tabs defaultValue="profile">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mb-6">
            <TabsList className="inline-flex w-max sm:w-auto bg-white/[0.08] border border-white/15">
              <TabsTrigger value="profile" data-testid="tab-profile" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white">
                <User className="h-4 w-4 mr-1.5" /> <span className="hidden sm:inline">Profile</span>
              </TabsTrigger>
              <TabsTrigger value="media" data-testid="tab-media" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white">
                <FolderOpen className="h-4 w-4 mr-1.5" /> <span className="hidden sm:inline">Media</span>
              </TabsTrigger>
              <TabsTrigger value="competitions" data-testid="tab-competitions" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white">
                <Trophy className="h-4 w-4 mr-1.5" /> <span className="hidden sm:inline">Competitions</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="profile">
            <div className="rounded-md bg-white/[0.04] border border-white/15 p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="displayName" className="text-white/60">Display Name</Label>
                  <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your stage name" data-testid="input-display-name"
                    className="bg-white/[0.07] border-white/15 text-white placeholder:text-white/25" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-white/60">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com" data-testid="input-email"
                    className="bg-white/[0.07] border-white/15 text-white placeholder:text-white/25" />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md bg-white/[0.06] border border-white/12 px-4 py-3">
                <div>
                  <Label htmlFor="showEmail" className="text-white/80 text-sm font-medium cursor-pointer">Show email on my profile</Label>
                  <p className="text-xs text-white/40 mt-0.5">Voters will see your email for booking inquiries</p>
                </div>
                <Switch
                  id="showEmail"
                  checked={showEmail}
                  onCheckedChange={setShowEmail}
                  data-testid="switch-show-email"
                  className="data-[state=checked]:bg-orange-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="category" className="text-white/60">Category</Label>
                  <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g., Music, Modeling, Bodybuilding" data-testid="input-category"
                    className="bg-white/[0.07] border-white/15 text-white placeholder:text-white/20" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location" className="text-white/60">Location</Label>
                <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)}
                  placeholder="City, State" data-testid="input-location"
                  className="bg-white/[0.07] border-white/15 text-white placeholder:text-white/20" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bio" className="text-white/60">Bio</Label>
                <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself and your talent..."
                  className="min-h-[120px] resize-none bg-white/[0.07] border-white/15 text-white placeholder:text-white/20" data-testid="input-bio" />
              </div>

              <div className="space-y-4 rounded-md bg-white/[0.03] border border-white/10 p-5">
                <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                  <Globe className="h-5 w-5 text-orange-400" />
                  <div>
                    <Label className="text-white text-sm font-semibold">Social Media Links</Label>
                    <p className="text-xs text-white/40 mt-0.5">Add your social media profiles. These will appear on your public profile page.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-white/60 flex items-center gap-1.5"><SiYoutube className="h-3.5 w-3.5 text-red-500" /> YouTube</Label>
                    <Input value={socialYoutube} onChange={(e) => setSocialYoutube(e.target.value)}
                      placeholder="https://youtube.com/@yourchannel" data-testid="input-social-youtube"
                      className="bg-white/[0.07] border-white/15 text-white placeholder:text-white/20" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/60 flex items-center gap-1.5"><SiInstagram className="h-3.5 w-3.5 text-pink-500" /> Instagram</Label>
                    <Input value={socialInstagram} onChange={(e) => setSocialInstagram(e.target.value)}
                      placeholder="https://instagram.com/yourhandle" data-testid="input-social-instagram"
                      className="bg-white/[0.07] border-white/15 text-white placeholder:text-white/20" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/60 flex items-center gap-1.5"><SiTiktok className="h-3.5 w-3.5 text-white" /> TikTok</Label>
                    <Input value={socialTiktok} onChange={(e) => setSocialTiktok(e.target.value)}
                      placeholder="https://tiktok.com/@yourhandle" data-testid="input-social-tiktok"
                      className="bg-white/[0.07] border-white/15 text-white placeholder:text-white/20" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/60 flex items-center gap-1.5"><SiFacebook className="h-3.5 w-3.5 text-blue-500" /> Facebook</Label>
                    <Input value={socialFacebook} onChange={(e) => setSocialFacebook(e.target.value)}
                      placeholder="https://facebook.com/yourpage" data-testid="input-social-facebook"
                      className="bg-white/[0.07] border-white/15 text-white placeholder:text-white/20" />
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-md bg-white/[0.03] border border-white/10 p-5">
                <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                  <Palette className="h-5 w-5 text-orange-400" />
                  <div>
                    <Label className="text-white text-sm font-semibold">Profile Page Customization</Label>
                    <p className="text-xs text-white/40 mt-0.5">Customize the look of your public contestant page.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-white/70 text-xs font-medium uppercase" style={{ letterSpacing: "1px" }}>Accent Color</Label>
                    <ColorWheelPicker value={profileColor} onChange={setProfileColor} />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-white/70 text-xs font-medium uppercase" style={{ letterSpacing: "1px" }}>Background Image</Label>
                    <p className="text-[11px] text-white/40">Upload a JPEG image to use as your profile page background.</p>
                    <input
                      ref={bgImageInputRef}
                      type="file"
                      accept=".jpg,.jpeg"
                      className="hidden"
                      onChange={handleBgImageUpload}
                      data-testid="input-bg-image-file"
                    />
                    {profileBgImage ? (
                      <div className="space-y-2">
                        <div className="relative rounded-md overflow-hidden border border-white/10 h-28">
                          <img src={profileBgImage} alt="Background" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/30" />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            className="text-white/60 text-xs flex-1 border border-white/10"
                            onClick={() => bgImageInputRef.current?.click()}
                            disabled={bgImageUploading}
                            data-testid="button-change-bg"
                          >
                            {bgImageUploading ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <ImagePlus className="h-3 w-3 mr-1.5" />}
                            Change
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="text-red-400/70 text-xs border border-white/10"
                            onClick={() => setProfileBgImage("")}
                            data-testid="button-remove-bg"
                          >
                            <X className="h-3 w-3 mr-1" /> Remove
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => bgImageInputRef.current?.click()}
                        disabled={bgImageUploading}
                        className="w-full h-28 rounded-md border-2 border-dashed border-white/15 flex flex-col items-center justify-center gap-2 transition-colors hover:border-white/30 hover:bg-white/[0.02] cursor-pointer disabled:opacity-50"
                        data-testid="button-upload-bg"
                      >
                        {bgImageUploading ? (
                          <Loader2 className="h-6 w-6 text-white/30 animate-spin" />
                        ) : (
                          <Upload className="h-6 w-6 text-white/30" />
                        )}
                        <span className="text-xs text-white/40">{bgImageUploading ? "Uploading..." : "Click to upload JPEG"}</span>
                        <span className="text-[10px] text-white/20">.jpg or .jpeg only</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="rounded-md overflow-hidden border border-white/10 h-24 relative mt-1" data-testid="profile-preview">
                  {profileBgImage && (
                    <img src={profileBgImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-black/40" />
                  <div className="relative h-full flex items-center px-4 gap-3">
                    <div className="w-12 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: profileColor, opacity: 0.9 }} />
                    <div>
                      <p className="text-sm font-bold" style={{ color: profileColor }}>{displayName || "Your Name"}</p>
                      <p className="text-[10px] text-white/50 uppercase" style={{ letterSpacing: "2px" }}>Live Preview</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => saveProfileMutation.mutate()} disabled={saveProfileMutation.isPending || !displayName.trim()}
                  data-testid="button-save-profile" className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white">
                  <Save className="h-4 w-4 mr-2" />
                  {saveProfileMutation.isPending ? "Saving..." : "Save Profile"}
                </Button>
                {profile && (
                  <a href={`/talent/${profile.id}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" data-testid="button-view-profile"
                      className="border-white/20 text-white/70 hover:text-white hover:border-white/40">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Profile
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="media">
            {!profile ? (
              <div className="rounded-md bg-white/[0.06] border border-white/12 p-6 text-center">
                <User className="h-10 w-10 text-white/20 mx-auto mb-3" />
                <h3 className="font-semibold mb-1">Create Your Profile First</h3>
                <p className="text-sm text-white/40">You need a talent profile before uploading media.</p>
              </div>
            ) : appliedContests.length === 0 ? (
              <div className="rounded-md bg-white/[0.06] border border-white/12 p-6 text-center">
                <Trophy className="h-10 w-10 text-white/20 mx-auto mb-3" />
                <h3 className="font-semibold mb-1">No Competitions Yet</h3>
                <p className="text-sm text-white/40">Apply to a competition in the Competitions tab first, then come back here to upload your photos and videos.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {appliedContests.length > 1 ? (
                  <div className="rounded-md bg-white/[0.06] border border-white/12 p-4">
                    <Label className="text-white/60 mb-2 block">Select Competition</Label>
                    <Select value={selectedCompId} onValueChange={setSelectedCompId}>
                      <SelectTrigger className="bg-white/[0.07] border-white/15 text-white" data-testid="select-competition">
                        <SelectValue placeholder="Choose a competition to manage media..." />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10">
                        {appliedContests.map((c: any) => (
                          <SelectItem key={c.competitionId} value={String(c.competitionId)} className="text-white">
                            {c.competitionTitle || `Competition #${c.competitionId}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : appliedContests.length === 1 ? (
                  <div className="rounded-md bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 p-4 flex items-center gap-3">
                    <Trophy className="h-5 w-5 text-orange-400 shrink-0" />
                    <div>
                      <p className="font-semibold text-white">{appliedContests[0].competitionTitle || `Competition #${appliedContests[0].competitionId}`}</p>
                      <p className="text-xs text-white/40">Upload your photos and videos for this competition below</p>
                    </div>
                  </div>
                ) : null}

                {selectedCompId && (
                  <>
                    <div className="rounded-md bg-white/[0.06] border border-white/12 p-6 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Label className="flex items-center gap-2 text-white/80 text-base font-semibold">
                          <ImageIcon className="h-5 w-5 text-orange-400" /> Photos
                        </Label>
                        <div>
                          <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageUpload}
                            data-testid="input-image-file"
                          />
                          <Button
                            onClick={() => imageInputRef.current?.click()}
                            disabled={imageUploading}
                            data-testid="button-upload-image"
                            className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white"
                          >
                            {imageUploading ? (
                              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
                            ) : (
                              <><Upload className="h-4 w-4 mr-2" /> Upload Photo</>
                            )}
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-white/30">Photos are uploaded to Google Drive in your competition folder.</p>

                      {imageUploading && (
                        <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/20 rounded-md px-4 py-3" data-testid="status-image-uploading">
                          <Loader2 className="h-5 w-5 animate-spin text-orange-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-orange-300">{uploadStatus || "Uploading..."}</p>
                            <p className="text-xs text-white/40 mt-0.5">Please wait, do not close this page</p>
                          </div>
                        </div>
                      )}

                      {uploadError?.type === "image" && (
                        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-md px-4 py-3" data-testid="error-image-upload">
                          <X className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-red-300">Photo upload failed</p>
                            <p className="text-xs text-red-400/70 mt-0.5">{uploadError.message}</p>
                          </div>
                          <button onClick={() => setUploadError(null)} className="text-white/30 hover:text-white/60 flex-shrink-0" data-testid="button-dismiss-image-error">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}

                      {imagesLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
                        </div>
                      ) : driveImages && driveImages.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {driveImages.map((img: any) => (
                            <div key={img.id} className="relative group rounded-md overflow-visible bg-white/5 aspect-square">
                              <img
                                src={img.imageUrl}
                                alt={img.name || "Photo"}
                                className="w-full h-full object-cover rounded-md"
                                loading="lazy"
                                onError={(e) => {
                                  if (img.fallbackUrl && (e.target as HTMLImageElement).src !== img.fallbackUrl) {
                                    (e.target as HTMLImageElement).src = img.fallbackUrl;
                                  }
                                }}
                              />
                              <button
                                onClick={() => deleteImageMutation.mutate(img.id)}
                                className="absolute top-1 right-1 bg-red-600/90 text-white rounded-full p-1 invisible group-hover:visible transition-all"
                                data-testid={`button-delete-image-${img.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <ImageIcon className="h-8 w-8 text-white/10 mx-auto mb-2" />
                          <p className="text-sm text-white/30">No photos uploaded yet for this competition.</p>
                        </div>
                      )}
                    </div>

                    <div className="rounded-md bg-white/[0.06] border border-white/12 p-6 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Label className="flex items-center gap-2 text-white/80 text-base font-semibold">
                          <Video className="h-5 w-5 text-orange-400" /> Videos
                        </Label>
                        <div>
                          <input
                            ref={videoInputRef}
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={handleVideoUpload}
                            data-testid="input-video-file"
                          />
                          <Button
                            onClick={() => videoInputRef.current?.click()}
                            disabled={videoUploading}
                            data-testid="button-upload-video"
                            className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white"
                          >
                            {videoUploading ? (
                              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
                            ) : (
                              <><Upload className="h-4 w-4 mr-2" /> Upload Video</>
                            )}
                          </Button>
                        </div>
                      </div>
                      {!videoUploading && (
                        <p className="text-xs text-white/30">Videos are uploaded to Vimeo in your competition folder.</p>
                      )}

                      {videoUploading && (
                        <div className="rounded-lg bg-black/40 border border-orange-500/30 overflow-hidden" data-testid="status-video-uploading">
                          <div className="px-4 py-3 border-b border-white/10">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Video className="h-4 w-4 text-orange-400 flex-shrink-0" />
                                <span className="text-sm text-white/80 truncate">{videoUploadFileName}</span>
                              </div>
                              <span className="text-xs text-white/40 flex-shrink-0">{videoUploadFileSize}</span>
                            </div>
                          </div>

                          <div className="px-4 py-3 space-y-3">
                            <div className="flex items-center gap-3">
                              {videoUploadStep === "done" ? (
                                <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                  <Check className="h-4 w-4 text-green-400" />
                                </div>
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                                  <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${videoUploadStep === "done" ? "text-green-300" : "text-orange-300"}`}>
                                  {videoUploadStep === "preparing" && "Preparing upload..."}
                                  {videoUploadStep === "uploading" && `Uploading — ${videoUploadProgress}%`}
                                  {videoUploadStep === "finalizing" && "Processing video..."}
                                  {videoUploadStep === "done" && "Upload complete!"}
                                </p>
                                <p className="text-xs text-white/40 mt-0.5">
                                  {videoUploadStep === "preparing" && "Getting things ready, one moment..."}
                                  {videoUploadStep === "uploading" && (uploadStatus || "Transferring file...")}
                                  {videoUploadStep === "finalizing" && "Vimeo is processing your video, almost done..."}
                                  {videoUploadStep === "done" && "Your video will appear below shortly."}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <Progress
                                value={videoUploadStep === "preparing" ? 0 : videoUploadProgress}
                                className={`h-3 bg-white/10 transition-all ${
                                  videoUploadStep === "done"
                                    ? "[&>div]:bg-gradient-to-r [&>div]:from-green-500 [&>div]:to-emerald-400"
                                    : "[&>div]:bg-gradient-to-r [&>div]:from-orange-500 [&>div]:to-amber-500"
                                }`}
                              />
                              <div className="flex items-center justify-between text-xs text-white/40">
                                <span>
                                  {videoUploadStep === "preparing" && "Waiting..."}
                                  {videoUploadStep === "uploading" && (videoUploadSpeed || "Calculating speed...")}
                                  {videoUploadStep === "finalizing" && "Almost there..."}
                                  {videoUploadStep === "done" && "Finished"}
                                </span>
                                <span>
                                  {videoUploadStep === "uploading" && videoUploadEta}
                                  {videoUploadStep === "done" && "100%"}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 pt-1">
                              {["preparing", "uploading", "finalizing", "done"].map((step, i) => {
                                const steps = ["preparing", "uploading", "finalizing", "done"];
                                const currentIdx = steps.indexOf(videoUploadStep);
                                const isActive = i <= currentIdx;
                                const labels = ["Prepare", "Upload", "Process", "Done"];
                                return (
                                  <div key={step} className="flex items-center gap-1.5 flex-1">
                                    <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
                                      isActive
                                        ? step === "done" ? "bg-green-400" : "bg-orange-400"
                                        : "bg-white/20"
                                    }`} />
                                    <span className={`text-[10px] uppercase tracking-wider ${
                                      isActive ? "text-white/60" : "text-white/20"
                                    }`}>{labels[i]}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {videoUploadStep !== "done" && (
                            <div className="px-4 py-2 bg-orange-500/5 border-t border-white/5">
                              <p className="text-[11px] text-white/30 text-center">Please keep this page open until the upload finishes</p>
                            </div>
                          )}
                        </div>
                      )}

                      {uploadError?.type === "video" && (
                        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-md px-4 py-3" data-testid="error-video-upload">
                          <X className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-red-300">Video upload failed</p>
                            <p className="text-xs text-red-400/70 mt-0.5">{uploadError.message}</p>
                          </div>
                          <button onClick={() => setUploadError(null)} className="text-white/30 hover:text-white/60 flex-shrink-0" data-testid="button-dismiss-video-error">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}

                      {videosLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
                        </div>
                      ) : vimeoVideos && vimeoVideos.length > 0 ? (
                        <div className="space-y-4">
                          {vimeoVideos.map((vid: any) => {
                            return (
                              <div key={vid.uri} className="rounded-md bg-white/5 border border-white/10 overflow-hidden" data-testid={`card-video-${vid.uri}`}>
                                {vid.embedUrl ? (
                                  <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                                    <iframe
                                      src={`${vid.embedUrl}?title=0&byline=0&portrait=0&dnt=1`}
                                      className="absolute inset-0 w-full h-full"
                                      allow="autoplay; fullscreen; picture-in-picture"
                                      allowFullScreen
                                      title={vid.name}
                                    />
                                  </div>
                                ) : (
                                  <div className="relative w-full bg-black/60 flex items-center justify-center" style={{ paddingTop: "56.25%" }}>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <Video className="h-12 w-12 text-white/20" />
                                    </div>
                                  </div>
                                )}
                                <div className="p-3 flex flex-wrap items-center gap-3">
                                  <div className="flex-1 min-w-0">
                                    {editingVideoUri === vid.uri ? (
                                      <div className="flex items-center gap-2">
                                        <Input
                                          value={editingVideoName}
                                          onChange={(e) => setEditingVideoName(e.target.value)}
                                          className="h-8 text-sm bg-black/40 border-orange-500/50"
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" && editingVideoName.trim()) {
                                              renameVideoMutation.mutate({ videoUri: vid.uri, name: editingVideoName.trim() });
                                            } else if (e.key === "Escape") {
                                              setEditingVideoUri(null);
                                            }
                                          }}
                                          autoFocus
                                          data-testid="input-video-rename"
                                        />
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="text-green-400 flex-shrink-0"
                                          onClick={() => {
                                            if (editingVideoName.trim()) {
                                              renameVideoMutation.mutate({ videoUri: vid.uri, name: editingVideoName.trim() });
                                            }
                                          }}
                                          disabled={renameVideoMutation.isPending || !editingVideoName.trim()}
                                          data-testid="button-confirm-rename"
                                        >
                                          {renameVideoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="text-white/40 flex-shrink-0"
                                          onClick={() => setEditingVideoUri(null)}
                                          data-testid="button-cancel-rename"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <h4 className="font-medium text-sm truncate">{vid.name}</h4>
                                        <button
                                          className="text-white/40 hover:text-orange-400 transition-colors flex-shrink-0 p-1"
                                          onClick={() => {
                                            setEditingVideoUri(vid.uri);
                                            setEditingVideoName(vid.name || "");
                                          }}
                                          data-testid={`button-edit-video-name-${vid.uri}`}
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </button>
                                      </div>
                                    )}
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                      {vid.duration > 0 && (
                                        <span className="text-xs text-white/30">{Math.floor(vid.duration / 60)}:{String(vid.duration % 60).padStart(2, "0")}</span>
                                      )}
                                      <Badge className={`border-0 text-xs ${vid.status === "available" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                                        {vid.status === "available" ? "Ready" : vid.status === "uploading" ? "Uploading" : "Processing"}
                                      </Badge>
                                    </div>
                                  </div>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-red-400 flex-shrink-0"
                                    onClick={() => deleteVideoMutation.mutate(vid.uri)}
                                    disabled={deleteVideoMutation.isPending}
                                    data-testid={`button-delete-video-${vid.uri}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Video className="h-8 w-8 text-white/10 mx-auto mb-2" />
                          <p className="text-sm text-white/30">No videos uploaded yet for this competition.</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="competitions">
            {!profile ? (
              <div className="rounded-md bg-white/[0.06] border border-white/12 p-6 text-center">
                <User className="h-10 w-10 text-white/20 mx-auto mb-3" />
                <h3 className="font-semibold mb-1">Create Your Profile First</h3>
                <p className="text-sm text-white/40">You need a talent profile before applying to competitions.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {profile && (
                  <div className="rounded-md bg-white/[0.06] border border-white/12 p-4">
                    <h3 className="font-bold mb-2 text-lg flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-orange-400" />
                      My Promo Code
                    </h3>
                    <p className="text-sm text-white/40 mb-3">This code is included in your share links. People who use it get bonus rewards when they vote or sign up. Previous codes still work if you change it.</p>
                    {editingPromoCode ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={customPromoCode}
                          onChange={(e) => setCustomPromoCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                          placeholder="Enter custom code (3-20 chars)"
                          maxLength={20}
                          className="bg-black/50 border-white/10 text-white uppercase font-mono tracking-wider"
                          data-testid="input-promo-code"
                        />
                        <Button
                          onClick={handleSavePromoCode}
                          disabled={promoCodeSaving || customPromoCode.trim().length < 3}
                          className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white shrink-0"
                          data-testid="button-save-promo-code"
                        >
                          {promoCodeSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setEditingPromoCode(false)}
                          className="text-white/40 shrink-0"
                          data-testid="button-cancel-promo-code"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : myRefCode?.code ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 rounded bg-black/50 border border-white/5 px-3 py-2 font-mono text-orange-400 tracking-widest text-lg" data-testid="text-promo-code">
                            {myRefCode.code}
                          </div>
                          <Button
                            variant="ghost"
                            onClick={() => { setCustomPromoCode(myRefCode.code); setEditingPromoCode(true); }}
                            className="text-white/60 shrink-0"
                            data-testid="button-edit-promo-code"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={async () => {
                              await navigator.clipboard.writeText(myRefCode.code);
                              toast({ title: "Copied!", description: "Promo code copied to clipboard." });
                            }}
                            className="text-white/60 shrink-0"
                            data-testid="button-copy-promo-code"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        {(myRefCode as any).previousCodes?.length > 0 && (
                          <div className="text-xs text-white/30">
                            Previous codes (still active): {(myRefCode as any).previousCodes.join(", ")}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => { setCustomPromoCode(""); setEditingPromoCode(true); }}
                          className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white"
                          data-testid="button-create-promo-code"
                        >
                          Create My Code
                        </Button>
                        <span className="text-sm text-white/30">or it will be auto-generated when you share a link</span>
                      </div>
                    )}
                  </div>
                )}

                {approvedContests.length > 0 && (
                  <div>
                    <h3 className="font-bold mb-3 text-lg flex items-center gap-2">
                      <Share2 className="h-5 w-5 text-orange-400" />
                      Share & Promote
                    </h3>
                    <p className="text-sm text-white/40 mb-3">Copy your personal voting link to share on social media, text, or email. Votes from your shared link are tracked to you.</p>
                    <div className="space-y-2">
                      {approvedContests.map((contest: any) => {
                        const previewUrl = buildShareUrl(contest);
                        const isCopied = copiedShareId === contest.id.toString();
                        return (
                          <div key={`share-${contest.id}`} className="rounded-md bg-white/[0.06] border border-white/12 p-4" data-testid={`card-share-${contest.id}`}>
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                              <div>
                                <h4 className="font-medium">{contest.competitionTitle || "Competition"}</h4>
                                <p className="text-xs text-white/30">{contest.competitionCategory}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  onClick={() => handleCopyShareLink(contest)}
                                  data-testid={`button-copy-share-${contest.id}`}
                                  className={`border-0 text-white ${isCopied ? "bg-green-600" : "bg-gradient-to-r from-orange-500 to-amber-500"}`}
                                >
                                  {isCopied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
                                  {isCopied ? "Copied!" : "Copy Link"}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleNativeShare(contest)}
                                  data-testid={`button-share-${contest.id}`}
                                  className="text-white/60"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="rounded bg-black/50 border border-white/5 px-3 py-2 text-xs text-white/50 break-all font-mono" data-testid={`text-share-url-${contest.id}`}>
                              {previewUrl}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {myContests && myContests.length > 0 && (
                  <div>
                    <h3 className="font-bold mb-3 text-lg">My Competitions</h3>
                    <div className="space-y-2">
                      {myContests.map((contest: any) => (
                        <div key={contest.id} className="rounded-md bg-white/[0.06] border border-white/12 p-4 flex flex-wrap items-center justify-between gap-3" data-testid={`card-my-contest-${contest.id}`}>
                          <div>
                            <h4 className="font-medium">{contest.competitionTitle || "Competition"}</h4>
                            <p className="text-xs text-white/30">Applied {new Date(contest.appliedAt).toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {contest.applicationStatus === "approved" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCopyShareLink(contest)}
                                data-testid={`button-quick-share-${contest.id}`}
                                className="text-orange-400 text-xs"
                              >
                                <Copy className="h-3.5 w-3.5 mr-1" />
                                Share
                              </Button>
                            )}
                            <Badge className={`border-0 ${contest.applicationStatus === "approved" ? "bg-green-500/20 text-green-400" : contest.applicationStatus === "rejected" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`} data-testid={`badge-app-status-${contest.id}`}>
                              {contest.applicationStatus}
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setLeaveTarget({ contestantId: contest.id, title: contest.competitionTitle || "Competition" }); setLeaveConfirmText(""); }}
                              data-testid={`button-leave-${contest.id}`}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
                            >
                              Leave
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="font-bold mb-3 text-lg">Available Competitions</h3>
                  {activeCompetitions.length > 0 ? (
                    <div className="space-y-2">
                      {activeCompetitions.map((comp) => (
                        <div key={comp.id} className="rounded-md bg-white/[0.06] border border-white/12 p-4 flex flex-wrap items-center justify-between gap-3" data-testid={`card-available-comp-${comp.id}`}>
                          <div>
                            <h4 className="font-medium">{comp.title}</h4>
                            <p className="text-xs text-white/30">{comp.category}</p>
                          </div>
                          {appliedIds.has(comp.id) ? (
                            <div className="flex items-center gap-2">
                              <Badge className="bg-orange-500/20 text-orange-400 border-0">Applied</Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const entry = myContests?.find((c: any) => c.competitionId === comp.id);
                                  if (entry) { setLeaveTarget({ contestantId: entry.id, title: comp.title }); setLeaveConfirmText(""); }
                                }}
                                data-testid={`button-leave-available-${comp.id}`}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
                              >
                                Leave
                              </Button>
                            </div>
                          ) : hasActiveEntry ? (
                            <Badge className="bg-white/10 text-white/30 border-0">Already in a competition</Badge>
                          ) : (
                            <Button onClick={() => applyMutation.mutate(comp.id)} disabled={applyMutation.isPending}
                              data-testid={`button-apply-${comp.id}`} className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white">
                              Apply
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md bg-white/[0.06] border border-white/12 p-6 text-center">
                      <Trophy className="h-8 w-8 text-white/10 mx-auto mb-2" />
                      <p className="text-sm text-white/30">No active competitions right now.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Leave Competition confirmation dialog */}
      <Dialog open={!!leaveTarget} onOpenChange={(open) => { if (!open) { setLeaveTarget(null); setLeaveConfirmText(""); } }}>
        <DialogContent className="bg-[#111] border border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Leave Competition
            </DialogTitle>
            <DialogDescription className="text-white/60 pt-1">
              You are about to leave <span className="text-white font-medium">{leaveTarget?.title}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 space-y-1">
              <p className="text-sm text-red-300 font-medium">Warning — this action will:</p>
              <ul className="text-sm text-red-300/80 list-disc list-inside space-y-1">
                <li>Remove all your votes from this competition</li>
                <li>Clear your ranking and leaderboard status</li>
                <li>Require re-applying if you want to re-enter</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-white/50">Type <span className="font-mono text-white">Leave Competition</span> to confirm:</p>
              <Input
                value={leaveConfirmText}
                onChange={(e) => setLeaveConfirmText(e.target.value)}
                placeholder="Leave Competition"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                data-testid="input-leave-confirm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => { setLeaveTarget(null); setLeaveConfirmText(""); }} className="text-white/50">
              Cancel
            </Button>
            <Button
              onClick={() => leaveTarget && leaveMutation.mutate(leaveTarget.contestantId)}
              disabled={leaveConfirmText !== "Leave Competition" || leaveMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white border-0 disabled:opacity-40"
              data-testid="button-confirm-leave"
            >
              {leaveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Leave Competition"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
