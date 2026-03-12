import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Trophy, BarChart3, Users, Plus, Check, X as XIcon, LogOut, Vote, Flame, Image, Upload, RotateCcw, UserPlus, Megaphone, Settings, DollarSign, Eye, Search, ExternalLink, Music, Video, Calendar, Award, UserCheck, Mail, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, HardDrive, RefreshCw, FolderOpen, QrCode, MapPin, Download, Trash2, Copy, Share2, Star, Link2 } from "lucide-react";
import { detectMediaType, MEDIA_TYPE_LABELS, MEDIA_TYPE_COLORS } from "@/lib/media-utils";
import { InviteDialog, CreateUserDialog, InviteHostDialog } from "@/components/invite-dialog";
import { Switch } from "@/components/ui/switch";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Competition, SiteLivery } from "@shared/schema";
import { useState, useRef, useMemo, useEffect } from "react";
import { useAuth, getAuthToken } from "@/hooks/use-auth";
import { CompetitionDetailModal } from "@/components/competition-detail-modal";
import AdminAnalyticsTab from "@/components/admin-analytics-tab";

type CompetitionWithCreator = Competition & { createdBy?: string | null; coverVideo?: string | null };

interface AdminStats {
  totalCompetitions: number;
  totalTalentProfiles: number;
  totalContestants: number;
  totalVotes: number;
  pendingApplications: number;
}

interface ContestantAdmin {
  id: number;
  competitionId: number;
  talentProfileId: number;
  applicationStatus: string;
  appliedAt: string;
  competitionTitle: string;
  talentProfile: {
    id: number;
    displayName: string;
    bio: string | null;
    category: string | null;
    imageUrls: string[] | null;
  };
}

interface JoinHostSettings {
  mode: "request" | "purchase";
  price: number;
  pageTitle: string;
  pageDescription: string;
  requiredFields: string[];
  isActive: boolean;
  charityName?: string;
  charityPercentage?: number;
  nominationFee?: number;
  nominationEnabled?: boolean;
  nonprofitRequired?: boolean;
  freeNominationPromoCode?: string;
}

interface JoinSubmission {
  id: string;
  competitionId: number | null;
  fullName: string;
  email: string;
  phone: string | null;
  bio: string | null;
  category: string | null;
  status: "pending" | "approved" | "rejected";
  transactionId: string | null;
  amountPaid: number;
  createdAt: string;
  type?: "application" | "nomination";
  nominatorName?: string | null;
  nominatorEmail?: string | null;
  nominatorPhone?: string | null;
  nominationStatus?: "pending" | "joined" | "unsure" | "not_interested" | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  socialLinks?: string | null;
  chosenNonprofit?: string | null;
}

interface HostSubmission {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  organization: string | null;
  eventName: string;
  eventDescription: string | null;
  eventCategory: string | null;
  eventDate: string | null;
  status: "pending" | "approved" | "rejected";
  transactionId: string | null;
  amountPaid: number;
  createdAt: string;
}

interface HostProfile {
  id: number;
  userId: string;
  displayName: string;
  stageName: string | null;
  bio: string | null;
  category: string | null;
  imageUrls: string[];
  role: string;
  competitionCount: number;
  activeCompetitions: number;
}

interface HostCompetitionDetail {
  id: number;
  title: string;
  category: string;
  status: string;
  coverImage: string | null;
  startDate: string | null;
  endDate: string | null;
  contestants: {
    id: number;
    talentProfileId: number;
    applicationStatus: string;
    displayName: string;
    stageName: string | null;
    category: string | null;
    imageUrls: string[];
    voteCount: number;
  }[];
}


interface CalendarReportResponse {
  competition: Competition;
  totalVotes: number;
  totalContestants: number;
  totalRevenue: number;
  totalPurchasedVotes: number;
  totalPurchases: number;
  leaderboard: {
    rank: number;
    contestantId: number;
    talentProfileId: number;
    displayName: string;
    stageName: string | null;
    voteCount: number;
    votePercentage: number;
  }[];
}

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

interface VotingStat {
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
  profile: TalentUser & { email: string | null; level: number; socialLinks: string | null };
  activeStats: VotingStat[];
  pastStats: VotingStat[];
  upcomingEvents: VotingStat[];
  driveImages: DriveImage[];
  vimeoVideos: VimeoVideo[];
}


