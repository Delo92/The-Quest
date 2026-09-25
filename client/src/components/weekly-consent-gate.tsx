import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MARKETING_GUIDELINES_ACKNOWLEDGMENT_TEXT,
  type WeeklyConsentStatus,
} from "@shared/weekly-consent";

const weeklyConsentQueryKey = (uid: string) => ["weekly-consent", uid] as const;

async function readWeeklyConsent(): Promise<WeeklyConsentStatus> {
  const response = await apiRequest("GET", "/api/weekly-consent");
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || "Could not check the weekly agreement.");
  }
  return result as WeeklyConsentStatus;
}

export function WeeklyConsentGate({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState(false);
  const eligibleAccount = user?.level === 2 || user?.level === 3;
  const consentQuery = useQuery({
    queryKey: weeklyConsentQueryKey(user?.uid || ""),
    queryFn: readWeeklyConsent,
    enabled: Boolean(user && isAuthenticated && !isLoading && eligibleAccount),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    retry: 1,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const currentConsent = consentQuery.data;
      if (!currentConsent) throw new Error("The current agreement is not available.");
      const response = await apiRequest("POST", "/api/weekly-consent", {
        accepted: true,
        version: currentConsent.version,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || "Could not save your agreement.");
      }
      return result as WeeklyConsentStatus;
    },
    onSuccess: (status) => {
      setChecked(false);
      if (user) queryClient.setQueryData(weeklyConsentQueryKey(user.uid), status);
    },
    onError: () => {
      void consentQuery.refetch();
    },
  });

  if (!user || !eligibleAccount) return <>{children}</>;

  if (isLoading || consentQuery.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111] px-5 text-center text-sm text-white/70" role="status">
        Checking this week’s required agreement…
      </div>
    );
  }

  if (consentQuery.isError || !consentQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111] px-5 py-10 text-white">
        <section className="w-full max-w-lg rounded-lg border border-white/15 bg-[#1b1b1b] p-6 sm:p-8">
          <h1 className="text-xl font-semibold">Agreement check unavailable</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/65">
            We couldn’t verify this week’s required agreement. Access remains locked until the check succeeds.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              className="bg-[#FF5A09] text-white hover:bg-[#e84d00]"
              onClick={() => void consentQuery.refetch()}
              disabled={consentQuery.isFetching}
            >
              {consentQuery.isFetching ? "Checking…" : "Try again"}
            </Button>
            <Button
              variant="outline"
              className="border-white/20 bg-transparent text-white hover:bg-white/10"
              onClick={async () => {
                await logout();
                setLocation("/thequest/login");
              }}
            >
              Log out
            </Button>
          </div>
        </section>
      </div>
    );
  }

  if (!consentQuery.data.required || consentQuery.data.accepted) {
    return <>{children}</>;
  }

  const mutationError = acceptMutation.error instanceof Error
    ? acceptMutation.error.message
    : null;

  return (
    <Dialog open onOpenChange={() => {}}>
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto border-white/15 bg-[#1b1b1b] text-white sm:max-w-xl [&>button:last-child]:hidden"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl sm:text-2xl">Weekly participation agreement</DialogTitle>
            <DialogDescription className="text-white/60">
              Required once each calendar week, Monday through Sunday in Central Time, for contestants and hosts.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-[#FF5A09]/30 bg-[#FF5A09]/[0.06] p-4 text-sm leading-relaxed text-white/85">
            {MARKETING_GUIDELINES_ACKNOWLEDGMENT_TEXT}
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-white/15 bg-white/[0.03] p-4 text-sm leading-relaxed text-white/80">
            <Checkbox
              id="weekly-marketing-guidelines-agreement"
              checked={checked}
              onCheckedChange={(value) => setChecked(value === true)}
              aria-required="true"
              className="mt-0.5 shrink-0 border-white/40 data-[state=checked]:border-[#FF5A09] data-[state=checked]:bg-[#FF5A09]"
              data-testid="checkbox-weekly-marketing-guidelines"
            />
            <span>I have read and agree to this week’s marketing-guidelines agreement.</span>
          </label>

          {mutationError && (
            <p className="text-sm text-red-300" role="alert">{mutationError}</p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="border-white/20 bg-transparent text-white hover:bg-white/10"
              onClick={async () => {
                await logout();
                setLocation("/thequest/login");
              }}
              disabled={acceptMutation.isPending}
            >
              Log out
            </Button>
            <Button
              className="bg-[#FF5A09] text-white hover:bg-[#e84d00]"
              disabled={!checked || acceptMutation.isPending}
              onClick={() => acceptMutation.mutate()}
              data-testid="button-accept-weekly-agreement"
            >
              {acceptMutation.isPending ? "Saving…" : "Agree and continue"}
            </Button>
          </div>
        </DialogContent>
    </Dialog>
  );
}