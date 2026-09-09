import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAuthToken } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, CheckCircle2, Clock3, Heart, Loader2, LockKeyhole, Upload, Video, X } from "lucide-react";
import * as tus from "tus-js-client";

interface Stage {
  id: string;
  order: number;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  submissionStartDate: string | null;
  submissionEndDate: string | null;
  votingStartDate: string | null;
  votingEndDate: string | null;
  eliminationCount: number;
  isFinale: boolean;
}

interface Submission {
  id: string;
  stageId: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  thumbnailUrl?: string | null;
  title: string | null;
  description: string | null;
  updatedAt: string;
}

interface Props {
  competitionId: number;
}

function boundary(value: string | null | undefined, end = false) {
  if (!value) return null;
  const parsed = Date.parse(value.includes("T") ? value : `${value}${end ? "T23:59:59.999" : "T00:00:00.000"}`);
  return Number.isNaN(parsed) ? null : parsed;
}

function openWindow(start: string | null | undefined, end: string | null | undefined, now: number) {
  const startTime = boundary(start);
  const endTime = boundary(end, true);
  return startTime !== null && endTime !== null && now >= startTime && now <= endTime;
}

function formatWindow(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return "Schedule not set";
  return `${new Date(start).toLocaleDateString()} – ${new Date(end).toLocaleDateString()}`;
}

function videoId(uri: string) {
  return uri.split("/").pop() || "";
}