function TalentDetailModal({ profileId, competitions }: { profileId: number; competitions: Competition[] | undefined }) {
  const { toast } = useToast();
  const [assignCompId, setAssignCompId] = useState("");

  const { data, isLoading } = useQuery<UserDetailResponse>({
    queryKey: ["/api/admin/users", profileId, "detail"],
  });

  const assignMutation = useMutation({
    mutationFn: async ({ pId, competitionId }: { pId: number; competitionId: number }) => {
      await apiRequest("POST", `/api/admin/users/${pId}/assign`, { competitionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", profileId, "detail"] });
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
      await apiRequest("PATCH", `/api/admin/users/${userId}/level`, { level });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", profileId, "detail"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User level updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="user-detail-loading">
        <div className="text-white/40 text-sm">Loading talent details...</div>
      </div>
    );
  }

  if (!data) return <div className="text-white/40 text-sm py-8 text-center">Failed to load details.</div>;

  const { profile, activeStats, pastStats, upcomingEvents, driveImages, vimeoVideos } = data;

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

      <div className="rounded-md bg-white/5 border border-white/5 p-4" data-testid="user-detail-level-mgmt">
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
      </div>

      {(driveImages.length > 0 || vimeoVideos.length > 0) && (
        <div className="rounded-md bg-white/5 border border-white/5 p-4" data-testid="user-detail-media">
          <h3 className="text-xs uppercase tracking-widest text-orange-400 font-bold mb-3">Media</h3>
          {driveImages.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-white/40 mb-2 flex items-center gap-1"><Image className="h-3 w-3" /> Photos ({driveImages.length})</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {driveImages.slice(0, 8).map((img) => (
                  <a key={img.id} href={img.imageUrl} target="_blank" rel="noopener noreferrer" className="block" data-testid={`drive-img-${img.id}`}>
                    <img src={img.thumbnailUrl} alt={img.name} className="w-full aspect-square object-cover rounded-md" />
                  </a>
                ))}
              </div>
              {driveImages.length > 8 && <p className="text-xs text-white/20 mt-1">+{driveImages.length - 8} more</p>}
            </div>
          )}
          {vimeoVideos.length > 0 && (
            <div>
              <p className="text-xs text-white/40 mb-2 flex items-center gap-1"><Video className="h-3 w-3" /> Videos ({vimeoVideos.length})</p>
              <div className="space-y-2">
                {vimeoVideos.slice(0, 4).map((vid) => (
                  <a key={vid.uri} href={vid.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-md bg-white/5 p-2" data-testid={`vimeo-vid-${vid.uri}`}>
                    {vid.thumbnail && <img src={vid.thumbnail} alt={vid.name} className="w-16 h-10 object-cover rounded" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{vid.name}</p>
                      {vid.competitionFolder && <p className="text-xs text-white/30">{vid.competitionFolder}</p>}
                    </div>
                    <ExternalLink className="h-3 w-3 text-white/30 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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


function ExpandedHostComps({ hostUid, hostName }: { hostUid: string; hostName: string }) {
  const { data, isLoading } = useQuery<HostCompetitionDetail[]>({
    queryKey: ["/api/admin/hosts", hostUid, "competitions"],
  });

  if (isLoading) return <div className="flex items-center justify-center py-6"><span className="text-white/40 text-sm">Loading competitions...</span></div>;
  if (!data || data.length === 0) return <div className="text-center py-4 text-white/30 text-sm">No competitions assigned to {hostName}.</div>;

  return (
    <div className="space-y-4 p-4 pt-0" data-testid={`host-comps-${hostUid}`}>
      {data.map(comp => (
        <div key={comp.id} className="rounded-md bg-white/5 border border-white/5 p-4" data-testid={`host-comp-${comp.id}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h4 className="font-bold text-sm">{comp.title}</h4>
              <span className="text-xs text-white/40">{comp.category}</span>
              {(comp as any).hostedBy === "admin" && (
                <span className="text-[11px] text-orange-400/70">Hosted by Admin</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`border-0 ${comp.status === "active" || comp.status === "voting" ? "bg-green-500/20 text-green-400" : comp.status === "completed" ? "bg-white/10 text-white/60" : "bg-yellow-500/20 text-yellow-400"}`}>
                {comp.status === "voting" ? "Active" : comp.status}
              </Badge>
              {(comp as any).inPersonOnly && (
                <Badge className="border-0 text-xs bg-purple-500/20 text-purple-300">In-Person Only</Badge>
              )}
              <Link href={`/competitions/${comp.id}`}>
                <Button variant="ghost" size="icon" className="text-white/40" data-testid={`link-comp-page-${comp.id}`}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
          <h5 className="text-xs uppercase tracking-widest text-orange-400 font-bold mb-2">Contestants ({comp.contestants.length})</h5>
          {comp.contestants.length > 0 ? (
            <div className="space-y-2">
              {comp.contestants.map(c => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white/[0.03] border border-white/5 p-3" data-testid={`host-contestant-${c.id}`}>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={c.imageUrls?.[0] || ""} />
                      <AvatarFallback className="bg-orange-500/20 text-orange-400 text-xs font-bold">
                        {c.displayName?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <Link href={`/talent/${c.talentProfileId}`}>
                        <span className="font-medium text-sm text-orange-400 underline underline-offset-2 cursor-pointer" data-testid={`link-talent-${c.talentProfileId}`}>
                          {c.displayName}
                        </span>
                      </Link>
                      {c.stageName && <span className="text-xs text-white/40 ml-2">{c.stageName}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`border-0 ${c.applicationStatus === "approved" ? "bg-green-500/20 text-green-400" : c.applicationStatus === "rejected" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                      {c.applicationStatus}
                    </Badge>
                    <span className="text-xs text-white/40">{c.voteCount} votes</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
                      onClick={() => {
                        if (confirm(`Remove ${c.displayName} from this competition? This will also delete their votes.`)) {
                          deleteContestantMutation.mutate(c.id);
                        }
                      }}
                      data-testid={`button-remove-contestant-${c.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/30">No contestants yet.</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard({ user }: { user: any }) {
  const { logout } = useAuth();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [compCategory, setCompCategory] = useState("");
  const [compStatus, setCompStatus] = useState("active");
  const [maxVotes, setMaxVotes] = useState("10");
  const [voteCost, setVoteCost] = useState("0");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startDateTbd, setStartDateTbd] = useState(false);
  const [endDateTbd, setEndDateTbd] = useState(false);
  const [votingStartDate, setVotingStartDate] = useState("");
  const [votingEndDate, setVotingEndDate] = useState("");
  const [expectedContestants, setExpectedContestants] = useState("");
  const [onlineVoteWeight, setOnlineVoteWeight] = useState("100");
  const [inPersonOnly, setInPersonOnly] = useState(false);
  const [compDetailId, setCompDetailId] = useState<number | null>(null);
  const [userDetailId, setUserDetailId] = useState<number | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [usersView, setUsersView] = useState<"users" | "applications">("users");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [calendarSelectedDay, setCalendarSelectedDay] = useState<number | null>(null);
  const [calendarSelectedComp, setCalendarSelectedComp] = useState<number | null>(null);
  const [settingsForm, setSettingsForm] = useState<any>(null);
  const [compSearch, setCompSearch] = useState("");
  const [compCategoryFilter, setCompCategoryFilter] = useState("all");
  const [compPage, setCompPage] = useState(1);
  const COMPS_PER_PAGE = 10;
  const [userPage, setUserPage] = useState(1);
  const USERS_PER_PAGE = 10;
  const [hostSearch, setHostSearch] = useState("");
  const [hostPage, setHostPage] = useState(1);
  const [expandedHostId, setExpandedHostId] = useState<string | null>(null);
  const [hostSettingsOpen, setHostSettingsOpen] = useState(false);
  const [assignHostDialogOpen, setAssignHostDialogOpen] = useState(false);
  const [assignHostUid, setAssignHostUid] = useState<string | null>(null);
  const [assignCompId, setAssignCompId] = useState("");
  const HOSTS_PER_PAGE = 10;

  const { data: stats } = useQuery<AdminStats>({ queryKey: ["/api/admin/stats"] });
  const { data: competitions } = useQuery<CompetitionWithCreator[]>({ queryKey: ["/api/competitions"] });
  const { data: storageData, isLoading: storageLoading, refetch: refetchStorage } = useQuery<any>({
    queryKey: ["/api/admin/storage"],
    staleTime: 60000,
  });

  const filteredComps = useMemo(() => {
    if (!competitions) return [];
    let filtered = competitions;
    if (compSearch.trim()) {
      const q = compSearch.toLowerCase();
      filtered = filtered.filter(c => c.title.toLowerCase().includes(q) || (c.category && c.category.toLowerCase().includes(q)));
    }
    if (compCategoryFilter !== "all") {
      filtered = filtered.filter(c => c.category === compCategoryFilter);
    }
    return filtered;
  }, [competitions, compSearch, compCategoryFilter]);

  const totalCompPages = Math.max(1, Math.ceil(filteredComps.length / COMPS_PER_PAGE));
  const paginatedComps = useMemo(() => {
    const start = (compPage - 1) * COMPS_PER_PAGE;
    return filteredComps.slice(start, start + COMPS_PER_PAGE);
  }, [filteredComps, compPage]);

  const { data: allContestants } = useQuery<ContestantAdmin[]>({ queryKey: ["/api/admin/contestants"] });
  const { data: liveryItems } = useQuery<SiteLivery[]>({ queryKey: ["/api/livery"] });
  const { data: firestoreCategories } = useQuery<any[]>({ queryKey: ["/api/categories"] });

  const compCategories = useMemo(() => {
    if (!firestoreCategories) return [];
    return firestoreCategories.map((c: any) => c.name).sort();
  }, [firestoreCategories]);

  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [embedInputs, setEmbedInputs] = useState<Record<string, string | undefined>>({});
  const [liverySubTab, setLiverySubTab] = useState<"cbpublishing" | "thequest">("cbpublishing");
  const [cbpColorInput, setCbpColorInput] = useState("");
  const [questColorInput, setQuestColorInput] = useState("");

  const addCategoryMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const order = (firestoreCategories?.length || 0);
      const res = await apiRequest("POST", "/api/admin/categories", { ...data, order, isActive: true });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setNewCatName("");
      setNewCatDesc("");
      setAddingCategory(false);
      toast({ title: "Category added" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add category", description: err.message, variant: "destructive" });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; imageUrl?: string | null }) => {
      const res = await apiRequest("PATCH", `/api/admin/categories/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Category updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Category deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    },
  });
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: joinSettings } = useQuery<JoinHostSettings>({ queryKey: ["/api/admin/join/settings"] });
  const { data: joinSubmissions } = useQuery<JoinSubmission[]>({ queryKey: ["/api/admin/join/submissions"] });
  const { data: hostSettings } = useQuery<JoinHostSettings>({ queryKey: ["/api/host/settings"] });
  const { data: hostSubmissions } = useQuery<HostSubmission[]>({ queryKey: ["/api/admin/host/submissions"] });
  const { data: hostUsers } = useQuery<HostProfile[]>({ queryKey: ["/api/admin/hosts"] });

  const filteredHosts = useMemo(() => {
    if (!hostUsers) return [];
    let filtered = hostUsers;
    if (hostSearch.trim()) {
      const q = hostSearch.toLowerCase();
      filtered = filtered.filter(h => h.displayName.toLowerCase().includes(q) || (h.stageName && h.stageName.toLowerCase().includes(q)));
    }
    return filtered;
  }, [hostUsers, hostSearch]);

  const totalHostPages = Math.max(1, Math.ceil(filteredHosts.length / HOSTS_PER_PAGE));
  const paginatedHosts = useMemo(() => {
    const start = (hostPage - 1) * HOSTS_PER_PAGE;
    return filteredHosts.slice(start, start + HOSTS_PER_PAGE);
  }, [filteredHosts, hostPage]);
  const { data: talentUsers, isLoading: usersLoading } = useQuery<TalentUser[]>({ queryKey: ["/api/admin/users"] });

  const { data: calendarReport, isLoading: calendarReportLoading } = useQuery<CalendarReportResponse>({
    queryKey: ["/api/admin/competitions", calendarSelectedComp, "report"],
    enabled: calendarSelectedComp !== null,
  });

  const { data: platformSettings } = useQuery<any>({
    queryKey: ["/api/platform-settings"],
  });

  useEffect(() => {
    if (platformSettings && !settingsForm) {
      setSettingsForm(platformSettings);
    }
  }, [platformSettings]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      const res = await apiRequest("PUT", "/api/admin/platform-settings", settings);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-settings"] });
      toast({ title: "Settings saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save settings", description: err.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/competitions", {
        title,
        description,
        category: compCategory,
        status: compStatus,
        maxVotesPerDay: parseInt(maxVotes) || 10,
        voteCost: parseInt(voteCost) || 0,
        startDate: startDateTbd ? null : (startDate ? new Date(startDate).toISOString() : null),
        endDate: endDateTbd ? null : (endDate ? new Date(endDate).toISOString() : null),
        startDateTbd,
        endDateTbd,
        votingStartDate: votingStartDate ? new Date(votingStartDate).toISOString() : null,
        votingEndDate: votingEndDate ? new Date(votingEndDate).toISOString() : null,
        expectedContestants: expectedContestants ? parseInt(expectedContestants) : null,
        onlineVoteWeight: parseInt(onlineVoteWeight) || 100,
        inPersonOnly,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      setCompCategory("");
      setStartDate("");
      setEndDate("");
      setStartDateTbd(false);
      setEndDateTbd(false);
      setVotingStartDate("");
      setVotingEndDate("");
      setExpectedContestants("");
      setOnlineVoteWeight("100");
      setInPersonOnly(false);
      toast({ title: "Competition created!" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/admin/contestants/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contestants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Status updated!" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const updateCompMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest("PATCH", `/api/competitions/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      toast({ title: "Competition updated!" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const featureCompMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/competitions/${id}/feature`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/competitions/featured"] });
      toast({ title: "Featured competition updated!" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const uploadLiveryMutation = useMutation({
    mutationFn: async ({ imageKey, file }: { imageKey: string; file: File }) => {
      const formData = new FormData();
      formData.append("image", file);
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/admin/livery/${imageKey}`, {
        method: "PUT",
        body: formData,
        headers,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/livery"] });
      toast({ title: "Image updated!" });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const coverInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const uploadCoverMutation = useMutation({
    mutationFn: async ({ compId, file }: { compId: number; file: File }) => {
      const formData = new FormData();
      formData.append("cover", file);
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/admin/competitions/${compId}/cover`, {
        method: "PUT",
        body: formData,
        headers,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      toast({ title: "Cover updated!" });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const uploadCategoryMediaMutation = useMutation({
    mutationFn: async ({ categoryId, file }: { categoryId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/admin/categories/${categoryId}/media`, {
        method: "PUT",
        body: formData,
        headers,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Category media uploaded!" });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const removeCoverMutation = useMutation({
    mutationFn: async ({ compId, type }: { compId: number; type: "image" | "video" }) => {
      await apiRequest("DELETE", `/api/admin/competitions/${compId}/cover?type=${type}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      toast({ title: "Cover removed!" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteCompetitionMutation = useMutation({
    mutationFn: async (compId: number) => {
      await apiRequest("DELETE", `/api/competitions/${compId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hero-gallery"] });
      toast({ title: "Competition deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const deleteContestantMutation = useMutation({
    mutationFn: async (contestantId: number) => {
      await apiRequest("DELETE", `/api/admin/contestants/${contestantId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contestants"] });
      toast({ title: "Contestant removed from competition" });
    },
    onError: (err: Error) => {
      toast({ title: "Remove failed", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (uid: string) => {
      await apiRequest("DELETE", `/api/admin/users/${uid}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contestants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      toast({ title: "User completely deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const resetLiveryMutation = useMutation({
    mutationFn: async (imageKey: string) => {
      await apiRequest("DELETE", `/api/admin/livery/${imageKey}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/livery"] });
      toast({ title: "Reset to default!" });
    },
    onError: (err: Error) => {
      toast({ title: "Reset failed", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const deleteLiverySlotMutation = useMutation({
    mutationFn: async (imageKey: string) => {
      await apiRequest("DELETE", `/api/admin/livery/${imageKey}/permanent`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/livery"] });
      toast({ title: "Livery slot permanently deleted!" });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const embedLiveryMutation = useMutation({
    mutationFn: async ({ imageKey, url }: { imageKey: string; url: string }) => {
      await apiRequest("PUT", `/api/admin/livery/${imageKey}/url`, { url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/livery"] });
      toast({ title: "Embed URL saved!" });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const updateLiveryTextMutation = useMutation({
    mutationFn: async ({ imageKey, textContent }: { imageKey: string; textContent: string }) => {
      await apiRequest("PUT", `/api/admin/livery/${imageKey}/text`, { textContent });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/livery"] });
      toast({ title: "Text updated!" });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const updateJoinSettingsMutation = useMutation({
    mutationFn: async (data: Partial<JoinHostSettings>) => {
      await apiRequest("PUT", "/api/admin/join/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/join/settings"] });
      toast({ title: "Nomination settings updated!" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const updateJoinSubmissionMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/admin/join/submissions/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/join/submissions"] });
      toast({ title: "Submission updated!" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const updateNominationStatusMutation = useMutation({
    mutationFn: async ({ id, nominationStatus }: { id: string; nominationStatus: string }) => {
      await apiRequest("PATCH", `/api/admin/join/submissions/${id}/nomination-status`, { nominationStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/join/submissions"] });
      toast({ title: "Nomination status updated!" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);

  const updateHostSettingsMutation = useMutation({
    mutationFn: async (data: Partial<JoinHostSettings>) => {
      await apiRequest("PUT", "/api/admin/host/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/host/settings"] });
      toast({ title: "Host settings updated!" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const updateHostSubmissionMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/admin/host/submissions/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/host/submissions"] });
      toast({ title: "Submission updated!" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const assignHostMutation = useMutation({
    mutationFn: async ({ compId, hostUid }: { compId: number; hostUid: string }) => {
      await apiRequest("PATCH", `/api/admin/competitions/${compId}/assign-host`, { hostUid });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hosts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      if (assignHostUid) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/hosts", assignHostUid, "competitions"] });
      }
      setAssignCompId("");
      toast({ title: "Competition assigned! You can assign another or close this dialog." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const handleFileSelect = (imageKey: string, file: File) => {
    uploadLiveryMutation.mutate({ imageKey, file });
  };

  const pending = allContestants?.filter((c) => c.applicationStatus === "pending") || [];

  const filteredUsers = talentUsers?.filter((u) => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return (
      u.displayName?.toLowerCase().includes(q) ||
      u.stageName?.toLowerCase().includes(q) ||
      u.category?.toLowerCase().includes(q)
    );
  });

  const totalUserPages = Math.max(1, Math.ceil((filteredUsers?.length || 0) / USERS_PER_PAGE));
  const paginatedUsers = useMemo(() => {
    if (!filteredUsers) return [];
    const start = (userPage - 1) * USERS_PER_PAGE;
    return filteredUsers.slice(start, start + USERS_PER_PAGE);
  }, [filteredUsers, userPage]);

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 h-16 lg:h-20">
          <Link href="/" className="flex items-center gap-2" data-testid="link-home">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <Trophy className="h-4 w-4 text-white" />
            </div>
            <span className="font-serif text-xl font-bold">The Quest</span>
          </Link>
          <div className="flex items-center gap-3">
            <Badge className="bg-orange-500/20 text-orange-400 border-0">Admin</Badge>
            <Avatar className="h-8 w-8 ring-2 ring-white/10">
              <AvatarImage src={user.profileImageUrl || ""} />
              <AvatarFallback className="bg-gradient-to-br from-orange-500/20 to-amber-500/20 text-orange-400 text-xs font-bold">
                {(user.displayName || user.email || "A").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Button size="icon" variant="ghost" className="text-white/40" onClick={() => logout()} data-testid="button-logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold" data-testid="text-admin-title">Admin Dashboard</h1>
            <p className="text-white/40 mt-1 text-sm sm:text-base">Manage competitions, applications, and analytics.</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white" data-testid="button-create-competition">
                <Plus className="h-4 w-4 mr-2" /> New Competition
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-white/10 text-white max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">Create Competition</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label className="text-white/60">Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Competition title"
                    className="bg-white/5 border-white/10 text-white" data-testid="input-comp-title" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/60">Category</Label>
                  <Select value={compCategory} onValueChange={setCompCategory}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-comp-category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10">
                      {(firestoreCategories || []).map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/60">Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the competition..."
                    className="bg-white/5 border-white/10 text-white resize-none min-h-[80px]" data-testid="input-comp-description" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-white/60">Status</Label>
                    <Select value={compStatus} onValueChange={setCompStatus}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-comp-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10">
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/60">Expected Contestants</Label>
                    <Input type="number" value={expectedContestants} onChange={(e) => setExpectedContestants(e.target.value)} placeholder="e.g., 20"
                      className="bg-white/5 border-white/10 text-white" data-testid="input-expected-contestants" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/60">Online Vote Weight (%)</Label>
                    <Input type="number" min="1" max="100" value={onlineVoteWeight} onChange={(e) => setOnlineVoteWeight(e.target.value)} placeholder="100"
                      className="bg-white/5 border-white/10 text-white" data-testid="input-online-vote-weight" />
                    <p className="text-white/30 text-xs">Percentage value of online votes vs in-person (QR) votes at final count. 100% = equal weight.</p>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md bg-white/[0.04] border border-white/10 px-4 py-3">
                  <div>
                    <Label className="text-white/70 text-sm font-medium">In-Person Only Event</Label>
                    <p className="text-white/30 text-xs mt-0.5">When enabled, only QR code votes are accepted. Online voting is disabled.</p>
                  </div>
                  <Switch
                    checked={inPersonOnly}
                    onCheckedChange={setInPersonOnly}
                    className="data-[state=checked]:bg-orange-500"
                    data-testid="switch-in-person-only"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-white/60">Max Votes/Day</Label>
                    <Input type="number" value={maxVotes} onChange={(e) => setMaxVotes(e.target.value)}
                      className="bg-white/5 border-white/10 text-white" data-testid="input-max-votes" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/60">Vote Cost ($)</Label>
                    <Input type="number" step="0.01" min={platformSettings?.defaultVoteCost ?? 0} value={voteCost} onChange={(e) => setVoteCost(e.target.value)} placeholder="0"
                      className="bg-white/5 border-white/10 text-white" data-testid="input-vote-cost" />
                    {(platformSettings?.defaultVoteCost ?? 0) > 0 && (
                      <p className="text-orange-400/70 text-xs">Minimum: ${(platformSettings?.defaultVoteCost ?? 0).toFixed(2)} (set in platform settings)</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-white/60">Start Date & Time</Label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <span className="text-[10px] text-white/40 uppercase tracking-wider">TBD</span>
                        <Switch checked={startDateTbd} onCheckedChange={(v) => { setStartDateTbd(v); if (v) setStartDate(""); }}
                          className="data-[state=checked]:bg-orange-500 scale-75" data-testid="switch-start-tbd" />
                      </label>
                    </div>
                    {startDateTbd ? (
                      <div className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-orange-400 font-medium" data-testid="text-start-tbd">
                        TBD — Starts once enough contestants enter
                      </div>
                    ) : (
                      <Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                        className="bg-white/5 border-white/10 text-white" data-testid="input-start-date" />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-white/60">End Date & Time</Label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <span className="text-[10px] text-white/40 uppercase tracking-wider">TBD</span>
                        <Switch checked={endDateTbd} onCheckedChange={(v) => { setEndDateTbd(v); if (v) setEndDate(""); }}
                          className="data-[state=checked]:bg-orange-500 scale-75" data-testid="switch-end-tbd" />
                      </label>
                    </div>
                    {endDateTbd ? (
                      <div className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-orange-400 font-medium" data-testid="text-end-tbd">
                        TBD — End date to be determined
                      </div>
                    ) : (
                      <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                        className="bg-white/5 border-white/10 text-white" data-testid="input-end-date" />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-white/60">Voting Start</Label>
                    <Input type="datetime-local" value={votingStartDate} onChange={(e) => setVotingStartDate(e.target.value)}
                      className="bg-white/5 border-white/10 text-white" data-testid="input-voting-start-date" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/60">Voting End</Label>
                    <Input type="datetime-local" value={votingEndDate} onChange={(e) => setVotingEndDate(e.target.value)}
                      className="bg-white/5 border-white/10 text-white" data-testid="input-voting-end-date" />
                  </div>
                </div>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !title.trim() || !compCategory.trim()}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white" data-testid="button-submit-competition">
                  {createMutation.isPending ? "Creating..." : "Create Competition"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 mb-8">
            {[
              { label: "Competitions", value: stats.totalCompetitions, icon: Trophy },
              { label: "Talent Profiles", value: stats.totalTalentProfiles, icon: Users },
              { label: "Contestants", value: stats.totalContestants, icon: Flame },
              { label: "Total Votes", value: stats.totalVotes, icon: Vote },
              { label: "Pending", value: stats.pendingApplications, icon: BarChart3 },
            ].map((stat) => (
              <div key={stat.label} className="rounded-md bg-white/5 border border-white/5 p-4" data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
                <stat.icon className="h-5 w-5 text-orange-400/60 mb-2" />
                <p className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">{stat.value}</p>
                <p className="text-xs text-white/30 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        <Tabs defaultValue="competitions">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mb-6">
            <TabsList className="bg-white/5 border border-white/5 inline-flex w-max sm:w-auto">
              <TabsTrigger value="competitions" className="text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white">
                <Trophy className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Competitions</span>
              </TabsTrigger>
              <TabsTrigger value="livery" className="text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white" data-testid="tab-livery">
                <Image className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Livery</span>
              </TabsTrigger>
              <TabsTrigger value="join" className="text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white" data-testid="tab-join">
                <UserPlus className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Nominations</span>
              </TabsTrigger>
              <TabsTrigger value="host" className="text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white" data-testid="tab-host">
                <Megaphone className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Host</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white" data-testid="tab-users">
                <Users className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Users</span> {pending.length > 0 && <Badge className="ml-1 bg-orange-500 text-white border-0 text-[10px] px-1.5 py-0">{pending.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="calendar" className="text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white" data-testid="tab-calendar">
                <Calendar className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Calendar</span>
              </TabsTrigger>
              <TabsTrigger value="storage" className="text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white" data-testid="tab-storage">
                <HardDrive className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Storage</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white" data-testid="tab-analytics">
                <BarChart3 className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white" data-testid="tab-settings">
                <Settings className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="competitions">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <Input
                  placeholder="Search competitions..."
                  value={compSearch}
                  onChange={(e) => { setCompSearch(e.target.value); setCompPage(1); }}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  data-testid="input-comp-search"
                />
              </div>
              <Select value={compCategoryFilter} onValueChange={(val) => { setCompCategoryFilter(val); setCompPage(1); }}>
                <SelectTrigger className="w-44 bg-white/5 border-white/10 text-white text-sm" data-testid="select-comp-category-filter">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10">
                  <SelectItem value="all">All Categories</SelectItem>
                  {compCategories.map(cat => (
                    <SelectItem key={cat} value={cat!}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-white/30" data-testid="text-comp-count">{filteredComps.length} result{filteredComps.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {paginatedComps.map((comp) => (
                <div key={comp.id} className="rounded-md bg-white/5 border border-white/5 overflow-visible" data-testid={`admin-comp-${comp.id}`}>
                  <div
                    className="group relative h-[200px] rounded-t-md flex flex-col justify-end"
                    style={comp.coverImage && !comp.coverVideo ? { backgroundImage: `url(${comp.coverImage})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                  >
                    {comp.coverVideo && (
                      <video
                        src={comp.coverVideo}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover rounded-t-md"
                      />
                    )}
                    {!comp.coverImage && !comp.coverVideo && (
                      <div className="absolute inset-0 rounded-t-md bg-gradient-to-b from-orange-900/40 to-black flex items-center justify-center">
                        <Trophy className="h-16 w-16 text-white/10" />
                      </div>
                    )}
                    <div className="absolute inset-0 rounded-t-md bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    <div className="absolute top-2 right-2 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <input
                        type="file"
                        accept="image/*,video/mp4,video/webm,video/quicktime"
                        className="hidden"
                        ref={(el) => { coverInputRefs.current[comp.id] = el; }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadCoverMutation.mutate({ compId: comp.id, file });
                          e.target.value = "";
                        }}
                        data-testid={`input-cover-upload-${comp.id}`}
                      />
                      <Button
                        size="icon"
                        onClick={() => coverInputRefs.current[comp.id]?.click()}
                        disabled={uploadCoverMutation.isPending}
                        className="bg-black/60 border-0 text-white/80"
                        data-testid={`button-upload-cover-${comp.id}`}
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                      {(comp.coverImage || comp.coverVideo) && (
                        <Button
                          size="icon"
                          onClick={() => removeCoverMutation.mutate({ compId: comp.id, type: comp.coverVideo ? "video" : "image" })}
                          disabled={removeCoverMutation.isPending}
                          className="bg-black/60 border-0 text-red-400"
                          data-testid={`button-remove-cover-${comp.id}`}
                        >
                          <XIcon className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        onClick={() => {
                          if (window.confirm(`Delete "${comp.title}"? This will remove the competition and all its data permanently.`)) {
                            deleteCompetitionMutation.mutate(comp.id);
                          }
                        }}
                        disabled={deleteCompetitionMutation.isPending}
                        className="bg-black/60 border-0 text-red-500"
                        data-testid={`button-delete-comp-${comp.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="relative z-10 p-4">
                      <h3 className="font-bold text-lg text-white drop-shadow-md">{comp.title}</h3>
                      {(comp as any).hostedBy === "admin" && (
                        <span className="text-xs text-orange-300/80 drop-shadow-md">Hosted by Admin</span>
                      )}
                      <div className="flex flex-wrap items-center gap-3 mt-1">
                        <Select
                          value={comp.category || ""}
                          onValueChange={(val) => updateCompMutation.mutate({ id: comp.id, data: { category: val } })}
                        >
                          <SelectTrigger className="h-6 w-auto min-w-[100px] bg-white/10 border-white/20 text-white/80 text-xs px-2 gap-1" data-testid={`select-category-${comp.id}`}>
                            <SelectValue placeholder="Assign category" />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-white/10">
                            {(firestoreCategories || []).map((cat: any) => (
                              <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Badge className={`border-0 ${comp.status === "active" || comp.status === "voting" ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/60"}`}>
                          {comp.status === "voting" ? "Active" : comp.status}
                        </Badge>
                        {(comp as any).inPersonOnly && (
                          <Badge className="border-0 text-xs bg-purple-500/20 text-purple-300">In-Person Only</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCompDetailId(comp.id)}
                      className="text-orange-400"
                      data-testid={`button-full-detail-${comp.id}`}
                    >
                      <Eye className="h-4 w-4 mr-1" /> Details
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          const token = getAuthToken();
                          const res = await fetch(`/api/competitions/${comp.id}/qrcode`, {
                            headers: token ? { Authorization: `Bearer ${token}` } : {},
                          });
                          if (!res.ok) throw new Error("Failed to download QR code");
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `qr-${comp.title.toLowerCase().replace(/\s+/g, "-")}.png`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch (err) {
                          console.error("QR download error:", err);
                        }
                      }}
                      className="text-white/40"
                      title="Download QR Code for live voting"
                      data-testid={`button-qr-${comp.id}`}
                    >
                      <QrCode className="h-4 w-4 mr-1" /> QR Code
                    </Button>
                    <Select value={comp.status} onValueChange={(val) => updateCompMutation.mutate({ id: comp.id, data: { status: val } })}>
                      <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white text-sm" data-testid={`select-status-${comp.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10">
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => featureCompMutation.mutate(comp.id)}
                      disabled={featureCompMutation.isPending}
                      className={(comp as any).isFeatured ? "text-yellow-400" : "text-white/30"}
                      title={(comp as any).isFeatured ? "Currently featured (click to unfeature)" : "Set as featured countdown"}
                      data-testid={`button-feature-${comp.id}`}
                    >
                      <Star className={`h-4 w-4 mr-1 ${(comp as any).isFeatured ? "fill-yellow-400" : ""}`} />
                      {(comp as any).isFeatured ? "Featured" : "Feature"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {filteredComps.length === 0 && (
              <div className="text-center py-12 text-white/30 text-sm" data-testid="text-no-comps">
                No competitions found matching your search.
              </div>
            )}
            {totalCompPages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-6" data-testid="comp-pagination">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={compPage <= 1}
                  onClick={() => setCompPage(p => p - 1)}
                  className="text-white/60"
                  data-testid="button-comp-prev"
                >
                  Previous
                </Button>
                {Array.from({ length: totalCompPages }, (_, i) => i + 1).map(page => (
                  <Button
                    key={page}
                    variant={page === compPage ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setCompPage(page)}
                    className={page === compPage ? "bg-orange-500 text-white" : "text-white/40"}
                    data-testid={`button-comp-page-${page}`}
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={compPage >= totalCompPages}
                  onClick={() => setCompPage(p => p + 1)}
                  className="text-white/60"
                  data-testid="button-comp-next"
                >
                  Next
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="livery">
            {/* Sub-tab bar */}
            <div className="flex items-center gap-1 mb-5 border-b border-white/10 pb-0">
              <button
                onClick={() => setLiverySubTab("cbpublishing")}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors -mb-px ${liverySubTab === "cbpublishing" ? "border-[#691cff] text-white" : "border-transparent text-white/40 hover:text-white/70"}`}
                data-testid="subtab-livery-cbpublishing"
              >
                CB Publishing
              </button>
              <button
                onClick={() => setLiverySubTab("thequest")}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors -mb-px ${liverySubTab === "thequest" ? "border-[#691cff] text-white" : "border-transparent text-white/40 hover:text-white/70"}`}
                data-testid="subtab-livery-thequest"
              >
                The Quest
              </button>
            </div>

            {liverySubTab === "cbpublishing" && (() => {
              const saved = liveryItems?.find((i: any) => i.imageKey === "home_brand_color")?.textContent || "#691cff";
              const current = cbpColorInput || saved;
              return (
                <div className="mb-4 space-y-3">
                  <p className="text-white/40 text-sm">Customize the CB Publishing home page. Upload images/videos or paste embed URLs (YouTube, Vimeo, Facebook, Instagram) for each section slot.</p>
                  <div className="flex items-center gap-3 bg-zinc-900 border border-white/10 rounded-md px-3 py-2">
                    <span className="text-xs text-white/50 font-semibold uppercase tracking-wider whitespace-nowrap">Brand Color</span>
                    <input type="color" value={current} onChange={e => setCbpColorInput(e.target.value)} className="h-7 w-10 rounded cursor-pointer border-0 bg-transparent p-0" data-testid="input-cbp-brand-color" />
                    <input type="text" value={current} onChange={e => setCbpColorInput(e.target.value)} className="bg-zinc-800 border border-white/20 text-white text-xs h-7 px-2 rounded w-24 font-mono" placeholder="#691cff" data-testid="input-cbp-brand-hex" />
                    <Button size="sm" onClick={() => updateLiveryTextMutation.mutate({ imageKey: "home_brand_color", textContent: current })} disabled={updateLiveryTextMutation.isPending} className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white text-[10px] h-7 px-3" data-testid="button-save-cbp-brand-color">Save</Button>
                    {current !== saved && <span className="text-[10px] text-orange-400">Unsaved</span>}
                  </div>
                </div>
              );
            })()}
            {liverySubTab === "thequest" && (() => {
              const saved = liveryItems?.find((i: any) => i.imageKey === "quest_brand_color")?.textContent || "#FF5A09";
              const current = questColorInput || saved;
              return (
                <div className="mb-4 space-y-3">
                  <p className="text-white/40 text-sm">Upload replacement images or short videos (15 seconds max) for any Quest template slot. Click "Upload" to replace or "Reset" to restore the original.</p>
                  <div className="flex items-center gap-3 bg-zinc-900 border border-white/10 rounded-md px-3 py-2">
                    <span className="text-xs text-white/50 font-semibold uppercase tracking-wider whitespace-nowrap">Brand Color</span>
                    <input type="color" value={current} onChange={e => setQuestColorInput(e.target.value)} className="h-7 w-10 rounded cursor-pointer border-0 bg-transparent p-0" data-testid="input-quest-brand-color" />
                    <input type="text" value={current} onChange={e => setQuestColorInput(e.target.value)} className="bg-zinc-800 border border-white/20 text-white text-xs h-7 px-2 rounded w-24 font-mono" placeholder="#FF5A09" data-testid="input-quest-brand-hex" />
                    <Button size="sm" onClick={() => updateLiveryTextMutation.mutate({ imageKey: "quest_brand_color", textContent: current })} disabled={updateLiveryTextMutation.isPending} className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white text-[10px] h-7 px-3" data-testid="button-save-quest-brand-color">Save</Button>
                    {current !== saved && <span className="text-[10px] text-orange-400">Unsaved</span>}
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveryItems?.filter((item: any) => {
                if (item.itemType === "text") return false;
                const isCBSlot = item.imageKey.startsWith("home_") || item.imageKey === "logo" || item.imageKey === "site_favicon";
                return liverySubTab === "cbpublishing" ? isCBSlot : !isCBSlot;
              }).map((item: any) => {
                const displayUrl = item.imageUrl || item.defaultUrl;
                const isCustom = !!item.imageUrl;
                const isHomepageSlot = item.imageKey.startsWith("home_") || item.imageKey === "logo" || item.imageKey === "site_favicon";
                const mediaType = detectMediaType(displayUrl || "");
                const isEmbed = ["youtube", "vimeo", "facebook", "instagram"].includes(mediaType);
                const isVideo = mediaType === "video";
                const embedInputVal = embedInputs[item.imageKey];
                const embedOpen = embedInputVal !== undefined;
                return (
                  <div key={item.imageKey} className="rounded-md bg-white/5 border border-white/10 overflow-visible" data-testid={`livery-item-${item.imageKey}`}>
                    <div className="relative aspect-video bg-black/50 overflow-hidden">
                      {isEmbed ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                          <span className={`text-xs font-bold px-3 py-1 rounded-full ${MEDIA_TYPE_COLORS[mediaType]}`}>
                            {MEDIA_TYPE_LABELS[mediaType]}
                          </span>
                          <p className="text-[10px] text-white/30 text-center px-2 break-all line-clamp-2">{displayUrl}</p>
                        </div>
                      ) : isVideo ? (
                        <video
                          src={displayUrl}
                          className="w-full h-full object-cover"
                          muted
                          loop
                          autoPlay
                          playsInline
                          data-testid={`livery-video-${item.imageKey}`}
                        />
                      ) : (
                        <img
                          src={displayUrl}
                          alt={item.label}
                          className="w-full h-full object-cover"
                          data-testid={`livery-img-${item.imageKey}`}
                        />
                      )}
                      <div className="absolute top-2 right-2 flex items-center gap-1">
                        {isVideo && (
                          <Badge className="bg-blue-500 text-white border-0 text-xs">Video</Badge>
                        )}
                        {isEmbed && (
                          <Badge className={`border-0 text-xs ${MEDIA_TYPE_COLORS[mediaType]}`}>{MEDIA_TYPE_LABELS[mediaType]}</Badge>
                        )}
                        {isCustom && (
                          <Badge className="bg-orange-500 text-white border-0 text-xs">Custom</Badge>
                        )}
                      </div>
                    </div>
                    <div className="p-3">
                      <h4 className="font-medium text-sm mb-0.5" data-testid={`livery-label-${item.imageKey}`}>{item.label}</h4>
                      <p className="text-xs text-white/30 mb-3 font-mono">{item.imageKey}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={(el) => { fileInputRefs.current[item.imageKey] = el; }}
                          type="file"
                          accept="image/*,video/mp4,video/webm,video/quicktime"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileSelect(item.imageKey, file);
                            e.target.value = "";
                          }}
                          data-testid={`input-livery-upload-${item.imageKey}`}
                        />
                        <Button
                          size="sm"
                          onClick={() => fileInputRefs.current[item.imageKey]?.click()}
                          disabled={uploadLiveryMutation.isPending}
                          className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white text-xs"
                          data-testid={`button-upload-${item.imageKey}`}
                        >
                          <Upload className="h-3 w-3 mr-1" /> Upload
                        </Button>
                        {isHomepageSlot && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setEmbedInputs(prev => ({
                                ...prev,
                                [item.imageKey]: embedOpen ? undefined : (item.imageUrl || ""),
                              }))
                            }
                            className="border border-white/20 text-white/60 hover:text-white text-xs"
                            data-testid={`button-embed-${item.imageKey}`}
                          >
                            <Link2 className="h-3 w-3 mr-1" /> Embed URL
                          </Button>
                        )}
                        {isCustom && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => resetLiveryMutation.mutate(item.imageKey)}
                            disabled={resetLiveryMutation.isPending}
                            className="text-white/40 text-xs"
                            data-testid={`button-reset-${item.imageKey}`}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" /> Reset
                          </Button>
                        )}
                        {item.imageKey.startsWith("category_") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Permanently delete "${item.label}"? This cannot be undone.`)) {
                                deleteLiverySlotMutation.mutate(item.imageKey);
                              }
                            }}
                            disabled={deleteLiverySlotMutation.isPending}
                            className="text-red-400 text-xs"
                            data-testid={`button-delete-livery-${item.imageKey}`}
                          >
                            <Trash2 className="h-3 w-3 mr-1" /> Delete
                          </Button>
                        )}
                      </div>
                      {embedOpen && (
                        <div className="mt-3 flex gap-2 items-center" data-testid={`embed-input-area-${item.imageKey}`}>
                          <input
                            type="url"
                            value={embedInputVal}
                            onChange={(e) => setEmbedInputs(prev => ({ ...prev, [item.imageKey]: e.target.value }))}
                            placeholder="Paste YouTube, Vimeo, Facebook, Instagram, or direct URL…"
                            className="flex-1 bg-black/40 border border-white/20 rounded px-2 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#691cff]"
                            data-testid={`input-embed-url-${item.imageKey}`}
                          />
                          <Button
                            size="sm"
                            onClick={() => {
                              if (!embedInputVal?.trim()) return;
                              embedLiveryMutation.mutate({ imageKey: item.imageKey, url: embedInputVal.trim() }, {
                                onSuccess: () => setEmbedInputs(prev => ({ ...prev, [item.imageKey]: undefined })),
                              });
                            }}
                            disabled={embedLiveryMutation.isPending || !embedInputVal?.trim()}
                            className="bg-[#691cff] hover:bg-[#5a15e0] text-white text-xs border-0"
                            data-testid={`button-embed-save-${item.imageKey}`}
                          >
                            Save
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {(() => {
              const textItems = liveryItems?.filter((item: any) => item.itemType === "text") || [];
              const faqPairs: string[][] = [];
              for (let i = 1; i <= 19; i++) {
                faqPairs.push([`faq_${i}_q`, `faq_${i}_a`]);
              }
              const allGroups = [
                { label: "Home Page (CB Publishing)", site: "cbpublishing", keys: ["home_hero_title", "home_hero_subtitle", "home_quote_left", "home_quote_body", "home_about_title", "home_about_body", "home_feature_1_title", "home_feature_1_subtitle", "home_feature_2_title", "home_feature_2_subtitle", "home_feature_3_title", "home_feature_3_subtitle", "home_feature_4_title", "home_feature_4_subtitle", "home_feature_5_title", "home_feature_5_subtitle"], pairs: null },
                { label: "Hero Section", site: "thequest", keys: ["hero_title_top", "hero_title_main", "hero_summary"], pairs: null },
                { label: "About Page", site: "thequest", keys: ["about_rules_text", "about_details_text"], pairs: null },
                { label: "Contact Info", site: "thequest", keys: ["contact_email", "contact_phone", "contact_address"], pairs: null },
                { label: "Social Links", site: "thequest", keys: ["social_facebook", "social_instagram", "social_twitter", "social_youtube", "social_tiktok"], pairs: null },
                { label: "Info Modals (Home Page)", site: "thequest", keys: ["how_voting_works", "how_nominations_work"], pairs: null },
                { label: "Why The Quest", site: "thequest", keys: ["why_subtitle", "why_heading", "why_card1_title", "why_card1_desc", "why_card2_title", "why_card2_desc", "why_card3_title", "why_card3_desc"], pairs: null },
                { label: "How It Works", site: "thequest", keys: ["hiw_section_title", "hiw_step1_title", "hiw_step1_desc", "hiw_step2_title", "hiw_step2_desc", "hiw_step3_title", "hiw_step3_desc"], pairs: null },
                { label: "FAQ Page", site: "thequest", keys: faqPairs.flat(), pairs: faqPairs },
                { label: "Email Templates", site: "thequest", keys: ["email_welcome_subject", "email_welcome_heading", "email_welcome_body", "email_receipt_subject", "email_receipt_heading", "email_receipt_body", "email_receipt_footer"], pairs: [["email_welcome_subject", "email_welcome_heading", "email_welcome_body"], ["email_receipt_subject", "email_receipt_heading", "email_receipt_body", "email_receipt_footer"]] },
              ];
              const groups = allGroups.filter(g => g.site === liverySubTab);
              const isLongField = (key: string) => key.includes("rules") || key.includes("details") || key.includes("summary") || key.includes("faq_") || key.includes("_desc") || key.includes("how_") || (key.startsWith("email_") && (key.includes("_body") || key.includes("_footer")));
              const renderField = (item: any) => {
                const currentText = item.textContent || item.defaultText || "";
                const isCustomText = !!item.textContent;
                const shortLabel = item.label.replace(/^(Home Page - |Category |Hero |Social - |About Page - |FAQ \d+ - |Why The Quest - |How It Works - |Step \d+: |Welcome Email - |Purchase Receipt Email - )/, "");
                return (
                  <div key={item.imageKey} data-testid={`livery-item-${item.imageKey}`}>
                    <div className="flex items-center justify-between gap-1 mb-1 flex-wrap">
                      <label className="text-xs text-white/60 font-medium" data-testid={`livery-label-${item.imageKey}`}>{shortLabel}</label>
                      {isCustomText && <Badge className="bg-orange-500/80 text-white border-0 text-[9px] leading-tight">Edited</Badge>}
                    </div>
                    {isLongField(item.imageKey) ? (
                      <Textarea
                        key={`${item.imageKey}-${currentText}`}
                        defaultValue={currentText}
                        rows={item.imageKey.startsWith("how_") || item.imageKey.includes("rules") || item.imageKey.includes("details") ? 8 : 3}
                        className="bg-zinc-800 border-white/25 text-white text-xs mb-1"
                        data-testid={`textarea-livery-${item.imageKey}`}
                        onBlur={(e) => {
                          const newText = e.target.value.trim();
                          if (newText !== currentText) updateLiveryTextMutation.mutate({ imageKey: item.imageKey, textContent: newText });
                        }}
                      />
                    ) : (
                      <Input
                        key={`${item.imageKey}-${currentText}`}
                        defaultValue={currentText}
                        className="bg-zinc-800 border-white/25 text-white text-xs h-8 mb-1"
                        data-testid={`textarea-livery-${item.imageKey}`}
                        onBlur={(e) => {
                          const newText = e.target.value.trim();
                          if (newText !== currentText) updateLiveryTextMutation.mutate({ imageKey: item.imageKey, textContent: newText });
                        }}
                      />
                    )}
                    <div className="flex items-center gap-1">
                      <Button size="sm" onClick={() => { const el = document.querySelector(`[data-testid="textarea-livery-${item.imageKey}"]`) as HTMLInputElement; if (el) updateLiveryTextMutation.mutate({ imageKey: item.imageKey, textContent: el.value.trim() }); }} disabled={updateLiveryTextMutation.isPending} className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white text-[10px] h-6 px-2" data-testid={`button-save-text-${item.imageKey}`}>Save</Button>
                      {isCustomText && <Button size="sm" variant="ghost" onClick={() => { updateLiveryTextMutation.mutate({ imageKey: item.imageKey, textContent: "" }); const el = document.querySelector(`[data-testid="textarea-livery-${item.imageKey}"]`) as HTMLInputElement; if (el) el.value = item.defaultText || ""; }} disabled={updateLiveryTextMutation.isPending} className="text-white/40 text-[10px] h-6 px-2" data-testid={`button-reset-text-${item.imageKey}`}><RotateCcw className="h-2.5 w-2.5 mr-0.5" />Reset</Button>}
                    </div>
                  </div>
                );
              };
              return groups.map((group) => {
                const items = group.keys.map(k => textItems.find((t: any) => t.imageKey === k)).filter(Boolean) as any[];
                if (items.length === 0) return null;
                const hasLong = items.some((it: any) => isLongField(it.imageKey));
                return (
                  <details key={group.label} className="mt-4 rounded-md bg-zinc-900 border border-white/15 overflow-visible">
                    <summary className="cursor-pointer px-3 py-2 flex items-center justify-between gap-2 select-none" data-testid={`livery-group-${group.label.toLowerCase().replace(/\s/g, "-")}`}>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs uppercase tracking-widest text-orange-400 font-bold">{group.label}</h3>
                        <Badge className="bg-white/10 text-white/50 border-0 text-[9px]">{items.length}</Badge>
                      </div>
                      <ChevronDown className="h-3.5 w-3.5 text-white/30 transition-transform [details[open]>&]:rotate-180" />
                    </summary>
                    <div className="px-3 pb-3">
                      {group.label === "Email Templates" && (
                        <div className="mb-3 p-2 rounded bg-zinc-800/80 border border-white/10">
                          <p className="text-[10px] text-white/40 mb-2">Welcome email placeholders: <code className="text-orange-400">{"{inviterName}"}</code>, <code className="text-orange-400">{"{role}"}</code>, <code className="text-orange-400">{"{nomineeName}"}</code>, <code className="text-orange-400">{"{nominatorName}"}</code>, <code className="text-orange-400">{"{competitionName}"}</code>, <code className="text-orange-400">{"{email}"}</code>, <code className="text-orange-400">{"{defaultPassword}"}</code>. Receipt: <code className="text-orange-400">{"{buyerName}"}</code>.</p>
                          <div className="flex items-center gap-2">
                            <Input placeholder="Test email address" className="bg-zinc-800 border-white/25 text-white text-xs h-7 flex-1" data-testid="input-test-email" id="test-email-input" defaultValue="" />
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Button size="sm" onClick={async () => { const el = document.getElementById("test-email-input") as HTMLInputElement; const to = el?.value?.trim(); if (!to) return; try { await apiRequest("POST", "/api/admin/test-email", { to, template: "welcome" }); toast({ title: "Welcome email sent!", description: `Sent to ${to}` }); } catch (err: any) { toast({ title: "Failed to send", description: err.message, variant: "destructive" }); } }} className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white text-[10px] h-7 px-3" data-testid="button-send-test-welcome">Send Welcome/Invite</Button>
                            <Button size="sm" onClick={async () => { const el = document.getElementById("test-email-input") as HTMLInputElement; const to = el?.value?.trim(); if (!to) return; try { await apiRequest("POST", "/api/admin/test-email", { to, template: "receipt" }); toast({ title: "Receipt email sent!", description: `Sent to ${to}` }); } catch (err: any) { toast({ title: "Failed to send", description: err.message, variant: "destructive" }); } }} className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white text-[10px] h-7 px-3" data-testid="button-send-test-receipt">Send Purchase Receipt</Button>
                          </div>
                        </div>
                      )}
                      {group.pairs ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {group.pairs.map((pair) => {
                            const pairItems = pair.map(k => textItems.find((t: any) => t.imageKey === k)).filter(Boolean) as any[];
                            if (pairItems.length === 0) return null;
                            const rawLabel = pairItems[0]?.label || "";
                            const pairLabel = rawLabel.startsWith("FAQ ") ? rawLabel.replace(/ - (Question|Answer)$/, "") : rawLabel.startsWith("Welcome Email") ? "Welcome / Invite Email" : rawLabel.startsWith("Purchase Receipt") ? "Purchase Receipt Email" : rawLabel.replace(/^Category (Title|Description) - /, "");
                            return (
                              <div key={pair[0]} className="rounded-md bg-zinc-800/60 border border-white/10 p-3">
                                <h4 className="text-xs text-orange-300/80 font-semibold uppercase tracking-wider mb-2">{pairLabel}</h4>
                                <div className="space-y-2">
                                  {pairItems.map((item: any) => renderField(item))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : hasLong ? (
                        <div className="space-y-3">{items.map((item: any) => renderField(item))}</div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{items.map((item: any) => renderField(item))}</div>
                      )}
                    </div>
                  </details>
                );
              });
            })()}

            {liverySubTab === "thequest" && <details className="mt-4 rounded-md bg-zinc-900 border border-white/15 overflow-visible">
              <summary className="cursor-pointer px-3 py-2 flex items-center justify-between gap-2 select-none" data-testid="livery-group-category-cards">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs uppercase tracking-widest text-orange-400 font-bold">Category Cards</h3>
                  <Badge className="bg-white/10 text-white/50 border-0 text-[9px]">{firestoreCategories?.length || 0}</Badge>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-white/30 transition-transform [details[open]>&]:rotate-180" />
              </summary>
              <div className="px-3 pb-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(firestoreCategories || []).map((cat: any) => (
                    <div key={cat.id} className="rounded-md bg-zinc-800/60 border border-white/10 p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h4 className="text-xs text-orange-300/80 font-semibold uppercase tracking-wider">{cat.name}</h4>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { if (confirm(`Delete "${cat.name}" category?`)) deleteCategoryMutation.mutate(cat.id); }}
                          disabled={deleteCategoryMutation.isPending}
                          className="text-red-400/60 hover:text-red-400 text-[10px] h-6 px-2"
                          data-testid={`button-delete-category-${cat.id}`}
                        >
                          <XIcon className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-white/60 font-medium mb-1 block">Title</label>
                          <Input
                            key={`cat-name-${cat.id}-${cat.name}`}
                            defaultValue={cat.name}
                            className="bg-zinc-800 border-white/25 text-white text-xs h-8 mb-1"
                            data-testid={`input-category-name-${cat.id}`}
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val && val !== cat.name) updateCategoryMutation.mutate({ id: cat.id, name: val });
                            }}
                          />
                          <Button size="sm" onClick={() => { const el = document.querySelector(`[data-testid="input-category-name-${cat.id}"]`) as HTMLInputElement; if (el && el.value.trim() && el.value.trim() !== cat.name) updateCategoryMutation.mutate({ id: cat.id, name: el.value.trim() }); }} disabled={updateCategoryMutation.isPending} className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white text-[10px] h-6 px-2" data-testid={`button-save-category-name-${cat.id}`}>Save</Button>
                        </div>
                        <div>
                          <label className="text-xs text-white/60 font-medium mb-1 block">Description</label>
                          <Input
                            key={`cat-desc-${cat.id}-${cat.description}`}
                            defaultValue={cat.description || ""}
                            className="bg-zinc-800 border-white/25 text-white text-xs h-8 mb-1"
                            data-testid={`input-category-desc-${cat.id}`}
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val !== (cat.description || "")) updateCategoryMutation.mutate({ id: cat.id, description: val });
                            }}
                          />
                          <Button size="sm" onClick={() => { const el = document.querySelector(`[data-testid="input-category-desc-${cat.id}"]`) as HTMLInputElement; if (el) updateCategoryMutation.mutate({ id: cat.id, description: el.value.trim() }); }} disabled={updateCategoryMutation.isPending} className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white text-[10px] h-6 px-2" data-testid={`button-save-category-desc-${cat.id}`}>Save</Button>
                        </div>
                        <div>
                          <label className="text-xs text-white/60 font-medium mb-1 block">Thumbnail (Image or Video up to 15s)</label>
                          {(cat.imageUrl || cat.videoUrl) && (
                            <div className="relative rounded-md overflow-hidden mb-2 bg-black/40 border border-white/10" style={{ maxHeight: "120px" }}>
                              {cat.videoUrl ? (
                                <video src={cat.videoUrl} className="w-full object-cover" style={{ maxHeight: "120px" }} autoPlay muted loop playsInline data-testid={`preview-category-video-${cat.id}`} />
                              ) : (
                                <img src={cat.imageUrl!} alt={cat.name} className="w-full object-cover" style={{ maxHeight: "120px" }} data-testid={`preview-category-img-${cat.id}`} />
                              )}
                              <div className="absolute top-1 right-1 flex gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    if (confirm("Remove this thumbnail?")) {
                                      updateCategoryMutation.mutate({ id: cat.id, imageUrl: null, videoUrl: null } as any);
                                    }
                                  }}
                                  className="bg-black/60 text-red-400 border-0"
                                  data-testid={`button-remove-category-media-${cat.id}`}
                                >
                                  <XIcon className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-2 mb-1">
                            <input
                              type="file"
                              accept="image/*,video/mp4,video/webm,video/quicktime"
                              className="hidden"
                              data-testid={`input-category-file-${cat.id}`}
                              id={`cat-file-${cat.id}`}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) uploadCategoryMediaMutation.mutate({ categoryId: cat.id, file });
                                e.target.value = "";
                              }}
                            />
                            <Button
                              size="sm"
                              onClick={() => (document.getElementById(`cat-file-${cat.id}`) as HTMLInputElement)?.click()}
                              disabled={uploadCategoryMediaMutation.isPending}
                              className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white text-[10px] h-7 px-3"
                              data-testid={`button-upload-category-media-${cat.id}`}
                            >
                              <Upload className="h-3 w-3 mr-1" />
                              {uploadCategoryMediaMutation.isPending ? "Uploading..." : "Upload File"}
                            </Button>
                            <span className="text-[10px] text-white/25">or paste URL below</span>
                          </div>
                          <Input
                            key={`cat-img-${cat.id}-${cat.imageUrl}`}
                            defaultValue={cat.imageUrl || ""}
                            placeholder="https://... or /images/template/a1.jpg"
                            className="bg-zinc-800 border-white/25 text-white text-xs h-8 mb-1"
                            data-testid={`input-category-img-${cat.id}`}
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val !== (cat.imageUrl || "")) updateCategoryMutation.mutate({ id: cat.id, imageUrl: val || null } as any);
                            }}
                          />
                          <Button size="sm" onClick={() => { const el = document.querySelector(`[data-testid="input-category-img-${cat.id}"]`) as HTMLInputElement; if (el) updateCategoryMutation.mutate({ id: cat.id, imageUrl: el.value.trim() || null } as any); }} disabled={updateCategoryMutation.isPending} className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white text-[10px] h-6 px-2" data-testid={`button-save-category-img-${cat.id}`}>Save URL</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {addingCategory ? (
                  <div className="mt-3 rounded-md bg-zinc-800/60 border border-orange-500/30 p-3">
                    <h4 className="text-xs text-orange-300/80 font-semibold uppercase tracking-wider mb-2">New Category</h4>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-white/60 font-medium mb-1 block">Title</label>
                        <Input
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                          placeholder="Category name"
                          className="bg-zinc-800 border-white/25 text-white text-xs h-8"
                          data-testid="input-new-category-name"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-white/60 font-medium mb-1 block">Description</label>
                        <Input
                          value={newCatDesc}
                          onChange={(e) => setNewCatDesc(e.target.value)}
                          placeholder="Short description"
                          className="bg-zinc-800 border-white/25 text-white text-xs h-8"
                          data-testid="input-new-category-desc"
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Button size="sm" onClick={() => { if (newCatName.trim()) addCategoryMutation.mutate({ name: newCatName.trim(), description: newCatDesc.trim() }); }} disabled={!newCatName.trim() || addCategoryMutation.isPending} className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white text-[10px] h-6 px-3" data-testid="button-save-new-category">
                          <Check className="h-3 w-3 mr-1" />Add
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setAddingCategory(false); setNewCatName(""); setNewCatDesc(""); }} className="text-white/40 text-[10px] h-6 px-2" data-testid="button-cancel-new-category">Cancel</Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => setAddingCategory(true)}
                    className="mt-3 bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white text-[10px] h-7 px-3"
                    data-testid="button-add-category"
                  >
                    <Plus className="h-3 w-3 mr-1" />Add Category
                  </Button>
                )}
              </div>
            </details>}

            {(!liveryItems || liveryItems.length === 0) && (
              <div className="rounded-md bg-white/5 border border-white/5 p-6 text-center">
                <Image className="h-8 w-8 text-white/10 mx-auto mb-2" />
                <p className="text-sm text-white/30">No livery items configured yet. Restart the app to seed defaults.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="join">
            <div className="space-y-6">
              {joinSettings && (
                <div className="rounded-md bg-white/5 border border-white/5 p-5" data-testid="join-settings-panel">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                    <div className="flex items-center gap-3">
                      <Settings className="h-5 w-5 text-orange-400" />
                      <h3 className="font-bold text-lg">Nomination Settings</h3>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <InviteDialog senderLevel={4} />
                      <span className="text-xs text-white/40">Active</span>
                      <Switch
                        checked={joinSettings.isActive}
                        onCheckedChange={(val) => updateJoinSettingsMutation.mutate({ isActive: val })}
                        data-testid="switch-join-active"
                      />
                    </div>
                  </div>
                  <div className="mb-4">
                    <Label className="text-white/60 mb-2 block">Free Nomination Promo Code</Label>
                    {joinSettings.freeNominationPromoCode ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-green-400/70 uppercase tracking-wider mb-1">Active Promo Code</p>
                            <p className="text-xl font-bold text-green-300 tracking-[4px] uppercase" data-testid="text-active-promo-code">{joinSettings.freeNominationPromoCode}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-green-500/30 text-green-300 hover:bg-green-500/20 gap-1.5"
                              data-testid="button-copy-promo"
                              onClick={async () => {
                                const code = joinSettings.freeNominationPromoCode || "";
                                try {
                                  await navigator.clipboard.writeText(code);
                                } catch {
                                  const ta = document.createElement("textarea");
                                  ta.value = code;
                                  ta.style.position = "fixed";
                                  ta.style.opacity = "0";
                                  document.body.appendChild(ta);
                                  ta.select();
                                  document.execCommand("copy");
                                  document.body.removeChild(ta);
                                }
                                toast({ title: "Copied!", description: "Promo code copied to clipboard." });
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" /> Copy
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-orange-500/30 text-orange-300 hover:bg-orange-500/20 gap-1.5"
                              data-testid="button-share-promo"
                              onClick={async () => {
                                const text = `Use promo code ${joinSettings.freeNominationPromoCode} for a FREE nomination at ${window.location.origin}/nominate`;
                                try {
                                  await navigator.clipboard.writeText(text);
                                } catch {
                                  const ta = document.createElement("textarea");
                                  ta.value = text;
                                  ta.style.position = "fixed";
                                  ta.style.opacity = "0";
                                  document.body.appendChild(ta);
                                  ta.select();
                                  document.execCommand("copy");
                                  document.body.removeChild(ta);
                                }
                                toast({ title: "Share message copied!", description: text });
                              }}
                            >
                              <Share2 className="h-3.5 w-3.5" /> Share
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Input
                            key={`promo-${joinSettings.freeNominationPromoCode}`}
                            id="edit-promo-code-input"
                            defaultValue={joinSettings.freeNominationPromoCode || ""}
                            placeholder="e.g. HIFITFREE"
                            className="bg-white/5 border-white/10 text-white uppercase max-w-xs"
                            data-testid="input-promo-code"
                          />
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white gap-1.5"
                            data-testid="button-save-promo-edit"
                            onClick={() => {
                              const input = document.getElementById("edit-promo-code-input") as HTMLInputElement;
                              if (input?.value.trim()) {
                                updateJoinSettingsMutation.mutate({ freeNominationPromoCode: input.value.trim().toUpperCase() });
                                toast({ title: "Saved!", description: "Promo code updated." });
                              }
                            }}
                          >
                            <Check className="h-3.5 w-3.5" /> Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1.5"
                            onClick={() => updateJoinSettingsMutation.mutate({ freeNominationPromoCode: "" })}
                            data-testid="button-remove-promo"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </Button>
                        </div>
                        <p className="text-xs text-white/30">Edit the code above or remove it to disable free nominations.</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Input
                            key={`promo-${joinSettings.freeNominationPromoCode}`}
                            id="new-promo-code-input"
                            defaultValue=""
                            placeholder="e.g. HIFITFREE"
                            className="bg-white/5 border-white/10 text-white uppercase max-w-xs"
                            data-testid="input-promo-code"
                          />
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white gap-1.5"
                            data-testid="button-save-promo"
                            onClick={() => {
                              const input = document.getElementById("new-promo-code-input") as HTMLInputElement;
                              if (input?.value.trim()) {
                                updateJoinSettingsMutation.mutate({ freeNominationPromoCode: input.value.trim().toUpperCase() });
                                toast({ title: "Saved!", description: "Promo code has been set." });
                              }
                            }}
                          >
                            <Check className="h-3.5 w-3.5" /> Save
                          </Button>
                        </div>
                        <p className="text-xs text-white/30">Set a code that nominators can enter to skip the nomination fee.</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-white/60">Page Title</Label>
                      <Input
                        defaultValue={joinSettings.pageTitle}
                        onBlur={(e) => updateJoinSettingsMutation.mutate({ pageTitle: e.target.value })}
                        className="bg-white/5 border-white/10 text-white"
                        data-testid="input-join-title"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-white/60">Page Description</Label>
                      <Textarea
                        defaultValue={joinSettings.pageDescription}
                        onBlur={(e) => updateJoinSettingsMutation.mutate({ pageDescription: e.target.value })}
                        className="bg-white/5 border-white/10 text-white resize-none min-h-[80px]"
                        data-testid="input-join-description"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-white/60">Required Fields</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {["fullName", "email", "phone", "address", "city", "state", "zip", "bio", "category", "socialLinks"].map((field) => {
                          const active = joinSettings.requiredFields?.includes(field);
                          return (
                            <button
                              key={field}
                              onClick={() => {
                                const current = joinSettings.requiredFields || [];
                                const updated = active ? current.filter((f) => f !== field) : [...current, field];
                                updateJoinSettingsMutation.mutate({ requiredFields: updated });
                              }}
                              className={`text-xs px-3 py-1.5 border transition-colors ${active ? "bg-orange-500/20 border-orange-500/50 text-orange-400" : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"}`}
                              data-testid={`toggle-join-field-${field}`}
                            >
                              {field}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-white/20 mt-1">Click to toggle required fields on the nomination form.</p>
                    </div>
                    <div className="mt-4 rounded-md bg-white/5 border border-white/10 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Award className="h-4 w-4 text-orange-400" />
                        <Label className="text-white/80 font-semibold">Non-Profit / Charity</Label>
                      </div>
                      <p className="text-xs text-white/30 mb-3">Specify a non-profit to receive a portion of voting proceeds.</p>
                      <div className="flex items-center justify-between mb-4 p-3 rounded bg-white/[0.03] border border-white/5">
                        <div>
                          <Label className="text-white/80 text-sm">Require Choice of Non-Profit</Label>
                          <p className="text-xs text-white/30 mt-0.5">When enabled, applicants and nominees must select or enter a non-profit organization.</p>
                        </div>
                        <Switch
                          checked={joinSettings.nonprofitRequired === true}
                          onCheckedChange={(val) => updateJoinSettingsMutation.mutate({ nonprofitRequired: val })}
                          data-testid="switch-nonprofit-required"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-white/60">Charity Name</Label>
                        <Input
                          key={`charity-name-${joinSettings.charityName}`}
                          defaultValue={joinSettings.charityName || ""}
                          placeholder="e.g. Hawaii Food Bank"
                          onBlur={(e) => updateJoinSettingsMutation.mutate({ charityName: e.target.value.trim() })}
                          className="bg-white/5 border-white/10 text-white"
                          data-testid="input-charity-name"
                        />
                      </div>
                    </div>
                    <div className="mt-4 rounded-md bg-white/5 border border-white/10 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <UserPlus className="h-4 w-4 text-orange-400" />
                        <Label className="text-white/80 font-semibold">Nominations</Label>
                      </div>
                      <p className="text-xs text-white/30 mb-3">Allow visitors to nominate someone else for a competition.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-white/60">Enable Nominations</Label>
                          <Switch
                            checked={joinSettings.nominationEnabled !== false}
                            onCheckedChange={(val) => updateJoinSettingsMutation.mutate({ nominationEnabled: val })}
                            data-testid="switch-nomination-enabled"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-white/60">Nomination Fee ($)</Label>
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-white/30" />
                            <Input
                              type="number"
                              step="0.01"
                              key={`nom-fee-${joinSettings.nominationFee}`}
                              defaultValue={((joinSettings.nominationFee || 0) / 100).toFixed(2)}
                              onBlur={(e) => {
                                const cents = Math.round((parseFloat(e.target.value) || 0) * 100);
                                updateJoinSettingsMutation.mutate({ nominationFee: cents });
                              }}
                              className="bg-white/5 border-white/10 text-white"
                              data-testid="input-nomination-fee"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-bold text-lg mb-3">Nomination Submissions ({joinSubmissions?.length || 0})</h3>
                {joinSubmissions && joinSubmissions.length > 0 ? (
                  <div className="space-y-3">
                    {joinSubmissions.map((sub) => (
                      <div key={sub.id} className="rounded-md bg-white/5 border border-white/5" data-testid={`join-sub-${sub.id}`}>
                        <div className="flex flex-wrap items-center justify-between gap-4 p-4">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-medium">{sub.fullName}</h4>
                              {sub.type === "nomination" && (
                                <Badge className="border-0 bg-purple-500/20 text-purple-400 text-[10px]">Nomination</Badge>
                              )}
                              {sub.type === "nomination" && sub.nominationStatus && sub.nominationStatus !== "pending" && (
                                <Badge className={`border-0 text-[10px] ${
                                  sub.nominationStatus === "joined" ? "bg-green-500/20 text-green-400" :
                                  sub.nominationStatus === "unsure" ? "bg-yellow-500/20 text-yellow-400" :
                                  "bg-red-500/20 text-red-400"
                                }`}>
                                  {sub.nominationStatus === "not_interested" ? "Not Interested" : sub.nominationStatus === "joined" ? "Joined" : "Unsure"}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-white/30">{sub.email} {sub.category && `| ${sub.category}`}</p>
                            {sub.type === "nomination" && sub.nominatorName && (
                              <p className="text-xs text-purple-300/60 mt-1">
                                Nominated by: {sub.nominatorName}
                              </p>
                            )}
                            <p className="text-xs text-white/20 mt-1">{new Date(sub.createdAt).toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={`border-0 ${sub.status === "approved" ? "bg-green-500/20 text-green-400" : sub.status === "rejected" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                              {sub.status}
                            </Badge>
                            {sub.status === "pending" && (
                              <>
                                <Button size="icon" onClick={() => updateJoinSubmissionMutation.mutate({ id: sub.id, status: "approved" })}
                                  className="bg-green-500/20 text-green-400 border-0" data-testid={`button-approve-join-${sub.id}`}>
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button size="icon" onClick={() => updateJoinSubmissionMutation.mutate({ id: sub.id, status: "rejected" })}
                                  className="bg-red-500/20 text-red-400 border-0" data-testid={`button-reject-join-${sub.id}`}>
                                  <XIcon className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setExpandedSubmission(expandedSubmission === sub.id ? null : sub.id)}
                              className="border-white/10 text-white/60 text-xs"
                              data-testid={`button-details-${sub.id}`}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              {expandedSubmission === sub.id ? "Hide" : "Details"}
                            </Button>
                          </div>
                        </div>

                        {expandedSubmission === sub.id && (
                          <div className="border-t border-white/5 p-4 space-y-4" data-testid={`details-panel-${sub.id}`}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-3">
                                <h5 className="text-xs uppercase tracking-wider text-orange-400 font-semibold">
                                  {sub.type === "nomination" ? "Nominee Information" : "Applicant Information"}
                                </h5>
                                <div>
                                  <p className="text-[10px] text-white/30 uppercase tracking-wider">Full Name</p>
                                  <p className="text-sm text-white">{sub.fullName}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-white/30 uppercase tracking-wider">Email</p>
                                  <a href={`mailto:${sub.email}`} className="text-sm text-[#FF5A09] hover:underline">{sub.email}</a>
                                </div>
                                {sub.phone && (
                                  <div>
                                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Phone</p>
                                    <a href={`tel:${sub.phone}`} className="text-sm text-[#FF5A09] hover:underline">{sub.phone}</a>
                                  </div>
                                )}
                                {sub.category && (
                                  <div>
                                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Category</p>
                                    <p className="text-sm text-white">{sub.category}</p>
                                  </div>
                                )}
                                {sub.bio && (
                                  <div>
                                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Bio</p>
                                    <p className="text-sm text-white/70">{sub.bio}</p>
                                  </div>
                                )}
                                {(sub.address || sub.city || sub.state || sub.zip) && (
                                  <div>
                                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Address</p>
                                    <p className="text-sm text-white/70">
                                      {[sub.address, sub.city, sub.state, sub.zip].filter(Boolean).join(", ")}
                                    </p>
                                  </div>
                                )}
                                {sub.socialLinks && (
                                  <div>
                                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Social Links</p>
                                    <p className="text-sm text-white/70">{sub.socialLinks}</p>
                                  </div>
                                )}
                                {sub.chosenNonprofit && (
                                  <div>
                                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Choice of Non-Profit</p>
                                    <p className="text-sm text-[#FF5A09]">{sub.chosenNonprofit}</p>
                                  </div>
                                )}
                              </div>

                              {sub.type === "nomination" && (
                                <div className="space-y-3">
                                  <h5 className="text-xs uppercase tracking-wider text-purple-400 font-semibold">Nominator Information</h5>
                                  {sub.nominatorName && (
                                    <div>
                                      <p className="text-[10px] text-white/30 uppercase tracking-wider">Nominator Name</p>
                                      <p className="text-sm text-white">{sub.nominatorName}</p>
                                    </div>
                                  )}
                                  {sub.nominatorEmail && (
                                    <div>
                                      <p className="text-[10px] text-white/30 uppercase tracking-wider">Nominator Email</p>
                                      <a href={`mailto:${sub.nominatorEmail}`} className="text-sm text-[#FF5A09] hover:underline">{sub.nominatorEmail}</a>
                                    </div>
                                  )}
                                  {sub.nominatorPhone && (
                                    <div>
                                      <p className="text-[10px] text-white/30 uppercase tracking-wider">Nominator Phone</p>
                                      <a href={`tel:${sub.nominatorPhone}`} className="text-sm text-[#FF5A09] hover:underline">{sub.nominatorPhone}</a>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {sub.amountPaid > 0 && (
                              <div className="rounded-md bg-green-500/5 border border-green-500/10 p-3">
                                <p className="text-xs text-green-400">
                                  Payment: ${(sub.amountPaid / 100).toFixed(2)}
                                  {sub.transactionId && <span className="text-white/30 ml-2">Transaction: {sub.transactionId}</span>}
                                </p>
                              </div>
                            )}

                            {sub.type === "nomination" && (
                              <div className="rounded-md bg-white/[0.03] border border-white/5 p-4">
                                <p className="text-xs uppercase tracking-wider text-white/40 mb-3 font-semibold">Nomination Status</p>
                                <div className="flex flex-wrap gap-2">
                                  {([
                                    { value: "joined", label: "Joined", color: "bg-green-500/20 text-green-400 border-green-500/30" },
                                    { value: "unsure", label: "Unsure", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
                                    { value: "not_interested", label: "Not Interested", color: "bg-red-500/20 text-red-400 border-red-500/30" },
                                    { value: "pending", label: "Pending", color: "bg-white/10 text-white/50 border-white/10" },
                                  ] as const).map(opt => (
                                    <button
                                      key={opt.value}
                                      onClick={() => updateNominationStatusMutation.mutate({ id: sub.id, nominationStatus: opt.value })}
                                      className={`px-4 py-2 text-xs uppercase tracking-wider font-bold border transition-all duration-200 ${
                                        (sub.nominationStatus || "pending") === opt.value
                                          ? `${opt.color} ring-1 ring-white/20`
                                          : "bg-white/[0.03] text-white/30 border-white/5 hover:border-white/15 hover:text-white/50"
                                      }`}
                                      data-testid={`button-nom-status-${opt.value}-${sub.id}`}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md bg-white/5 border border-white/5 p-6 text-center">
                    <UserPlus className="h-8 w-8 text-white/10 mx-auto mb-2" />
                    <p className="text-sm text-white/30">No nomination submissions yet.</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="host">
            <div className="space-y-6">
              {hostSettings && (
                <div className="rounded-md bg-white/5 border border-white/5" data-testid="host-settings-panel">
                  <button
                    onClick={() => setHostSettingsOpen(!hostSettingsOpen)}
                    className="w-full flex items-center justify-between gap-4 p-5"
                    data-testid="button-toggle-host-settings"
                  >
                    <div className="flex items-center gap-3">
                      <Settings className="h-5 w-5 text-orange-400" />
                      <h3 className="font-bold text-lg">Host Page Settings</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={`border-0 ${hostSettings.isActive ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"}`}>
                        {hostSettings.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {hostSettingsOpen ? <ChevronUp className="h-5 w-5 text-white/40" /> : <ChevronDown className="h-5 w-5 text-white/40" />}
                    </div>
                  </button>
                  {hostSettingsOpen && (
                    <div className="px-5 pb-5 space-y-5 border-t border-white/5 pt-5">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-white/60">Enable Host Page</span>
                        <Switch
                          checked={hostSettings.isActive}
                          onCheckedChange={(val) => updateHostSettingsMutation.mutate({ isActive: val })}
                          data-testid="switch-host-active"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-white/60">Mode</Label>
                          <Select value={hostSettings.mode} onValueChange={(val) => updateHostSettingsMutation.mutate({ mode: val as "request" | "purchase" })}>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-host-mode">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-white/10">
                              <SelectItem value="request">Free Application</SelectItem>
                              <SelectItem value="purchase">Paid Entry</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {hostSettings.mode === "purchase" && (
                          <div className="space-y-1.5">
                            <Label className="text-white/60">Price (cents)</Label>
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-white/30" />
                              <Input type="number" defaultValue={hostSettings.price}
                                onBlur={(e) => updateHostSettingsMutation.mutate({ price: parseInt(e.target.value) || 0 })}
                                className="bg-white/5 border-white/10 text-white" data-testid="input-host-price" />
                            </div>
                            <p className="text-xs text-white/30">${((hostSettings.price || 0) / 100).toFixed(2)}</p>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-white/60">Page Title</Label>
                        <Input defaultValue={hostSettings.pageTitle}
                          onBlur={(e) => updateHostSettingsMutation.mutate({ pageTitle: e.target.value })}
                          className="bg-white/5 border-white/10 text-white" data-testid="input-host-title" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-white/60">Page Description</Label>
                        <Textarea defaultValue={hostSettings.pageDescription}
                          onBlur={(e) => updateHostSettingsMutation.mutate({ pageDescription: e.target.value })}
                          className="bg-white/5 border-white/10 text-white resize-none min-h-[80px]" data-testid="input-host-description" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-white/60">Required Fields</Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {["fullName", "email", "phone", "organization", "address", "city", "state", "zip", "eventName", "eventDescription", "eventCategory", "eventDate", "socialLinks"].map((field) => {
                            const active = hostSettings.requiredFields?.includes(field);
                            return (
                              <button key={field} onClick={() => {
                                const current = hostSettings.requiredFields || [];
                                const updated = active ? current.filter((f) => f !== field) : [...current, field];
                                updateHostSettingsMutation.mutate({ requiredFields: updated });
                              }}
                                className={`text-xs px-3 py-1.5 border transition-colors ${active ? "bg-orange-500/20 border-orange-500/50 text-orange-400" : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"}`}
                                data-testid={`toggle-host-field-${field}`}>{field}</button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-white/20 mt-1">Click to toggle required fields on the host form.</p>
                      </div>
                      {hostSubmissions && hostSubmissions.length > 0 && (
                        <div className="border-t border-white/5 pt-4">
                          <h4 className="font-bold text-sm mb-3">Host Submissions ({hostSubmissions.length})</h4>
                          <div className="space-y-3">
                            {hostSubmissions.map((sub) => (
                              <div key={sub.id} className="rounded-md bg-white/[0.03] border border-white/5 p-4" data-testid={`host-sub-${sub.id}`}>
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                  <div>
                                    <h4 className="font-medium">{sub.eventName}</h4>
                                    <p className="text-xs text-white/30">{sub.fullName} | {sub.email}</p>
                                    {sub.organization && <p className="text-xs text-white/40">{sub.organization}</p>}
                                    {sub.eventCategory && <p className="text-xs text-white/40 mt-1">Category: {sub.eventCategory}</p>}
                                    {sub.eventDate && <p className="text-xs text-white/40">Date: {sub.eventDate}</p>}
                                    {sub.eventDescription && <p className="text-xs text-white/40 mt-1 line-clamp-2">{sub.eventDescription}</p>}
                                    {sub.amountPaid > 0 && (
                                      <p className="text-xs text-green-400 mt-1">Paid ${(sub.amountPaid / 100).toFixed(2)} {sub.transactionId && `(${sub.transactionId})`}</p>
                                    )}
                                    <p className="text-xs text-white/20 mt-1">{new Date(sub.createdAt).toLocaleDateString()}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge className={`border-0 ${sub.status === "approved" ? "bg-green-500/20 text-green-400" : sub.status === "rejected" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                                      {sub.status}
                                    </Badge>
                                    {sub.status === "pending" && (
                                      <>
                                        <Button size="icon" onClick={() => updateHostSubmissionMutation.mutate({ id: sub.id, status: "approved" })}
                                          className="bg-green-500/20 text-green-400 border-0" data-testid={`button-approve-host-${sub.id}`}>
                                          <Check className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" onClick={() => updateHostSubmissionMutation.mutate({ id: sub.id, status: "rejected" })}
                                          className="bg-red-500/20 text-red-400 border-0" data-testid={`button-reject-host-${sub.id}`}>
                                          <XIcon className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <Input
                      placeholder="Search hosts..."
                      value={hostSearch}
                      onChange={(e) => { setHostSearch(e.target.value); setHostPage(1); }}
                      className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      data-testid="input-host-search"
                    />
                  </div>
                  <span className="text-xs text-white/30" data-testid="text-host-count">{filteredHosts.length} host{filteredHosts.length !== 1 ? "s" : ""}</span>
                  <InviteHostDialog />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {paginatedHosts.map((host) => (
                    <div key={host.userId} className="rounded-md bg-white/5 border border-white/5 overflow-visible" data-testid={`host-card-${host.userId}`}>
                      <div className="relative h-[200px] rounded-t-md flex flex-col justify-end bg-gradient-to-b from-purple-900/40 to-black">
                        <div className="absolute inset-0 rounded-t-md flex items-center justify-center">
                          <Users className="h-16 w-16 text-white/10" />
                        </div>
                        <div className="absolute inset-0 rounded-t-md bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                        <div className="relative z-10 p-4">
                          <h3 className="font-bold text-lg text-white drop-shadow-md">{host.displayName}</h3>
                          {host.stageName && <p className="text-xs text-white/50">{host.stageName}</p>}
                          <div className="flex flex-wrap items-center gap-3 mt-1">
                            <Badge className="border-0 bg-purple-500/20 text-purple-300">Host</Badge>
                            <span className="text-xs text-white/60">{host.competitionCount} competition{host.competitionCount !== 1 ? "s" : ""}</span>
                            {host.activeCompetitions > 0 && (
                              <span className="text-xs text-green-400">{host.activeCompetitions} active</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 p-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedHostId(expandedHostId === host.userId ? null : host.userId)}
                          className="text-orange-400"
                          data-testid={`button-expand-host-${host.userId}`}
                        >
                          {expandedHostId === host.userId ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                          {expandedHostId === host.userId ? "Hide Competitions" : "View Competitions"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setAssignHostUid(host.userId); setAssignHostDialogOpen(true); }}
                          className="text-white/40"
                          data-testid={`button-assign-comp-${host.userId}`}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Assign Competition
                        </Button>
                      </div>
                      {expandedHostId === host.userId && <ExpandedHostComps hostUid={host.userId} hostName={host.displayName} />}
                    </div>
                  ))}
                </div>
                {filteredHosts.length === 0 && (
                  <div className="text-center py-12 text-white/30 text-sm" data-testid="text-no-hosts">
                    {hostUsers && hostUsers.length === 0 ? "No host users yet. Promote users to Host level from the Users tab." : "No hosts found matching your search."}
                  </div>
                )}
                {totalHostPages > 1 && (
                  <div className="flex flex-wrap items-center justify-center gap-2 mt-6" data-testid="host-pagination">
                    <Button variant="ghost" size="sm" disabled={hostPage <= 1} onClick={() => setHostPage(p => p - 1)}
                      className="text-white/60" data-testid="button-host-prev">Previous</Button>
                    {Array.from({ length: totalHostPages }, (_, i) => i + 1).map(page => (
                      <Button key={page} variant={page === hostPage ? "default" : "ghost"} size="sm" onClick={() => setHostPage(page)}
                        className={page === hostPage ? "bg-orange-500 border-0 text-white" : "text-white/40"}
                        data-testid={`button-host-page-${page}`}>{page}</Button>
                    ))}
                    <Button variant="ghost" size="sm" disabled={hostPage >= totalHostPages} onClick={() => setHostPage(p => p + 1)}
                      className="text-white/60" data-testid="button-host-next">Next</Button>
                  </div>
                )}
              </div>
            </div>

            <Dialog open={assignHostDialogOpen} onOpenChange={setAssignHostDialogOpen}>
              <DialogContent className="bg-zinc-900 border-white/10 text-white">
                <DialogHeader>
                  <DialogTitle className="font-serif text-xl">Assign Competitions to Host</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <p className="text-sm text-white/60">
                    Assigning to: <span className="text-white font-medium">{hostUsers?.find(h => h.userId === assignHostUid)?.displayName || "Unknown"}</span>
                  </p>
                  {(() => {
                    const alreadyAssigned = competitions?.filter(c => c.createdBy === assignHostUid) || [];
                    const available = competitions?.filter(c => c.createdBy !== assignHostUid) || [];
                    return (
                      <>
                        {alreadyAssigned.length > 0 && (
                          <div className="space-y-1.5">
                            <Label className="text-white/40 text-xs uppercase tracking-wider">Currently Assigned ({alreadyAssigned.length})</Label>
                            <div className="space-y-1">
                              {alreadyAssigned.map(c => (
                                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/5 p-2">
                                  <span className="text-sm">{c.title}</span>
                                  <Badge className={`border-0 text-xs ${c.status === "active" || c.status === "voting" ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"}`}>{c.status === "voting" ? "Active" : c.status}</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <Label className="text-white/60">Add Another Competition</Label>
                          <Select value={assignCompId} onValueChange={setAssignCompId}>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-assign-comp">
                              <SelectValue placeholder="Choose a competition..." />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-white/10">
                              {available.map(c => (
                                <SelectItem key={c.id} value={String(c.id)}>{c.title} ({c.status})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {available.length === 0 && (
                            <p className="text-xs text-white/30">All competitions are already assigned to this host.</p>
                          )}
                        </div>
                        <Button
                          onClick={() => assignHostUid && assignCompId && assignHostMutation.mutate({ compId: parseInt(assignCompId), hostUid: assignHostUid })}
                          disabled={!assignCompId || assignHostMutation.isPending}
                          className="w-full bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white"
                          data-testid="button-confirm-assign"
                        >
                          {assignHostMutation.isPending ? "Assigning..." : "Assign Competition"}
                        </Button>
                      </>
                    );
                  })()}
                  <Button variant="ghost" onClick={() => setAssignHostDialogOpen(false)} className="w-full text-white/40" data-testid="button-close-assign">
                    Done
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="users">
            <div className="space-y-4" data-testid="users-tab-content">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={usersView === "users" ? "default" : "ghost"}
                    onClick={() => setUsersView("users")}
                    className={usersView === "users" ? "bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white" : "text-white/50"}
                    data-testid="button-view-users"
                  >
                    <Users className="h-4 w-4 mr-1" /> Users
                  </Button>
                  <Button
                    size="sm"
                    variant={usersView === "applications" ? "default" : "ghost"}
                    onClick={() => setUsersView("applications")}
                    className={usersView === "applications" ? "bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white" : "text-white/50"}
                    data-testid="button-view-applications"
                  >
                    <UserCheck className="h-4 w-4 mr-1" /> Applications
                    {pending.length > 0 && <Badge className="ml-1.5 bg-orange-500 text-white border-0 text-[10px] px-1.5 py-0">{pending.length}</Badge>}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <CreateUserDialog />
                  <InviteDialog senderLevel={4} />
                </div>
              </div>

              {usersView === "users" ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <Input
                      value={userSearch}
                      onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                      placeholder="Search by name, stage name, or category..."
                      className="bg-white/5 border-white/10 text-white pl-10"
                      data-testid="input-user-search"
                    />
                  </div>

                  {usersLoading ? (
                    <div className="rounded-md bg-white/5 border border-white/5 p-6 text-center">
                      <p className="text-sm text-white/30">Loading users...</p>
                    </div>
                  ) : filteredUsers && filteredUsers.length > 0 ? (
                    <div className="space-y-2">
                      {paginatedUsers.map((u) => (
                        <div
                          key={u.id}
                          className="rounded-md bg-white/5 border border-white/5 p-4 cursor-pointer transition-colors hover:bg-white/[0.08]"
                          onClick={() => setUserDetailId(u.id)}
                          data-testid={`user-row-${u.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={u.imageUrls?.[0] || ""} />
                              <AvatarFallback className="bg-orange-500/20 text-orange-400 text-sm font-bold">
                                {u.displayName?.charAt(0) || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium" data-testid={`user-name-${u.id}`}>{u.displayName}</h4>
                              <div className="flex flex-wrap items-center gap-2">
                                {u.stageName && <span className="text-xs text-white/40">{u.stageName}</span>}
                                {u.category && <Badge className="bg-orange-500/10 text-orange-400/80 border-0 text-xs">{u.category}</Badge>}
                                <Badge className={`border-0 text-xs ${u.role === "admin" ? "bg-red-500/20 text-red-400" : u.role === "host" ? "bg-purple-500/20 text-purple-300" : u.role === "talent" ? "bg-blue-500/20 text-blue-400" : "bg-white/10 text-white/50"}`}>
                                  {u.role === "admin" ? "Admin" : u.role === "host" ? "Host" : u.role === "talent" ? "Talent" : "Viewer"}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Eye className="h-4 w-4 text-white/20" />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Permanently delete ${u.displayName}? This removes them from Firebase, Firestore, all competitions, and everything. This cannot be undone.`)) {
                                    deleteUserMutation.mutate(u.userId);
                                  }
                                }}
                                data-testid={`button-delete-user-${u.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {totalUserPages > 1 && (
                        <div className="flex flex-wrap items-center justify-center gap-2 mt-6" data-testid="user-pagination">
                          {Array.from({ length: totalUserPages }, (_, i) => i + 1).map(page => (
                            <Button key={page} variant={page === userPage ? "default" : "ghost"} size="sm" onClick={() => setUserPage(page)}
                              className={page === userPage ? "bg-orange-500 text-white" : "text-white/50 hover:text-white"}
                              data-testid={`user-page-${page}`}>
                              {page}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-md bg-white/5 border border-white/5 p-6 text-center">
                      <Users className="h-8 w-8 text-white/10 mx-auto mb-2" />
                      <p className="text-sm text-white/30">{userSearch ? "No users match your search." : "No talent profiles found."}</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {allContestants && allContestants.length > 0 ? (
                    <div className="space-y-3">
                      {allContestants.map((contestant) => (
                        <div key={contestant.id} className="rounded-md bg-white/5 border border-white/5 p-4" data-testid={`admin-contestant-${contestant.id}`}>
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={contestant.talentProfile.imageUrls?.[0] || ""} />
                                <AvatarFallback className="bg-orange-500/20 text-orange-400 text-sm font-bold">
                                  {contestant.talentProfile.displayName?.charAt(0) || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <h4 className="font-medium">{contestant.talentProfile.displayName}</h4>
                                <p className="text-xs text-white/30">{contestant.competitionTitle} | {contestant.talentProfile.category}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={`border-0 ${contestant.applicationStatus === "approved" ? "bg-green-500/20 text-green-400" : contestant.applicationStatus === "rejected" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                                {contestant.applicationStatus}
                              </Badge>
                              {contestant.applicationStatus === "pending" && (
                                <>
                                  <Button size="icon" onClick={() => updateStatusMutation.mutate({ id: contestant.id, status: "approved" })}
                                    className="bg-green-500/20 text-green-400 border-0" data-testid={`button-approve-${contestant.id}`}>
                                    <Check className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              <Button
                                size="icon"
                                onClick={() => {
                                  if (confirm(`Remove ${contestant.talentProfile.displayName} from ${contestant.competitionTitle}? This will delete their votes too.`)) {
                                    deleteContestantMutation.mutate(contestant.id);
                                  }
                                }}
                                className="bg-red-500/20 text-red-400 border-0"
                                data-testid={`button-delete-contestant-${contestant.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md bg-white/5 border border-white/5 p-6 text-center">
                      <UserCheck className="h-8 w-8 text-white/10 mx-auto mb-2" />
                      <p className="text-sm text-white/30">No applications yet.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="calendar">
            {(() => {
              const year = calendarMonth.getFullYear();
              const month = calendarMonth.getMonth();
              const firstDay = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const monthName = calendarMonth.toLocaleString("default", { month: "long", year: "numeric" });

              const calendarComps = (competitions || []).filter((c) => {
                if (!c.startDate && !c.endDate) return false;
                const start = c.startDate ? new Date(c.startDate) : null;
                const end = c.endDate ? new Date(c.endDate) : null;
                if (start && start.getFullYear() === year && start.getMonth() === month) return true;
                if (end && end.getFullYear() === year && end.getMonth() === month) return true;
                if (start && end && start <= new Date(year, month + 1, 0) && end >= new Date(year, month, 1)) return true;
                return false;
              });

              const getCompsForDay = (day: number) => {
                const date = new Date(year, month, day);
                return calendarComps.filter((c) => {
                  const start = c.startDate ? new Date(c.startDate) : null;
                  const end = c.endDate ? new Date(c.endDate) : null;
                  const dateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                  const dayTime = dateOnly(date);
                  if (start && dayTime === dateOnly(start)) return true;
                  if (end && dayTime === dateOnly(end)) return true;
                  return false;
                });
              };

              const statusColor = (s: string) => s === "active" || s === "voting" ? "bg-green-500" : s === "upcoming" ? "bg-blue-500" : "bg-zinc-500";
              const days = [];
              for (let i = 0; i < firstDay; i++) days.push(null);
              for (let d = 1; d <= daysInMonth; d++) days.push(d);

              return (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="ghost" onClick={() => setCalendarMonth(new Date(year, month - 1, 1))} data-testid="button-calendar-prev">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <h3 className="text-sm sm:text-lg font-serif tracking-wider uppercase text-white min-w-[140px] sm:min-w-[200px] text-center">{monthName}</h3>
                      <Button size="icon" variant="ghost" onClick={() => setCalendarMonth(new Date(year, month + 1, 1))} data-testid="button-calendar-next">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button variant="ghost" onClick={() => setCalendarMonth(new Date())} className="text-xs text-white/50" data-testid="button-calendar-today">Today</Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-white/40">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-green-500 inline-block" /> Active</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-blue-500 inline-block" /> Upcoming</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-zinc-500 inline-block" /> Other</span>
                    <span className="text-white/25 hidden sm:inline">Dots show start & end dates only</span>
                  </div>

                  <div className="grid grid-cols-7 gap-px bg-white/5 rounded-md overflow-hidden">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                      <div key={d} className="bg-zinc-900 p-1 sm:p-2 text-center text-[10px] sm:text-xs font-semibold text-white/40 uppercase tracking-wider">{d}</div>
                    ))}
                    {days.map((day, i) => {
                      const comps = day ? getCompsForDay(day) : [];
                      const isToday = day && new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;
                      const isSelected = day !== null && calendarSelectedDay === day;
                      return (
                        <button
                          key={i}
                          onClick={() => { if (day && comps.length > 0) { setCalendarSelectedDay(isSelected ? null : day); setCalendarSelectedComp(null); } }}
                          disabled={!day || comps.length === 0}
                          className={`bg-zinc-900/80 min-h-[56px] sm:min-h-[100px] p-1.5 sm:p-3 text-left transition-colors ${!day ? "bg-zinc-950/50 cursor-default" : comps.length > 0 ? "cursor-pointer hover:bg-white/5" : "cursor-default"} ${isToday ? "ring-1 ring-inset ring-orange-500/50" : ""} ${isSelected ? "bg-orange-500/10" : ""}`}
                          data-testid={day ? `calendar-day-${day}` : undefined}
                        >
                          {day && (
                            <div className="flex flex-col items-start gap-2">
                              <span className={`text-xs sm:text-sm font-medium ${isToday ? "text-orange-400 font-bold" : isSelected ? "text-orange-300" : "text-white/50"}`}>{day}</span>
                              {comps.length > 0 && comps.length <= 3 && (
                                <div className="flex items-center gap-1 flex-wrap">
                                  {comps.map((c) => (
                                    <span key={c.id} className={`w-2.5 h-2.5 rounded-full ${statusColor(c.status)}`} title={c.title} />
                                  ))}
                                </div>
                              )}
                              {comps.length > 3 && (
                                <span className="text-[10px] font-semibold text-orange-400/80">3+</span>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {calendarSelectedDay !== null && (() => {
                    const dayComps = getCompsForDay(calendarSelectedDay);
                    if (dayComps.length === 0) return null;
                    const dateLabel = new Date(year, month, calendarSelectedDay).toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
                    return (
                      <div className="rounded-md bg-white/5 border border-white/10 p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-serif text-white/70">{dateLabel}</h4>
                          <Button size="icon" variant="ghost" onClick={() => { setCalendarSelectedDay(null); setCalendarSelectedComp(null); }} data-testid="button-close-calendar-day">
                            <XIcon className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {dayComps.map((c) => (
                            <div key={c.id}>
                              <button
                                onClick={() => setCalendarSelectedComp(calendarSelectedComp === c.id ? null : c.id)}
                                className={`w-full flex items-center justify-between rounded-md px-3 py-2.5 transition-colors ${calendarSelectedComp === c.id ? "bg-orange-500/15 ring-1 ring-orange-500/30" : "bg-white/5 hover:bg-white/10"}`}
                                data-testid={`calendar-comp-${c.id}`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor(c.status)}`} />
                                  <span className="text-sm text-white/80">{c.title}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className={`border-0 text-[10px] ${c.status === "active" || c.status === "voting" ? "bg-green-500/20 text-green-400" : c.status === "upcoming" ? "bg-blue-500/20 text-blue-400" : "bg-zinc-500/20 text-zinc-400"}`}>
                                    {c.status === "voting" ? "Active" : c.status}
                                  </Badge>
                                  {calendarSelectedComp === c.id ? <ChevronUp className="h-3 w-3 text-white/30" /> : <ChevronDown className="h-3 w-3 text-white/30" />}
                                </div>
                              </button>

                              {calendarSelectedComp === c.id && (
                                <div className="mt-2 ml-4 space-y-3">
                                  {calendarReportLoading ? (
                                    <div className="flex items-center justify-center py-6">
                                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-orange-500 border-t-transparent" />
                                    </div>
                                  ) : calendarReport ? (
                                    <>
                                      <div className="text-xs text-white/40">
                                        {(calendarReport.competition as any).startDateTbd ? <span className="text-orange-400">TBD</span> : calendarReport.competition.startDate ? new Date(calendarReport.competition.startDate).toLocaleDateString() : null}
                                        {(calendarReport.competition as any).endDateTbd ? <span> — <span className="text-orange-400">TBD</span></span> : calendarReport.competition.endDate ? ` — ${new Date(calendarReport.competition.endDate).toLocaleDateString()}` : null}
                                      </div>
                                      <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-white/5 rounded-md p-2.5 text-center">
                                          <p className="text-xl font-bold text-orange-400">{calendarReport.totalContestants}</p>
                                          <p className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Contestants</p>
                                        </div>
                                        <div className="bg-white/5 rounded-md p-2.5 text-center">
                                          <p className="text-xl font-bold text-orange-400">{calendarReport.totalVotes}</p>
                                          <p className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Total Votes</p>
                                        </div>
                                        <div className="bg-white/5 rounded-md p-2.5 text-center">
                                          <p className="text-xl font-bold text-orange-400">${(calendarReport.totalRevenue / 100).toFixed(2)}</p>
                                          <p className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Revenue</p>
                                        </div>
                                      </div>
                                      {calendarReport.leaderboard.length > 0 && (
                                        <div>
                                          <h5 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">Leaderboard</h5>
                                          <div className="space-y-1">
                                            {calendarReport.leaderboard.map((entry) => (
                                              <div key={entry.contestantId} className="flex items-center justify-between bg-white/5 rounded px-3 py-1.5">
                                                <div className="flex items-center gap-2">
                                                  <span className={`text-xs font-bold ${entry.rank <= 3 ? "text-orange-400" : "text-white/30"}`}>#{entry.rank}</span>
                                                  <span className="text-sm text-white/80">{entry.stageName || entry.displayName}</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs">
                                                  <span className="text-white/50">{entry.voteCount} votes</span>
                                                  <span className="text-orange-400 font-medium">{entry.votePercentage}%</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <p className="text-xs text-white/30 text-center py-3">No report data available.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
          </TabsContent>

          <TabsContent value="storage">
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-serif text-lg text-white flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-orange-400" /> Storage Overview
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetchStorage()}
                  disabled={storageLoading}
                  className="text-orange-400 text-xs"
                  data-testid="button-refresh-storage"
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${storageLoading ? "animate-spin" : ""}`} /> Refresh
                </Button>
              </div>

              {storageLoading && !storageData ? (
                <div className="text-center py-12 text-white/40">Loading storage data...</div>
              ) : storageData ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="rounded-md bg-white/5 border border-white/10 p-5 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Image className="h-5 w-5 text-blue-400" />
                      <h4 className="text-xs uppercase tracking-widest text-blue-400 font-bold">Google Drive (Images)</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white/[0.03] rounded p-3 text-center">
                        <div className="text-2xl font-bold text-white" data-testid="text-drive-used">
                          {storageData.drive?.usedGB || 0} GB
                        </div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Used</div>
                      </div>
                      <div className="bg-white/[0.03] rounded p-3 text-center">
                        <div className="text-2xl font-bold text-white" data-testid="text-drive-total">
                          {storageData.drive?.totalGB ? `${storageData.drive.totalGB} GB` : "Unlimited"}
                        </div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Total</div>
                      </div>
                      <div className="bg-white/[0.03] rounded p-3 text-center">
                        <div className="text-2xl font-bold text-white" data-testid="text-drive-total-files">{storageData.drive?.totalFiles || 0}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">The Quest Files</div>
                      </div>
                    </div>
                    {storageData.drive?.totalGB > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-white/40">Account Storage</span>
                          <span className={`font-bold ${storageData.drive.usedPercent > 80 ? "text-red-400" : storageData.drive.usedPercent > 60 ? "text-yellow-400" : "text-green-400"}`}>
                            {storageData.drive.usedPercent}%
                          </span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full transition-all ${storageData.drive.usedPercent > 80 ? "bg-red-500" : storageData.drive.usedPercent > 60 ? "bg-yellow-500" : "bg-green-500"}`}
                            style={{ width: `${Math.min(storageData.drive.usedPercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {storageData.drive?.folders?.length > 0 && (
                      <div>
                        <h5 className="text-[10px] text-white/30 uppercase tracking-wider mb-2">The Quest Events</h5>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {storageData.drive.folders.map((f: any, i: number) => (
                            <div key={i} className="flex items-center justify-between py-1 px-2 bg-white/[0.02] rounded text-sm">
                              <span className="text-white/70 flex items-center gap-1.5 truncate">
                                <FolderOpen className="h-3 w-3 text-blue-400/50 flex-shrink-0" /> {f.name}
                              </span>
                              <span className="text-white/40 text-xs flex-shrink-0 ml-2">
                                {f.fileCount} files / {f.sizeMB >= 1024 ? `${(f.sizeMB / 1024).toFixed(1)} GB` : `${f.sizeMB} MB`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-md bg-white/5 border border-white/10 p-5 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Video className="h-5 w-5 text-purple-400" />
                      <h4 className="text-xs uppercase tracking-widest text-purple-400 font-bold">Vimeo (Videos)</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white/[0.03] rounded p-3 text-center">
                        <div className="text-2xl font-bold text-white" data-testid="text-vimeo-total-videos">{storageData.vimeo?.totalVideos || 0}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Videos</div>
                      </div>
                      <div className="bg-white/[0.03] rounded p-3 text-center">
                        <div className="text-2xl font-bold text-white" data-testid="text-vimeo-used">
                          {storageData.vimeo?.usedGB || 0} GB
                        </div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Used</div>
                      </div>
                      <div className="bg-white/[0.03] rounded p-3 text-center">
                        <div className="text-2xl font-bold text-white" data-testid="text-vimeo-total">
                          {storageData.vimeo?.totalGB || 0} GB
                        </div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Total</div>
                      </div>
                    </div>
                    {storageData.vimeo?.totalGB > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-white/40">Storage Used</span>
                          <span className={`font-bold ${storageData.vimeo.usedPercent > 80 ? "text-red-400" : storageData.vimeo.usedPercent > 60 ? "text-yellow-400" : "text-green-400"}`}>
                            {storageData.vimeo.usedPercent}%
                          </span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full transition-all ${storageData.vimeo.usedPercent > 80 ? "bg-red-500" : storageData.vimeo.usedPercent > 60 ? "bg-yellow-500" : "bg-green-500"}`}
                            style={{ width: `${Math.min(storageData.vimeo.usedPercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {storageData.vimeo?.folders?.length > 0 && (
                      <div>
                        <h5 className="text-[10px] text-white/30 uppercase tracking-wider mb-2">By Event</h5>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {storageData.vimeo.folders.map((f: any, i: number) => (
                            <div key={i} className="flex items-center justify-between py-1 px-2 bg-white/[0.02] rounded text-sm">
                              <span className="text-white/70 flex items-center gap-1.5 truncate">
                                <FolderOpen className="h-3 w-3 text-purple-400/50 flex-shrink-0" /> {f.name}
                              </span>
                              <span className="text-white/40 text-xs flex-shrink-0 ml-2">{f.videoCount} videos</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-white/40">No storage data available. Connect your Google Drive and Vimeo accounts to see usage.</div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="analytics">
            <AdminAnalyticsTab />
          </TabsContent>

          <TabsContent value="settings">
            {(() => {
              const form = settingsForm || platformSettings || {};
              const updateForm = (key: string, value: any) => {
                setSettingsForm((prev: any) => ({ ...(prev || platformSettings || {}), [key]: value }));
              };
              const packages = form.hostingPackages || [
                { name: "Starter", price: 49, maxContestants: 5, revenueSharePercent: 20, description: "Up to 5 competitors per event" },
                { name: "Pro", price: 149, maxContestants: 15, revenueSharePercent: 35, description: "Up to 15 competitors per event" },
                { name: "Premium", price: 399, maxContestants: 25, revenueSharePercent: 50, description: "25+ competitors with top revenue share" },
              ];
              const updatePackage = (index: number, field: string, value: any) => {
                const updated = [...packages];
                updated[index] = { ...updated[index], [field]: value };
                updateForm("hostingPackages", updated);
              };
              const addPackage = () => {
                updateForm("hostingPackages", [...packages, { name: "New Package", price: 0, maxContestants: 5, revenueSharePercent: 10, description: "" }]);
              };
              const removePackage = (index: number) => {
                updateForm("hostingPackages", packages.filter((_: any, i: number) => i !== index));
              };

              return (
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-lg text-white">Platform Settings</h3>
                    <Button
                      onClick={() => saveSettingsMutation.mutate(settingsForm || {})}
                      disabled={saveSettingsMutation.isPending || !settingsForm}
                      className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white"
                      data-testid="button-save-settings"
                    >
                      {saveSettingsMutation.isPending ? "Saving..." : "Save All Settings"}
                    </Button>
                  </div>

                  <div className="rounded-md bg-white/5 border border-white/10 p-5 space-y-4">
                    <h4 className="text-xs uppercase tracking-widest text-orange-400 font-bold">Sales Tax</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-white/50 text-xs">Sales Tax Rate (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={form.salesTaxPercent ?? 0}
                          onChange={(e) => updateForm("salesTaxPercent", parseFloat(e.target.value) || 0)}
                          className="bg-white/[0.08] border-white/20 text-white"
                          data-testid="input-sales-tax"
                        />
                        <p className="text-[10px] text-white/25 mt-1">Applied to all purchases (vote packages, hosting packages, join/host fees)</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md bg-white/5 border border-white/10 p-5 space-y-4">
                    <h4 className="text-xs uppercase tracking-widest text-orange-400 font-bold">Voting Rules</h4>
                    <p className="text-[10px] text-white/25">Purchased votes are unlimited. Only free votes have a daily cap.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-white/50 text-xs">Max Free Votes Per Day</Label>
                        <Input
                          type="number"
                          value={form.freeVotesPerDay ?? 5}
                          onChange={(e) => updateForm("freeVotesPerDay", parseInt(e.target.value) || 0)}
                          className="bg-white/[0.08] border-white/20 text-white"
                          data-testid="input-free-votes"
                        />
                      </div>
                      <div>
                        <Label className="text-white/50 text-xs">Minimum Vote Cost ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={form.defaultVoteCost ?? 0}
                          onChange={(e) => updateForm("defaultVoteCost", parseFloat(e.target.value) || 0)}
                          className="bg-white/[0.08] border-white/20 text-white"
                          data-testid="input-default-vote-cost"
                        />
                        <p className="text-white/30 text-[10px] mt-0.5">Competitions cannot set vote cost below this amount. Saving settings auto-applies to all competitions.</p>
                      </div>
                      <div>
                        <Label className="text-white/50 text-xs">Price of 1 Vote ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={form.votePricePerVote ?? 1}
                          onChange={(e) => updateForm("votePricePerVote", parseFloat(e.target.value) || 0)}
                          className="bg-white/[0.08] border-white/20 text-white"
                          data-testid="input-vote-price"
                        />
                      </div>
                    </div>

                    {(() => {
                      const votePackages = form.votePackages || [
                        { name: "Starter Pack", voteCount: 500, bonusVotes: 0, price: 10, description: "500 votes to support your favorite" },
                        { name: "Fan Pack", voteCount: 1000, bonusVotes: 300, price: 15, description: "1,000 votes + 300 bonus votes" },
                        { name: "Super Fan Pack", voteCount: 2000, bonusVotes: 600, price: 30, description: "2,000 votes + 600 bonus votes" },
                      ];
                      const updateVotePkg = (index: number, field: string, value: any) => {
                        const updated = [...votePackages];
                        updated[index] = { ...updated[index], [field]: value };
                        updateForm("votePackages", updated);
                      };
                      const addVotePkg = () => {
                        updateForm("votePackages", [...votePackages, { name: "New Package", voteCount: 100, bonusVotes: 0, price: 5, description: "" }]);
                      };
                      const removeVotePkg = (index: number) => {
                        updateForm("votePackages", votePackages.filter((_: any, i: number) => i !== index));
                      };

                      return (
                        <div className="mt-5 pt-5 border-t border-white/10 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs uppercase tracking-widest text-orange-400 font-bold">Vote Packages</h4>
                            <Button variant="ghost" size="sm" onClick={addVotePkg} className="text-orange-400 text-xs" data-testid="button-add-vote-package">
                              <Plus className="h-3 w-3 mr-1" /> Add Package
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {votePackages.map((vpkg: any, idx: number) => (
                              <div key={idx} className="rounded-md bg-white/[0.03] border border-white/5 px-3 py-2.5" data-testid={`vote-package-${idx}`}>
                                <div className="grid grid-cols-[1fr_auto] gap-2 items-center mb-2">
                                  <div>
                                    <Label className="text-white/30 text-[10px]">Name</Label>
                                    <Input value={vpkg.name} onChange={(e) => updateVotePkg(idx, "name", e.target.value)} className="bg-white/[0.08] border-white/20 text-white text-sm" data-testid={`input-vote-pkg-name-${idx}`} />
                                  </div>
                                  {votePackages.length > 1 && (
                                    <Button variant="ghost" size="icon" onClick={() => removeVotePkg(idx)} className="text-red-400/60 mt-3" data-testid={`button-remove-vote-package-${idx}`}>
                                      <XIcon className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                                  <div>
                                    <Label className="text-white/30 text-[10px]">Votes</Label>
                                    <Input type="number" value={vpkg.voteCount} onChange={(e) => updateVotePkg(idx, "voteCount", parseInt(e.target.value) || 0)} className="bg-white/[0.08] border-white/20 text-white text-sm" data-testid={`input-vote-pkg-count-${idx}`} />
                                  </div>
                                  <div>
                                    <Label className="text-white/30 text-[10px]">Bonus</Label>
                                    <Input type="number" value={vpkg.bonusVotes} onChange={(e) => updateVotePkg(idx, "bonusVotes", parseInt(e.target.value) || 0)} className="bg-white/[0.08] border-white/20 text-white text-sm" data-testid={`input-vote-pkg-bonus-${idx}`} />
                                  </div>
                                  <div>
                                    <Label className="text-white/30 text-[10px]">Price ($)</Label>
                                    <Input type="number" step="0.01" value={vpkg.price} onChange={(e) => updateVotePkg(idx, "price", parseFloat(e.target.value) || 0)} className="bg-white/[0.08] border-white/20 text-white text-sm" data-testid={`input-vote-pkg-price-${idx}`} />
                                  </div>
                                  <div className="text-center">
                                    <Label className="text-white/30 text-[10px]">Total</Label>
                                    <div className="text-sm text-orange-400 font-bold py-2">{((vpkg.voteCount || 0) + (vpkg.bonusVotes || 0)).toLocaleString()}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={() => saveSettingsMutation.mutate(settingsForm || {})}
                      disabled={saveSettingsMutation.isPending || !settingsForm}
                      className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white"
                      data-testid="button-save-settings-after-voting"
                    >
                      {saveSettingsMutation.isPending ? "Saving..." : "Save All Settings"}
                    </Button>
                  </div>

                  <div className="rounded-md bg-white/5 border border-white/10 p-5 space-y-4">
                    <h4 className="text-xs uppercase tracking-widest text-orange-400 font-bold">Join & Host Pricing</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-white/50 text-xs">Join Fee ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={form.joinPrice ?? 0}
                          onChange={(e) => updateForm("joinPrice", parseFloat(e.target.value) || 0)}
                          className="bg-white/[0.08] border-white/20 text-white"
                          data-testid="input-join-price"
                        />
                        <p className="text-[10px] text-white/25 mt-1">Fee charged when a talent submits a join application (0 = free)</p>
                      </div>
                      <div>
                        <Label className="text-white/50 text-xs">Nomination Fee ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          key={`settings-nom-fee-${joinSettings?.nominationFee}`}
                          defaultValue={((joinSettings?.nominationFee || 0) / 100).toFixed(2)}
                          onBlur={(e) => {
                            const cents = Math.round((parseFloat(e.target.value) || 0) * 100);
                            updateJoinSettingsMutation.mutate({ nominationFee: cents });
                          }}
                          className="bg-white/[0.08] border-white/20 text-white"
                          data-testid="input-nomination-price"
                        />
                        <p className="text-[10px] text-white/25 mt-1">Fee charged when someone nominates a contestant (0 = free)</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-white/25 mt-2">Host application fee is determined by the hosting package selected below.</p>
                  </div>

                  <div className="rounded-md bg-white/5 border border-white/10 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs uppercase tracking-widest text-orange-400 font-bold">Event Hosting Packages</h4>
                      <Button variant="ghost" size="sm" onClick={addPackage} className="text-orange-400 text-xs" data-testid="button-add-package">
                        <Plus className="h-3 w-3 mr-1" /> Add Package
                      </Button>
                    </div>
                    <p className="text-[10px] text-white/25">Packages determine max competitors per event and the host's share of vote revenue. Unlimited events at every tier.</p>
                    <div className="space-y-4">
                      {packages.map((pkg: any, idx: number) => (
                        <div key={idx} className="rounded-md bg-white/[0.03] border border-white/5 p-4 space-y-3" data-testid={`settings-package-${idx}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-white/60">Package {idx + 1}</span>
                            {packages.length > 1 && (
                              <Button variant="ghost" size="icon" onClick={() => removePackage(idx)} className="text-red-400/60" data-testid={`button-remove-package-${idx}`}>
                                <XIcon className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                            <div>
                              <Label className="text-white/40 text-[10px]">Name</Label>
                              <Input value={pkg.name} onChange={(e) => updatePackage(idx, "name", e.target.value)} className="bg-white/[0.08] border-white/20 text-white" data-testid={`input-package-name-${idx}`} />
                            </div>
                            <div>
                              <Label className="text-white/40 text-[10px]">Price ($)</Label>
                              <Input type="number" step="0.01" value={pkg.price} onChange={(e) => updatePackage(idx, "price", parseFloat(e.target.value) || 0)} className="bg-white/[0.08] border-white/20 text-white" data-testid={`input-package-price-${idx}`} />
                            </div>
                            <div>
                              <Label className="text-white/40 text-[10px]">Max Competitors</Label>
                              <Input type="number" value={pkg.maxContestants} onChange={(e) => updatePackage(idx, "maxContestants", parseInt(e.target.value) || 0)} className="bg-white/[0.08] border-white/20 text-white" data-testid={`input-package-max-${idx}`} />
                            </div>
                            <div>
                              <Label className="text-white/40 text-[10px]">Revenue Share (%)</Label>
                              <Input type="number" step="1" value={pkg.revenueSharePercent} onChange={(e) => updatePackage(idx, "revenueSharePercent", parseInt(e.target.value) || 0)} className="bg-white/[0.08] border-white/20 text-white" data-testid={`input-package-revenue-${idx}`} />
                              <p className="text-[10px] text-white/25 mt-0.5">% of vote revenue host receives</p>
                            </div>
                            <div>
                              <Label className="text-white/40 text-[10px]">Description</Label>
                              <Input value={pkg.description} onChange={(e) => updatePackage(idx, "description", e.target.value)} className="bg-white/[0.08] border-white/20 text-white" data-testid={`input-package-desc-${idx}`} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={() => saveSettingsMutation.mutate(settingsForm || {})}
                      disabled={saveSettingsMutation.isPending || !settingsForm}
                      className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white"
                      data-testid="button-save-settings-after-packages"
                    >
                      {saveSettingsMutation.isPending ? "Saving..." : "Save All Settings"}
                    </Button>
                  </div>

                  <div className="rounded-md bg-white/5 border border-white/10 p-5 space-y-4">
                    <h4 className="text-xs uppercase tracking-widest text-orange-400 font-bold">Competition Defaults</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-white/50 text-xs">Default Max Contestants</Label>
                        <Input
                          type="number"
                          value={form.defaultMaxContestants ?? 50}
                          onChange={(e) => updateForm("defaultMaxContestants", parseInt(e.target.value) || 0)}
                          className="bg-white/[0.08] border-white/20 text-white"
                          data-testid="input-default-max-contestants"
                        />
                      </div>
                      <div>
                        <Label className="text-white/50 text-xs">Auto-Approve Applications</Label>
                        <Select
                          value={form.autoApproveApplications ? "yes" : "no"}
                          onValueChange={(v) => updateForm("autoApproveApplications", v === "yes")}
                        >
                          <SelectTrigger className="bg-white/[0.08] border-white/20 text-white" data-testid="select-auto-approve">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#222] border-white/20 text-white">
                            <SelectItem value="no">No (Manual Review)</SelectItem>
                            <SelectItem value="yes">Yes (Auto-Approve)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-white/50 text-xs">Platform Fee (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={form.platformFeePercent ?? 10}
                          onChange={(e) => updateForm("platformFeePercent", parseFloat(e.target.value) || 0)}
                          className="bg-white/[0.08] border-white/20 text-white"
                          data-testid="input-platform-fee"
                        />
                        <p className="text-[10px] text-white/25 mt-1">Percentage fee taken from vote revenue</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                      <div>
                        <Label className="text-white/50 text-xs">Global Max Images Per Contestant</Label>
                        <Input
                          type="number"
                          value={form.maxImagesPerContestant ?? 10}
                          onChange={(e) => updateForm("maxImagesPerContestant", parseInt(e.target.value) || 1)}
                          className="bg-white/[0.08] border-white/20 text-white"
                          data-testid="input-max-images"
                        />
                        <p className="text-[10px] text-white/25 mt-1">Global maximum — hosts can set lower per-competition limits but not exceed this</p>
                      </div>
                      <div>
                        <Label className="text-white/50 text-xs">Global Max Videos Per Contestant</Label>
                        <Input
                          type="number"
                          value={form.maxVideosPerContestant ?? 3}
                          onChange={(e) => updateForm("maxVideosPerContestant", parseInt(e.target.value) || 1)}
                          className="bg-white/[0.08] border-white/20 text-white"
                          data-testid="input-max-videos"
                        />
                        <p className="text-[10px] text-white/25 mt-1">Global maximum — hosts can set lower per-competition limits but not exceed this</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md bg-white/5 border border-white/10 p-5 space-y-4">
                    <h4 className="text-xs uppercase tracking-widest text-orange-400 font-bold">Terms & Conditions</h4>
                    <p className="text-[10px] text-white/25">Displayed in the payment confirmation modal. Summary appears as bullet points; full details are viewable via an expandable link.</p>
                    <div>
                      <Label className="text-white/50 text-xs">Summary (Bullet Points)</Label>
                      <Textarea
                        value={form.termsSummary ?? ""}
                        onChange={(e) => updateForm("termsSummary", e.target.value)}
                        className="bg-white/[0.08] border-white/20 text-white mt-2 min-h-[120px]"
                        placeholder={"All fees are non-refundable once processed.\nBy proceeding, you agree to the official competition rules.\nVote purchases support the contestant's chosen nonprofit."}
                        data-testid="input-terms-summary"
                      />
                      <p className="text-[10px] text-white/25 mt-1">Each line becomes a bullet point in the confirmation modal</p>
                    </div>
                    <div>
                      <Label className="text-white/50 text-xs">Full Details (Fine Print)</Label>
                      <Textarea
                        value={form.termsFinePrint ?? ""}
                        onChange={(e) => updateForm("termsFinePrint", e.target.value)}
                        className="bg-white/[0.08] border-white/20 text-white mt-2 min-h-[200px]"
                        placeholder="Enter the full legal terms and conditions here..."
                        data-testid="input-terms-fine-print"
                      />
                      <p className="text-[10px] text-white/25 mt-1">Viewable via "View Full Details" link in the payment modal</p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={() => saveSettingsMutation.mutate(settingsForm || {})}
                      disabled={saveSettingsMutation.isPending || !settingsForm}
                      className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white"
                      data-testid="button-save-settings-bottom"
                    >
                      {saveSettingsMutation.isPending ? "Saving..." : "Save All Settings"}
                    </Button>
                  </div>
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={compDetailId !== null} onOpenChange={(open) => { if (!open) setCompDetailId(null); }}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white sm:max-w-2xl" data-testid="comp-detail-dialog">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Competition Details</DialogTitle>
          </DialogHeader>
          {compDetailId !== null && <CompetitionDetailModal compId={compDetailId} />}
        </DialogContent>
      </Dialog>

      <Dialog open={userDetailId !== null} onOpenChange={(open) => { if (!open) setUserDetailId(null); }}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white sm:max-w-2xl" data-testid="user-detail-dialog">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">User Profile</DialogTitle>
          </DialogHeader>
          {userDetailId !== null && <TalentDetailModal profileId={userDetailId} competitions={competitions} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
