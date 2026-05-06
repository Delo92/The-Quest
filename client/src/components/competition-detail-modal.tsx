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
import { Mail, MapPin, Download, Save, Pencil, X, ChevronDown, ChevronUp, Image, Film } from "lucide-react";

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
  vimeoVideos?: { uri: string; name: string; link: string; pictures?: { base_link?: string } }[];
}

export function CompetitionDetailModal({ compId }: { compId: number }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [expandedProfileId, setExpandedProfileId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [voteCost, setVoteCost] = useState("");
  const [maxVotesPerDay, setMaxVotesPerDay] = useState("");
  const [maxImages, setMaxImages] = useState("");
  const [maxVideos, setMaxVideos] = useState("");
  const [onlineVoteWeight, setOnlineVoteWeight] = useState("");

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
      <div className="flex items-center justify-center py-12" data-testid="comp-detail-loading">
        <div className="text-white/40 text-sm">Loading competition details...</div>
      </div>
    );
  }

  if (!data) return <div className="text-white/40 text-sm py-8 text-center">Failed to load details.</div>;

  const { competition, totalVotes, createdByAdmin, hosts, contestants } = data;

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1" data-testid="comp-detail-content">
      <div className="rounded-md bg-white/5 border border-white/5 p-4" data-testid="comp-detail-info">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs uppercase tracking-widest text-orange-400 font-bold">Competition Info</h3>
          {!editing ? (
            <Button size="sm" variant="ghost" className="text-orange-400 h-7 px-2" onClick={() => setEditing(true)} data-testid="button-edit-comp">
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="text-white/40 h-7 px-2" onClick={() => setEditing(false)} data-testid="button-cancel-edit">
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" className="bg-gradient-to-r from-orange-500 to-amber-500 text-white h-7 px-3" onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-comp">
                <Save className="h-3.5 w-3.5 mr-1" /> {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-white/40">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-white/[0.07] border-white/15 text-white mt-1" data-testid="input-comp-title" />
            </div>
            <div>
              <Label className="text-xs text-white/40">Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="bg-white/[0.07] border-white/15 text-white mt-1 resize-none" rows={3} data-testid="input-comp-description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-white/40">Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-white/[0.07] border-white/15 text-white mt-1" data-testid="input-comp-start" />
              </div>
              <div>
                <Label className="text-xs text-white/40">End Date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-white/[0.07] border-white/15 text-white mt-1" data-testid="input-comp-end" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-white/40">Vote Cost ($)</Label>
                <Input type="number" step="0.01" min={platformSettings?.defaultVoteCost ?? 0} value={voteCost} onChange={(e) => setVoteCost(e.target.value)} className="bg-white/[0.07] border-white/15 text-white mt-1" data-testid="input-comp-vote-cost" />
                {(platformSettings?.defaultVoteCost ?? 0) > 0 && (
                  <p className="text-orange-400/70 text-[10px] mt-0.5">Min: ${(platformSettings?.defaultVoteCost ?? 0).toFixed(2)}</p>
                )}
              </div>
              <div>
                <Label className="text-xs text-white/40">Max Votes/Day</Label>
                <Input type="number" min="1" value={maxVotesPerDay} onChange={(e) => setMaxVotesPerDay(e.target.value)} className="bg-white/[0.07] border-white/15 text-white mt-1" data-testid="input-comp-max-votes" />
              </div>
              <div>
                <Label className="text-xs text-white/40">Online Weight %</Label>
                <Input type="number" min="0" max="100" value={onlineVoteWeight} onChange={(e) => setOnlineVoteWeight(e.target.value)} className="bg-white/[0.07] border-white/15 text-white mt-1" data-testid="input-comp-vote-weight" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-white/40">Max Photos per Contestant</Label>
                <Input type="number" min="1" value={maxImages} onChange={(e) => setMaxImages(e.target.value)} placeholder="Unlimited" className="bg-white/[0.07] border-white/15 text-white mt-1" data-testid="input-comp-max-images" />
              </div>
              <div>
                <Label className="text-xs text-white/40">Max Videos per Contestant</Label>
                <Input type="number" min="1" value={maxVideos} onChange={(e) => setMaxVideos(e.target.value)} placeholder="Unlimited" className="bg-white/[0.07] border-white/15 text-white mt-1" data-testid="input-comp-max-videos" />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-white/40">Title</p>
                <p className="font-medium" data-testid="comp-detail-title">{competition.title}</p>
              </div>
              <div>
                <p className="text-xs text-white/40">Category</p>
                <p className="font-medium" data-testid="comp-detail-category">{competition.category}</p>
              </div>
              <div>
                <p className="text-xs text-white/40">Status</p>
                <Badge className={`border-0 ${competition.status === "active" || competition.status === "voting" ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/60"}`} data-testid="comp-detail-status">
                  {competition.status === "voting" ? "Active" : competition.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-white/40">Total Votes</p>
                <p className="font-bold text-lg bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent" data-testid="comp-detail-votes">{totalVotes}</p>
              </div>
            </div>
            {competition.description && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <p className="text-xs text-white/40 mb-1">Description</p>
                <p className="text-sm text-white/70 whitespace-pre-wrap">{competition.description}</p>
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {competition.startDate && (
                <div>
                  <p className="text-[10px] text-white/40">Start</p>
                  <p className="text-xs text-white/70">{new Date(competition.startDate).toLocaleDateString()}</p>
                </div>
              )}
              {competition.endDate && (
                <div>
                  <p className="text-[10px] text-white/40">End</p>
                  <p className="text-xs text-white/70">{new Date(competition.endDate).toLocaleDateString()}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-white/40">Vote Cost</p>
                <p className="text-xs text-white/70">${competition.voteCost}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/40">Max Votes/Day</p>
                <p className="text-xs text-white/70">{competition.maxVotesPerDay}</p>
              </div>
            </div>
          </>
        )}

        <div className="mt-4 pt-3 border-t border-white/5">
          <Button
            variant="outline"
            size="sm"
            className="border-orange-500/30 text-orange-400"
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
            <Download className="h-4 w-4 mr-2" /> Download QR Code
          </Button>
        </div>
      </div>

      <div className="rounded-md bg-white/5 border border-white/5 p-4" data-testid="comp-detail-vote-breakdown">
        <h3 className="text-xs uppercase tracking-widest text-orange-400 font-bold mb-3">Vote Breakdown</h3>
        {breakdown && (breakdown.online > 0 || breakdown.inPerson > 0) ? (
          <div>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                <span className="text-white/60">Online: <span className="text-white font-medium">{breakdown.online}</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                <span className="text-white/60">In-Person: <span className="text-white font-medium">{breakdown.inPerson}</span></span>
              </div>
              {breakdown.onlineVoteWeight < 100 && (
                <span className="text-white/30 text-[10px]">Online weight: {breakdown.onlineVoteWeight}%</span>
              )}
            </div>
            {breakdown.total > 0 && (
              <div className="mt-1.5 h-1.5 rounded-full bg-white/5 overflow-hidden flex">
                <div className="bg-blue-400 h-full" style={{ width: `${(breakdown.online / breakdown.total) * 100}%` }} />
                <div className="bg-orange-400 h-full" style={{ width: `${(breakdown.inPerson / breakdown.total) * 100}%` }} />
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-white/30">No votes recorded yet.</p>
        )}
      </div>

      <div className="flex items-center justify-between rounded-md bg-white/[0.04] border border-white/10 px-3 py-2.5">
        <div>
          <p className="text-xs text-white/70 font-medium">In-Person Only Event</p>
          <p className="text-[10px] text-white/30">Only QR code votes accepted when enabled</p>
        </div>
        <Switch
          checked={breakdown?.inPersonOnly || false}
          onCheckedChange={(v) => toggleInPersonMutation.mutate(v)}
          disabled={toggleInPersonMutation.isPending}
          className="data-[state=checked]:bg-orange-500"
          data-testid={`toggle-in-person-modal-${compId}`}
        />
      </div>

      <div className="rounded-md bg-white/5 border border-white/5 p-4" data-testid="comp-detail-hosts">
        <h3 className="text-xs uppercase tracking-widest text-orange-400 font-bold mb-3">Host(s)</h3>
        {createdByAdmin ? (
          <div className="flex items-center gap-2 rounded-md bg-orange-500/10 border border-orange-500/20 p-3" data-testid="comp-hosted-by-admin">
            <Badge className="border-0 bg-orange-500/20 text-orange-400">Admin</Badge>
            <p className="text-sm text-white/70">Hosted by Admin</p>
          </div>
        ) : hosts.length > 0 ? (
          <div className="space-y-2">
            {hosts.map((host) => (
              <div key={host.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white/5 p-3" data-testid={`comp-host-${host.id}`}>
                <div>
                  <p className="font-medium text-sm">{host.fullName}</p>
                  <p className="text-xs text-white/30">{host.email} {host.organization && `| ${host.organization}`}</p>
                </div>
                <Badge className={`border-0 ${host.status === "approved" ? "bg-green-500/20 text-green-400" : host.status === "rejected" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                  {host.status}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/30">No host assigned to this competition.</p>
        )}
      </div>

      <div data-testid="comp-detail-contestants">
        <h3 className="text-xs uppercase tracking-widest text-orange-400 font-bold mb-3">Contestants ({contestants.length})</h3>
        {contestants.length > 0 ? (
          <div className="space-y-2">
            {contestants.map((c) => {
              const isExpanded = expandedProfileId === c.talentProfileId;
              const epd = isExpanded ? expandedProfileData : null;
              const epImages = epd?.profile?.imageUrls ?? c.imageUrls ?? [];
              const epVideos = isExpanded ? (expandedVideosData?.vimeoVideos ?? []) : [];
              return (
                <div key={c.id} className="rounded-md bg-white/5 border border-white/5 overflow-hidden" data-testid={`comp-contestant-${c.id}`}>
                  <button
                    className="w-full flex flex-wrap items-center justify-between gap-3 p-3 text-left hover:bg-white/[0.04] transition-colors"
                    onClick={() => setExpandedProfileId(isExpanded ? null : c.talentProfileId)}
                    data-testid={`button-expand-contestant-${c.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={c.imageUrls?.[0] || ""} />
                        <AvatarFallback className="bg-orange-500/20 text-orange-400 text-xs font-bold">
                          {c.displayName?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-sm" data-testid={`contestant-name-${c.id}`}>{c.displayName}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          {c.stageName && <span className="text-xs text-white/40" data-testid={`contestant-stage-${c.id}`}>{c.stageName}</span>}
                          {c.category && <span className="text-xs text-white/30">{c.category}</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-0.5">
                          {c.email && (
                            <span className="flex items-center gap-1 text-[11px] text-orange-400/70 truncate" data-testid={`contestant-email-${c.id}`}>
                              <Mail className="h-3 w-3 shrink-0" /> {c.email}
                            </span>
                          )}
                          {c.location && (
                            <span className="flex items-center gap-1 text-[11px] text-white/30" data-testid={`contestant-location-${c.id}`}>
                              <MapPin className="h-3 w-3 shrink-0" /> {c.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent" data-testid={`contestant-votes-${c.id}`}>{c.voteCount}</p>
                        <p className="text-[10px] text-white/30">votes</p>
                      </div>
                      <Badge className={`border-0 text-xs ${c.applicationStatus === "approved" ? "bg-green-500/20 text-green-400" : c.applicationStatus === "rejected" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`} data-testid={`contestant-status-${c.id}`}>
                        {c.applicationStatus}
                      </Badge>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-white/30 shrink-0" /> : <ChevronDown className="h-4 w-4 text-white/30 shrink-0" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-white/5 bg-black/20 p-3 space-y-3">
                      {expandedLoading ? (
                        <p className="text-xs text-white/30 text-center py-2">Loading profile...</p>
                      ) : (
                        <>
                          {epd?.profile?.bio && (
                            <p className="text-xs text-white/50 leading-relaxed">{epd.profile.bio}</p>
                          )}
                          {epImages.length > 0 && (
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2 flex items-center gap-1"><Image className="h-3 w-3" /> Photos ({epImages.length})</p>
                              <div className="flex gap-2 overflow-x-auto pb-1">
                                {epImages.map((url, i) => (
                                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                    <img
                                      src={url}
                                      alt={`photo-${i + 1}`}
                                      className="h-24 w-24 object-cover rounded-md border border-white/10 hover:border-orange-500/50 transition-colors"
                                    />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                          {epVideos.length > 0 && (
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2 flex items-center gap-1"><Film className="h-3 w-3" /> Videos ({epVideos.length})</p>
                              <div className="flex gap-2 overflow-x-auto pb-1">
                                {epVideos.map((v, i) => (
                                  <a key={i} href={v.link} target="_blank" rel="noopener noreferrer" className="shrink-0 group relative">
                                    {v.pictures?.base_link ? (
                                      <img
                                        src={`${v.pictures.base_link}_295x166`}
                                        alt={v.name}
                                        className="h-20 w-36 object-cover rounded-md border border-white/10 group-hover:border-orange-500/50 transition-colors"
                                      />
                                    ) : (
                                      <div className="h-20 w-36 rounded-md bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-orange-500/50 transition-colors">
                                        <Film className="h-6 w-6 text-white/20" />
                                      </div>
                                    )}
                                    <p className="text-[10px] text-white/40 mt-1 truncate w-36">{v.name}</p>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                          {epImages.length === 0 && epVideos.length === 0 && !expandedLoading && (
                            <p className="text-xs text-white/30 text-center py-1">No photos or videos uploaded yet.</p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-md bg-white/5 border border-white/5 p-4 text-center">
            <p className="text-sm text-white/30">No contestants in this competition.</p>
          </div>
        )}
      </div>
    </div>
  );
}
