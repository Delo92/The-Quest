import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAuthToken } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Mail, MapPin, Download, Save, Pencil, X, ChevronDown, ChevronUp, Image, Film, Search, Settings, Users, ArrowUpRight, BarChart3, Clock, CalendarDays } from "lucide-react";

interface CompDetailResponse {
  competition: {
    id: number;
    title: string;
    description: string | null;
    category: string;
    status: string;
    voteCost: number;
    maxVotesPerDay: number;
    maxImagesPerContestant: number | null;
    maxVideosPerContestant: number | null;
    startDate: string | null;
    endDate: string | null;
    onlineVoteWeight: number;
    inPersonOnly: boolean;
  };
  totalVotes: number;
  createdByAdmin?: boolean;
  hosts: {
    id: number;
    fullName: string;
    email: string;
    organization?: string;
    status: string;
  }[];
  contestants: {
    id: number;
    talentProfileId: number;
    applicationStatus: string;
    displayName: string;
    stageName?: string;
    category?: string;
    imageUrls?: string[];
    email?: string;
    location?: string;
    voteCount: number;
  }[];
}

interface ContestantProfileDetail {
  profile: {
    displayName: string;
    stageName?: string;
    bio?: string;
    location?: string;
    category?: string;
    imageUrls?: string[];
    imageBackupUrls?: string[];
  };
  vimeoVideos?: { uri: string; name: string; link: string; embedUrl?: string; thumbnail?: string | null }[];
}