export default function ContestantStagePanel({ competitionId }: Props) {
  const { toast } = useToast();
  const [now, setNow] = useState(() => Date.now());
  const [uploadingStage, setUploadingStage] = useState<string | null>(null);
  const [description, setDescription] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const { data, isLoading } = useQuery<{
    contestantId: number;
    stages: Stage[];
    submissions: Submission[];
  }>({
    queryKey: ["/api/contestants/me/stage-submissions", competitionId],
    queryFn: async () => {
      const token = getAuthToken();
      const response = await fetch(`/api/contestants/me/stage-submissions?competitionId=${competitionId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("Could not load stage challenges");
      return response.json();
    },
    enabled: !!competitionId,
  });

  const removeMutation = useMutation({
    mutationFn: async (stageId: string) => {
      await apiRequest("DELETE", `/api/contestants/me/stage-submissions/${competitionId}/${stageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants/me/stage-submissions", competitionId] });
      toast({ title: "Submission removed" });
    },
    onError: (error: Error) => toast({ title: "Could not remove submission", description: error.message, variant: "destructive" }),
  });

  const stages = useMemo(() => [...(data?.stages || [])].sort((a, b) => a.order - b.order), [data?.stages]);
  const submissions = data?.submissions || [];

  const upload = async (stage: Stage, file: File) => {
    setUploadingStage(stage.id);
    try {
      const token = getAuthToken();
      if (file.type.startsWith("image/")) {
        const form = new FormData();
        form.append("image", file);
        form.append("competitionId", String(competitionId));
        form.append("stageId", stage.id);
        form.append("title", stage.name);
        form.append("description", description[stage.id] || "");
        const response = await fetch("/api/drive/upload", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        });
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Photo upload failed");
      } else if (file.type.startsWith("video/")) {
        const ticketResponse = await fetch("/api/vimeo/upload-ticket", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ fileName: file.name, fileSize: file.size, competitionId, stageId: stage.id }),
        });
        if (!ticketResponse.ok) throw new Error((await ticketResponse.json().catch(() => ({}))).message || "Could not start video upload");
        const ticket = await ticketResponse.json();
        await new Promise<void>((resolve, reject) => {
          const upload = new tus.Upload(file, {
            uploadUrl: ticket.uploadLink,
            onError: (error) => reject(new Error(error.message || "Video upload failed")),
            onSuccess: () => resolve(),
          });
          upload.start();
        });
        const finalizeResponse = await fetch("/api/vimeo/finalize-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            videoUri: ticket.videoUri,
            completeUri: ticket.completeUri || null,
            competitionId,
            stageId: stage.id,
          }),
        });
        if (!finalizeResponse.ok) throw new Error((await finalizeResponse.json().catch(() => ({}))).message || "Could not finalize video");
      } else {
        throw new Error("Choose an image or video file");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/contestants/me/stage-submissions", competitionId] });
      toast({ title: `${stage.name} submission saved` });
    } catch (error: any) {
      toast({ title: "Submission failed", description: error.message || "Could not upload your challenge content.", variant: "destructive" });
    } finally {
      setUploadingStage(null);
    }
  };

  const castFreeVote = async (stage: Stage) => {
    try {
      await apiRequest("POST", `/api/competitions/${competitionId}/vote`, {
        contestantId: data?.contestantId,
        stageId: stage.id,
      });
      toast({ title: "Free vote recorded", description: `Your vote for ${stage.name} was counted.` });
    } catch (error: any) {
      toast({ title: "Vote unavailable", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm text-white/50">Loading your challenge days…</div>;
  }
  if (stages.length === 0) return null;

  return (
    <section className="space-y-4" aria-labelledby="contestant-stages-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-orange-300/80">Starr Struck challenge workspace</p>
          <h2 id="contestant-stages-heading" className="mt-1 text-xl font-bold text-white">Your seven challenge days</h2>
          <p className="mt-1 max-w-2xl text-sm text-white/45">Submit one challenge entry per day while that day’s submission window is open. Voting follows the stage voting window.</p>
        </div>
        <CalendarDays className="hidden h-6 w-6 shrink-0 text-orange-400 sm:block" />
      </div>

      <div className="grid gap-4">
        {stages.map((stage) => {
          const [submissionStart, submissionEnd] = [stage.submissionStartDate || stage.startDate, stage.submissionEndDate || stage.endDate];
          const [votingStart, votingEnd] = [stage.votingStartDate || stage.startDate, stage.votingEndDate || stage.endDate];
          const submissionOpen = openWindow(submissionStart, submissionEnd, now);
          const votingOpen = openWindow(votingStart, votingEnd, now);
          const scheduled = !!(submissionStart && submissionEnd);
          const submission = submissions.find((item) => item.stageId === stage.id);
          const busy = uploadingStage === stage.id;
          return (
            <article key={stage.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
              <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-sm font-bold text-orange-300">{stage.order}</div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-white">{stage.name}</h3>
                      {stage.isFinale && <Badge className="border-0 bg-amber-400/15 text-amber-300">Finale</Badge>}
                    </div>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-white/55">{stage.description}</p>
                  </div>
                </div>
                <Badge className={`w-fit border-0 ${submissionOpen ? "bg-green-400/15 text-green-300" : "bg-white/10 text-white/45"}`}>
                  {submissionOpen ? "Submissions open" : scheduled ? "Closed" : "Schedule pending"}
                </Badge>
              </div>

              <div className="grid gap-4 p-4 lg:grid-cols-[1fr_auto]">
                <div className="space-y-3">
                  <div className="grid gap-2 text-xs text-white/50 sm:grid-cols-2">
                    <div><span className="text-white/30">Submission window</span><br />{formatWindow(submissionStart, submissionEnd)}</div>
                    <div><span className="text-white/30">Voting window</span><br />{formatWindow(votingStart, votingEnd)}</div>
                  </div>
                  {submission ? (
                    <div className="flex flex-col gap-3 rounded-lg border border-green-400/20 bg-green-400/[0.06] p-3 sm:flex-row sm:items-center">
                      {submission.mediaType === "image" ? (
                        <img src={submission.mediaUrl} alt={`${stage.name} submission`} className="h-20 w-20 rounded-md object-cover" />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-md bg-black/40 text-orange-300"><Video className="h-6 w-6" /></div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-sm font-medium text-green-300"><CheckCircle2 className="h-4 w-4" /> Submitted</p>
                        <p className="mt-1 text-xs text-white/40">Updated {new Date(submission.updatedAt).toLocaleString()}</p>
                      </div>
                      {submissionOpen && <Button variant="ghost" size="icon" className="text-white/40 hover:text-red-300" onClick={() => removeMutation.mutate(stage.id)} disabled={removeMutation.isPending} aria-label={`Remove ${stage.name} submission`}><X className="h-4 w-4" /></Button>}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-white/15 p-4">
                      <div className="flex items-center gap-2 text-sm text-white/55"><LockKeyhole className="h-4 w-4 text-white/30" /> {submissionOpen ? "Add your challenge content" : "Submission window is not open"}</div>
                      {submissionOpen && (
                        <div className="mt-3 space-y-3">
                          <Textarea value={description[stage.id] || ""} onChange={(event) => setDescription((current) => ({ ...current, [stage.id]: event.target.value }))} placeholder="Optional note about this entry" className="min-h-[70px] bg-black/20 text-white placeholder:text-white/25" />
                          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-gradient-to-r from-orange-500 to-amber-500 px-4 text-sm font-medium text-white hover:opacity-90">
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            {busy ? "Uploading…" : "Upload photo or video"}
                            <Input type="file" accept="image/*,video/*" className="hidden" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(stage, file); event.currentTarget.value = ""; }} />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:max-w-[190px] lg:flex-col lg:items-stretch lg:justify-center">
                  <Button onClick={() => void castFreeVote(stage)} disabled={!votingOpen || !data?.contestantId} variant="outline" className="border-white/15 text-white hover:border-orange-400/50 hover:text-orange-200"><Heart className="mr-2 h-4 w-4" /> Free vote</Button>
                  <Button onClick={() => { window.location.href = `/checkout/${competitionId}/${data?.contestantId}?stageId=${encodeURIComponent(stage.id)}`; }} disabled={!votingOpen || !data?.contestantId} className="bg-white/10 text-white hover:bg-white/15"><Clock3 className="mr-2 h-4 w-4" /> Buy votes</Button>
                  {stage.eliminationCount > 0 && <p className="text-center text-[11px] text-white/35">{stage.eliminationCount} eliminated after this day</p>}
                  {stage.isFinale && <p className="text-center text-[11px] text-amber-300/60">Host selects the winner</p>}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}