export function CompetitionDetailModal({ compId }: { compId: number }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"overview" | "contestants">("overview");
  const [editing, setEditing] = useState(false);
  const [expandedProfileId, setExpandedProfileId] = useState<number | null>(null);

  // Edit form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [voteCost, setVoteCost] = useState("");
  const [maxVotesPerDay, setMaxVotesPerDay] = useState("");
  const [maxImages, setMaxImages] = useState("");
  const [maxVideos, setMaxVideos] = useState("");
  const [onlineVoteWeight, setOnlineVoteWeight] = useState("");

  // Search/filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data, isLoading } = useQuery<CompDetailResponse>({
    queryKey: ["/api/competitions", compId, "detail"],
  });

  const { data: breakdown } = useQuery<{ online: number; inPerson: number; total: number; onlineVoteWeight: number; inPersonOnly: boolean }>({
    queryKey: ["/api/competitions", compId, "vote-breakdown"],
  });

  const { data: platformSettings } = useQuery<any>({
    queryKey: ["/api/platform-settings"],
  });

  const { data: expandedProfileData, isLoading: expandedLoading } = useQuery<ContestantProfileDetail>({
    queryKey: ["/api/admin/users", expandedProfileId, "detail"],
    enabled: expandedProfileId !== null,
    staleTime: 60_000,
  });

  const { data: expandedVideosData } = useQuery<{ vimeoVideos: ContestantProfileDetail["vimeoVideos"] }>({
    queryKey: ["/api/admin/users", expandedProfileId, "videos"],
    enabled: expandedProfileId !== null && !!expandedProfileData,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (data?.competition) {
      const c = data.competition;
      setTitle(c.title || "");
      setDescription(c.description || "");
      setStartDate(c.startDate ? c.startDate.split("T")[0] : "");
      setEndDate(c.endDate ? c.endDate.split("T")[0] : "");
      setVoteCost(String(c.voteCost ?? 1));
      setMaxVotesPerDay(String(c.maxVotesPerDay ?? 10));
      setMaxImages(String(c.maxImagesPerContestant ?? ""));
      setMaxVideos(String(c.maxVideosPerContestant ?? ""));
      setOnlineVoteWeight(String(c.onlineVoteWeight ?? 100));
    }
  }, [data]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/competitions", compId, "detail"] });
    queryClient.invalidateQueries({ queryKey: ["/api/competitions", compId, "vote-breakdown"] });
    queryClient.invalidateQueries({ queryKey: ["/api/host/competitions"] });
  };

  const saveMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      await apiRequest("PATCH", `/api/competitions/${compId}`, updates);
    },
    onSuccess: () => {
      invalidateAll();
      setEditing(false);
      toast({ title: "Competition updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const toggleInPersonMutation = useMutation({
    mutationFn: async (value: boolean) => {
      await apiRequest("PATCH", `/api/competitions/${compId}`, { inPersonOnly: value });
    },
    onSuccess: () => invalidateAll(),
  });

  const handleSave = () => {
    saveMutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
      startDate: startDate || null,
      endDate: endDate || null,
      voteCost: parseFloat(voteCost) || 1,
      maxVotesPerDay: parseInt(maxVotesPerDay) || 10,
      maxImagesPerContestant: maxImages ? parseInt(maxImages) : null,
      maxVideosPerContestant: maxVideos ? parseInt(maxVideos) : null,
      onlineVoteWeight: parseInt(onlineVoteWeight) || 100,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="comp-detail-loading">
        <div className="text-white/40 text-sm flex flex-col items-center gap-2">
          <div className="h-4 w-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          Loading competition workspace...
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-white/40 text-sm py-8 text-center">Failed to load details.</div>;

  const { competition, totalVotes, createdByAdmin, hosts, contestants } = data;

  const filteredContestants = contestants.filter(c => {
    if (statusFilter !== "all" && c.applicationStatus !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!c.displayName?.toLowerCase().includes(q) &&
          !c.stageName?.toLowerCase().includes(q) &&
          !c.email?.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-zinc-950 sm:bg-transparent" data-testid="comp-detail-content">
      {/* Workspace Header - Desktop hidden inside modal header, mobile visible */}
      <div className="px-4 py-3 sm:px-0 sm:py-0 sm:mb-5 border-b border-white/10 sm:border-0 shrink-0 bg-zinc-900/50 sm:bg-transparent">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Badge className={`border-0 px-2 py-1 ${competition.status === "active" || competition.status === "voting" ? "bg-green-500/10 text-green-400" : "bg-white/5 text-white/50"}`} data-testid="comp-detail-status">
              <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current" />
              {competition.status === "voting" ? "Active" : competition.status.charAt(0).toUpperCase() + competition.status.slice(1)}
            </Badge>
            <span className="text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-md hidden sm:inline-block">
              {competition.title}
            </span>
          </div>

          <div className="flex bg-white/5 rounded-lg p-1 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-2 ${
                activeTab === "overview" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              <Settings className="w-3.5 h-3.5" /> Overview
            </button>
            <button
              onClick={() => setActiveTab("contestants")}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-2 ${
                activeTab === "contestants" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Contestants
              <Badge className="ml-1 bg-white/10 text-white/70 border-0 text-[10px] px-1.5 h-4 py-0 font-mono">
                {contestants.length}
              </Badge>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-0 scrollbar-hide">
        {activeTab === "overview" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6 max-w-4xl mx-auto pb-8">

            {/* High-level metrics row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 flex flex-col justify-between">
                <span className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2">Total Votes</span>
                <span className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent" data-testid="comp-detail-votes">{totalVotes.toLocaleString()}</span>
              </div>
              <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 flex flex-col justify-between">
                <span className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2">Contestants</span>
                <span className="text-2xl font-bold text-white/90">{contestants.length}</span>
              </div>
              <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 flex flex-col justify-between">
                <span className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2 flex items-center gap-1">
                  <BarChart3 className="w-3.5 h-3.5" /> Revenue Est.
                </span>
                <span className="text-2xl font-bold text-green-400/90">${(totalVotes * (competition.voteCost ?? 1)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
              <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 flex flex-col justify-between">
                <span className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Max Votes
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-white/90">{competition.maxVotesPerDay}</span>
                  <span className="text-xs text-white/40">/day</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">

                {/* Competition Details Panel */}
                <div className="rounded-xl bg-zinc-900 border border-white/10 overflow-hidden" data-testid="comp-detail-info">
                  <div className="border-b border-white/10 bg-white/5 px-5 py-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white/90">Competition Settings</h3>
                    {!editing ? (
                      <Button size="sm" variant="ghost" className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 h-7 px-3 text-xs" onClick={() => setEditing(true)} data-testid="button-edit-comp">
                        <Pencil className="h-3 w-3 mr-1.5" /> Edit Settings
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" className="text-white/50 hover:text-white h-7 px-3 text-xs" onClick={() => setEditing(false)} data-testid="button-cancel-edit">
                          Cancel
                        </Button>
                        <Button size="sm" className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white h-7 px-4 text-xs font-bold border-0" onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-comp">
                          <Save className="h-3 w-3 mr-1.5" /> {saveMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    {editing ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="md:col-span-2 space-y-1.5">
                            <Label className="text-xs text-white/50 uppercase tracking-wider font-semibold">Title</Label>
                            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-black/20 border-white/10 text-white focus:border-orange-500/50 transition-colors" data-testid="input-comp-title" />
                          </div>

                          <div className="md:col-span-2 space-y-1.5">
                            <Label className="text-xs text-white/50 uppercase tracking-wider font-semibold">Description</Label>
                            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="bg-black/20 border-white/10 text-white focus:border-orange-500/50 transition-colors min-h-[100px]" data-testid="input-comp-description" />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs text-white/50 uppercase tracking-wider font-semibold">Start Date</Label>
                            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-black/20 border-white/10 text-white focus:border-orange-500/50 transition-colors [&::-webkit-calendar-picker-indicator]:invert-[0.8]" data-testid="input-comp-start" />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs text-white/50 uppercase tracking-wider font-semibold">End Date</Label>
                            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-black/20 border-white/10 text-white focus:border-orange-500/50 transition-colors [&::-webkit-calendar-picker-indicator]:invert-[0.8]" data-testid="input-comp-end" />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs text-white/50 uppercase tracking-wider font-semibold">Vote Cost ($)</Label>
                            <Input type="number" step="0.01" min={platformSettings?.defaultVoteCost ?? 0} value={voteCost} onChange={(e) => setVoteCost(e.target.value)} className="bg-black/20 border-white/10 text-white focus:border-orange-500/50 transition-colors" data-testid="input-comp-vote-cost" />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs text-white/50 uppercase tracking-wider font-semibold">Max Votes/Day</Label>
                            <Input type="number" min="1" value={maxVotesPerDay} onChange={(e) => setMaxVotesPerDay(e.target.value)} className="bg-black/20 border-white/10 text-white focus:border-orange-500/50 transition-colors" data-testid="input-comp-max-votes" />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs text-white/50 uppercase tracking-wider font-semibold">Max Photos (per profile)</Label>
                            <Input type="number" min="1" value={maxImages} onChange={(e) => setMaxImages(e.target.value)} placeholder="Unlimited" className="bg-black/20 border-white/10 text-white focus:border-orange-500/50 transition-colors" data-testid="input-comp-max-images" />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs text-white/50 uppercase tracking-wider font-semibold">Max Videos (per profile)</Label>
                            <Input type="number" min="1" value={maxVideos} onChange={(e) => setMaxVideos(e.target.value)} placeholder="Unlimited" className="bg-black/20 border-white/10 text-white focus:border-orange-500/50 transition-colors" data-testid="input-comp-max-videos" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Title</p>
                          <p className="text-sm font-medium text-white/90" data-testid="comp-detail-title">{competition.title}</p>
                        </div>

                        {competition.description && (
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Description</p>
                            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap max-w-3xl">{competition.description}</p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-5 gap-x-4">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1 flex items-center gap-1.5"><CalendarDays className="w-3 h-3" /> Start</p>
                            <p className="text-sm text-white/80">{competition.startDate ? new Date(competition.startDate).toLocaleDateString() : '—'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1 flex items-center gap-1.5"><CalendarDays className="w-3 h-3" /> End</p>
                            <p className="text-sm text-white/80">{competition.endDate ? new Date(competition.endDate).toLocaleDateString() : '—'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Vote Cost</p>
                            <p className="text-sm text-white/80">${competition.voteCost}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Category</p>
                            <p className="text-sm text-white/80" data-testid="comp-detail-category">{competition.category || 'Uncategorized'}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Sidebar items */}
              <div className="space-y-6">

                {/* Voting Analytics */}
                <div className="rounded-xl bg-zinc-900 border border-white/10 p-5" data-testid="comp-detail-vote-breakdown">
                  <h3 className="text-sm font-semibold text-white/90 mb-4">Voting Methods</h3>

                  {breakdown && (breakdown.online > 0 || breakdown.inPerson > 0) ? (
                    <div className="space-y-5">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-white/70"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Online Votes</span>
                          <span className="font-bold">{breakdown.online.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-white/70"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> In-Person Votes</span>
                          <span className="font-bold">{breakdown.inPerson.toLocaleString()}</span>
                        </div>
                      </div>

                      {breakdown.total > 0 && (
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden flex w-full">
                          <div className="bg-blue-500 h-full" style={{ width: `${(breakdown.online / breakdown.total) * 100}%` }} />
                          <div className="bg-orange-500 h-full" style={{ width: `${(breakdown.inPerson / breakdown.total) * 100}%` }} />
                        </div>
                      )}

                      {editing && (
                        <div className="pt-4 border-t border-white/5">
                          <Label className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2 block">Online Vote Weight %</Label>
                          <div className="flex items-center gap-3">
                            <Input type="number" min="0" max="100" value={onlineVoteWeight} onChange={(e) => setOnlineVoteWeight(e.target.value)} className="bg-black/20 border-white/10 text-white w-24 h-8" data-testid="input-comp-vote-weight" />
                            <span className="text-[10px] text-white/30 leading-tight">Lower this to favor in-person voting</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-6 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-lg">
                      <BarChart3 className="w-6 h-6 text-white/10 mb-2" />
                      <p className="text-xs text-white/40">No votes recorded yet</p>
                    </div>
                  )}
                </div>

                {/* Operations & Hosting */}
                <div className="rounded-xl bg-zinc-900 border border-white/10 p-5 space-y-5">
                  <div className="flex items-center justify-between group">
                    <div className="pr-4">
                      <p className="text-sm font-semibold text-white/90">In-Person Only Mode</p>
                      <p className="text-xs text-white/40 mt-0.5">Disable online voting globally</p>
                    </div>
                    <Switch
                      checked={breakdown?.inPersonOnly || false}
                      onCheckedChange={(v) => toggleInPersonMutation.mutate(v)}
                      disabled={toggleInPersonMutation.isPending}
                      className="data-[state=checked]:bg-orange-500 shrink-0"
                      data-testid={`toggle-in-person-modal-${compId}`}
                    />
                  </div>

                  <div className="pt-4 border-t border-white/5" data-testid="comp-detail-hosts">
                    <h4 className="text-xs uppercase tracking-widest text-white/40 font-bold mb-3">Hosts</h4>
                    {createdByAdmin ? (
                      <div className="flex items-center gap-3 rounded-lg bg-white/5 border border-white/10 p-3" data-testid="comp-hosted-by-admin">
                        <div className="h-8 w-8 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-xs">
                          AD
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white/90">Platform Admin</p>
                          <p className="text-[10px] text-orange-400">Owner</p>
                        </div>
                      </div>
                    ) : hosts.length > 0 ? (
                      <div className="space-y-2">
                        {hosts.map((host) => (
                          <div key={host.id} className="flex flex-col gap-2 rounded-lg bg-white/5 border border-white/10 p-3" data-testid={`comp-host-${host.id}`}>
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium text-sm text-white/90">{host.fullName}</p>
                                <p className="text-xs text-white/40 truncate mt-0.5">{host.email}</p>
                              </div>
                              <Badge className={`border-0 shrink-0 capitalize ${host.status === "approved" ? "bg-green-500/10 text-green-400" : host.status === "rejected" ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                                {host.status}
                              </Badge>
                            </div>
                            {host.organization && <p className="text-[10px] text-white/30 uppercase tracking-widest">{host.organization}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-white/30 italic">No host assigned</p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-white/5">
                    <Button
                      variant="outline"
                      className="w-full justify-between border-white/10 hover:border-orange-500/30 hover:bg-orange-500/5 text-white/80 hover:text-orange-400"
                      onClick={async () => {
                        try {
                          const token = getAuthToken();
                          const res = await fetch(`/api/competitions/${compId}/qrcode`, {
                            headers: token ? { Authorization: `Bearer ${token}` } : {},
                          });
                          if (!res.ok) throw new Error("Failed to download QR code");
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `qr-${competition.title.toLowerCase().replace(/\s+/g, "-")}.png`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch (err) {
                          console.error("QR download error:", err);
                        }
                      }}
                      data-testid="comp-detail-qr-download"
                    >
                      <span className="flex items-center"><Download className="h-4 w-4 mr-2 text-white/40 group-hover:text-orange-400" /> Event QR Code</span>
                      <ArrowUpRight className="h-3.5 w-3.5 opacity-50" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "contestants" && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-300 flex flex-col h-full" data-testid="comp-detail-contestants">
            {/* Filtering Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <Input
                  placeholder="Search name, email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 bg-zinc-900 border-white/10 text-sm h-10 w-full focus-visible:ring-1 focus-visible:ring-orange-500"
                />
              </div>
              <div className="flex bg-zinc-900 rounded-md p-1 border border-white/10 shrink-0 overflow-x-auto">
                {["all", "approved", "pending", "rejected"].map(status => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 text-xs capitalize font-medium rounded-sm whitespace-nowrap transition-colors ${statusFilter === status ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/80"}`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* List area */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 pb-10">
              {filteredContestants.length > 0 ? (
                filteredContestants.map((c) => {
                  const isExpanded = expandedProfileId === c.talentProfileId;
                  const epd = isExpanded ? expandedProfileData : null;
                  const epImages = epd?.profile?.imageUrls ?? c.imageUrls ?? [];
                  const epVideos = isExpanded ? (expandedVideosData?.vimeoVideos ?? []) : [];
                  return (
                    <div key={c.id} className="rounded-xl bg-zinc-900 border border-white/5 hover:border-white/10 transition-colors overflow-hidden group" data-testid={`comp-contestant-${c.id}`}>
                      <button
                        className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-4 text-left focus:outline-none"
                        onClick={() => setExpandedProfileId(isExpanded ? null : c.talentProfileId)}
                        data-testid={`button-expand-contestant-${c.id}`}
                      >
                        <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1 w-full">
                          <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border border-white/10 shrink-0">
                            <AvatarImage src={c.imageUrls?.[0] || ""} className="object-cover" />
                            <AvatarFallback className="bg-orange-500/10 text-orange-400 text-sm font-bold">
                              {c.displayName?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between sm:justify-start gap-3">
                              <p className="font-bold text-sm sm:text-base text-white/95 truncate" data-testid={`contestant-name-${c.id}`}>{c.displayName}</p>
                              {/* Mobile vote count overlay */}
                              <div className="sm:hidden flex items-center gap-1.5 shrink-0 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                                <span className="text-xs font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">{c.voteCount}</span>
                                <span className="text-[9px] text-white/40 uppercase tracking-widest">Votes</span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                              {c.stageName && <span className="text-xs text-orange-400/80 font-medium" data-testid={`contestant-stage-${c.id}`}>{c.stageName}</span>}
                              {c.category && (
                                <span className="flex items-center text-[11px] text-white/50">
                                  <span className="w-1 h-1 rounded-full bg-white/20 mr-1.5" />
                                  {c.category}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 mt-1.5">
                              {c.email && (
                                <span className="flex items-center gap-1.5 text-[11px] text-white/40 truncate" data-testid={`contestant-email-${c.id}`}>
                                  <Mail className="h-3 w-3 shrink-0 opacity-50" /> {c.email}
                                </span>
                              )}
                              {c.location && (
                                <span className="flex items-center gap-1.5 text-[11px] text-white/40" data-testid={`contestant-location-${c.id}`}>
                                  <MapPin className="h-3 w-3 shrink-0 opacity-50" /> {c.location}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="hidden sm:flex items-center gap-6 shrink-0 pl-4 border-l border-white/5 ml-4">
                          <div className="text-right min-w-[70px]">
                            <p className="text-lg font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent" data-testid={`contestant-votes-${c.id}`}>{c.voteCount.toLocaleString()}</p>
                            <p className="text-[9px] text-white/30 uppercase tracking-widest">Votes</p>
                          </div>
                          <Badge className={`border-0 w-20 justify-center text-xs font-medium ${c.applicationStatus === "approved" ? "bg-green-500/10 text-green-400" : c.applicationStatus === "rejected" ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-400"}`} data-testid={`contestant-status-${c.id}`}>
                            {c.applicationStatus}
                          </Badge>
                          <div className="w-6 flex justify-end">
                            {isExpanded ? <ChevronUp className="h-5 w-5 text-white/20 group-hover:text-white/50 transition-colors" /> : <ChevronDown className="h-5 w-5 text-white/20 group-hover:text-white/50 transition-colors" />}
                          </div>
                        </div>

                        {/* Mobile Status Badge row */}
                        <div className="sm:hidden flex items-center justify-between w-full mt-3 pt-3 border-t border-white/5">
                           <Badge className={`border-0 text-[10px] font-medium ${c.applicationStatus === "approved" ? "bg-green-500/10 text-green-400" : c.applicationStatus === "rejected" ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-400"}`} data-testid={`contestant-status-${c.id}`}>
                            {c.applicationStatus}
                          </Badge>
                          <div className="flex items-center gap-1 text-[10px] text-white/40 uppercase tracking-widest">
                            {isExpanded ? "Close Profile" : "View Profile"}
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-white/5 bg-black/40 p-4 sm:p-5">
                          {expandedLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <div className="h-4 w-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : (
                            <div className="space-y-5">
                              {epd?.profile?.bio && (
                                <div className="space-y-1.5">
                                  <h5 className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Biography</h5>
                                  <p className="text-sm text-white/70 leading-relaxed max-w-4xl">{epd.profile.bio}</p>
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {epImages.length > 0 && (
                                  <div className="space-y-2">
                                    <h5 className="text-[10px] uppercase tracking-widest text-white/40 font-bold flex items-center gap-1.5"><Image className="h-3.5 w-3.5" /> Photos ({epImages.length})</h5>
                                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                      {epImages.map((url, i) => (
                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 relative group rounded-lg overflow-hidden border border-white/10 w-24 h-24 block">
                                          <img
                                            src={url}
                                            alt={`photo-${i + 1}`}
                                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                                          />
                                          <div className="absolute inset-0 bg-orange-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <ArrowUpRight className="h-5 w-5 text-white" />
                                          </div>
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {epVideos.length > 0 && (
                                  <div className="space-y-2">
                                    <h5 className="text-[10px] uppercase tracking-widest text-white/40 font-bold flex items-center gap-1.5"><Film className="h-3.5 w-3.5" /> Videos ({epVideos.length})</h5>
                                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                      {epVideos.map((v, i) => (
                                        <a key={i} href={v.link} target="_blank" rel="noopener noreferrer" className="shrink-0 group w-40 flex flex-col gap-1.5">
                                          <div className="relative rounded-lg overflow-hidden border border-white/10 w-40 h-24 bg-white/5">
                                            {v.thumbnail ? (
                                              <img
                                                src={v.thumbnail}
                                                alt={v.name}
                                                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                                              />
                                            ) : (
                                              <div className="absolute inset-0 flex items-center justify-center">
                                                <Film className="h-6 w-6 text-white/20 group-hover:text-white/40 transition-colors" />
                                              </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                              <ArrowUpRight className="h-5 w-5 text-white" />
                                            </div>
                                          </div>
                                          <p className="text-[10px] text-white/50 group-hover:text-white/80 transition-colors truncate w-full font-medium">{v.name}</p>
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {epImages.length === 0 && epVideos.length === 0 && !expandedLoading && (
                                <div className="py-6 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-lg">
                                  <Image className="h-6 w-6 text-white/10 mb-2" />
                                  <p className="text-xs text-white/40">No media uploaded</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 py-12 flex flex-col items-center justify-center text-center px-4">
                  <Users className="h-8 w-8 text-white/10 mb-3" />
                  <p className="text-sm font-medium text-white/70 mb-1">No contestants found</p>
                  <p className="text-xs text-white/40">Adjust your search or filter to see results.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
