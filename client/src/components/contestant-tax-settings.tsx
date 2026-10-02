import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, FileText, LockKeyhole, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import W9FormDialog from "@/components/w9-form-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { W9TaxFormValues } from "@shared/w9-tax-form";

type SavedW9 = Partial<Omit<W9TaxFormValues, "taxId">> & {
  taxIdLast4: string;
  w9Complete?: boolean;
  w9FormVersion?: string | null;
};

type TaxProfile = {
  taxYear: number;
  encryptionReady: boolean;
  payerConfigured: boolean;
  acknowledgedAt: string | null;
  dismissedAt: string | null;
  currentVersionId: string | null;
  current: SavedW9 | null;
  versions: Array<{
    id: string;
    createdAt: string | null;
    legalName: string;
    businessName: string;
    taxIdType: "ssn" | "ein";
    taxIdLast4: string;
    federalTaxClassification?: string | null;
    w9Complete?: boolean;
  }>;
  paidGrossCents: number;
};

type Deadline = {
  competitionId: number;
  competitionTitle: string;
  deadline: string;
  taxYear: number;
};

const money = (cents: number) =>
  `$${(Number(cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dateLabel = (value?: string | null) => value
  ? new Date(value).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
  : "Date unavailable";

const classificationLabels: Record<string, string> = {
  individual_sole_proprietor: "Individual / sole proprietor",
  c_corporation: "C corporation",
  s_corporation: "S corporation",
  partnership: "Partnership",
  trust_estate: "Trust / estate",
  llc: "Limited liability company",
  other: "Other",
};

export default function ContestantTaxSettings({ onOpenTaxDetails }: { onOpenTaxDetails?: () => void } = {}) {
  const { toast } = useToast();
  const currentYear = new Date().getUTCFullYear();
  const [taxYear, setTaxYear] = useState(currentYear);
  const [showReminder, setShowReminder] = useState(true);
  const [taxPromptOpen, setTaxPromptOpen] = useState(false);
  const [w9DialogOpen, setW9DialogOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState("");

  const yearsQuery = useQuery<number[]>({ queryKey: ["/api/tax/my-years"] });
  const profileQuery = useQuery<TaxProfile>({
    queryKey: ["/api/tax/my-profile", taxYear],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/tax/my-profile/${taxYear}`);
      return response.json();
    },
    enabled: Number.isInteger(taxYear),
  });
  const deadlinesQuery = useQuery<Deadline[]>({ queryKey: ["/api/tax/my-deadlines"] });

  useEffect(() => {
    setSelectedVersionId(profileQuery.data?.currentVersionId || "");
    setShowReminder(!profileQuery.data?.dismissedAt);
  }, [profileQuery.data, taxYear]);

  const updateProfileQuery = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/tax/my-profile", taxYear] });
    queryClient.invalidateQueries({ queryKey: ["/api/tax/my-years"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tax/my-deadlines"] });
  };

  const acknowledgmentMutation = useMutation({
    mutationFn: async (action: "acknowledge" | "dismiss") => {
      const response = await apiRequest("POST", `/api/tax/my-profile/${taxYear}/acknowledgment`, { action });
      return response.json();
    },
    onSuccess: (_result, action) => {
      updateProfileQuery();
      if (action === "dismiss") setShowReminder(false);
      toast({ title: action === "acknowledge" ? "Deadline acknowledged" : "Reminder dismissed" });
    },
    onError: (error: Error) => toast({ title: "Could not update tax reminder", description: error.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async (values: W9TaxFormValues) => {
      const response = await apiRequest("POST", `/api/tax/my-profile/${taxYear}`, values);
      return response.json();
    },
    onSuccess: () => {
      updateProfileQuery();
      setW9DialogOpen(false);
      toast({ title: "Tax details saved securely" });
    },
    onError: (error: Error) => toast({ title: "Could not save tax details", description: error.message, variant: "destructive" }),
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const query = selectedVersionId ? `?versionId=${encodeURIComponent(selectedVersionId)}` : "";
      const response = await apiRequest("GET", `/api/tax/my-profile/${taxYear}/1099${query}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `TheQuest-1099-NEC-${taxYear}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
    onError: (error: Error) => toast({ title: "Could not download recipient copy", description: error.message, variant: "destructive" }),
  });

  const profile = profileQuery.data;
  const deadlines = deadlinesQuery.data || [];
  const yearOptions = [...new Set([currentYear, ...(yearsQuery.data || [])])].sort((a, b) => b - a);
  const currentHasTin = Boolean(profile?.current?.taxIdLast4);
  const needsTaxProfile = Boolean(
    profileQuery.isSuccess
    && deadlinesQuery.isSuccess
    && profile?.encryptionReady
    && !profile.currentVersionId
    && !profile.dismissedAt
    && (deadlines.length > 0 || Number(profile.paidGrossCents) > 0),
  );

  useEffect(() => {
    if (needsTaxProfile) setTaxPromptOpen(true);
  }, [needsTaxProfile]);

  return (
    <section className="space-y-5" aria-labelledby="tax-settings-heading" data-testid="contestant-tax-settings">
      <Dialog
        open={taxPromptOpen}
        onOpenChange={setTaxPromptOpen}
      >
        <DialogContent className="max-w-lg border-white/10 bg-[#111] text-white" data-testid="dialog-tax-profile-reminder">
          <DialogHeader>
            <DialogTitle>Complete your 1099 tax details</DialogTitle>
            <DialogDescription className="text-white/60">
              Enter your legal name, SSN or EIN, and mailing address so The Quest can prepare recipient 1099-NEC forms when applicable. Your tax ID is encrypted before it is saved.
            </DialogDescription>
          </DialogHeader>
          {deadlines.length > 0 && (
            <p className="text-sm leading-relaxed text-white/55">
              Save your details by your competition&apos;s final-voting cutoff to help protect your payout eligibility. You can review the deadlines in Tax Details.
            </p>
          )}
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                acknowledgmentMutation.mutate("dismiss");
                setTaxPromptOpen(false);
              }}
              disabled={acknowledgmentMutation.isPending}
              className="min-h-11 border-white/20 text-white hover:bg-white/10"
              data-testid="button-tax-prompt-later"
            >
              Remind me later
            </Button>
            <Button
              type="button"
              onClick={() => {
                setTaxPromptOpen(false);
                onOpenTaxDetails?.();
              }}
              className="min-h-11 bg-orange-500 text-white hover:bg-orange-400"
              data-testid="button-open-tax-details"
            >
              Enter tax details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <W9FormDialog
        open={w9DialogOpen}
        onOpenChange={setW9DialogOpen}
        initialValues={profile?.current}
        hasSavedTaxId={currentHasTin}
        taxIdLast4={profile?.current?.taxIdLast4}
        canSave={Boolean(profile?.encryptionReady && profile?.acknowledgedAt)}
        isSaving={saveMutation.isPending}
        onSubmit={(values) => saveMutation.mutate(values)}
      />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LockKeyhole className="h-5 w-5 text-orange-300" />
            <h2 id="tax-settings-heading" className="text-lg font-semibold text-white">Tax details & forms</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/55">
            Your tax ID is encrypted before it is saved. Only you can view or update these details here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="tax-year" className="sr-only">Tax year</Label>
          <select
            id="tax-year"
            value={taxYear}
            onChange={(event) => setTaxYear(Number(event.target.value))}
            className="h-10 rounded-md border border-white/15 bg-[#171717] px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            {yearOptions.map((year) => <option key={year} value={year}>{year} tax year</option>)}
          </select>
        </div>
      </header>

      {showReminder && (
        <div className="rounded-lg border border-amber-400/25 bg-amber-400/[0.06] p-4" role="status">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-amber-300" />
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-white">Tax details may be required for payouts</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/60">
                Acknowledge the deadline and save complete tax details by the final-voting cutoff for your competition. Missing details may affect payout eligibility under the competition terms.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!profile?.acknowledgedAt && (
                  <Button
                    type="button"
                    onClick={() => acknowledgmentMutation.mutate("acknowledge")}
                    disabled={acknowledgmentMutation.isPending}
                    className="min-h-10 bg-orange-500 text-white hover:bg-orange-400"
                  >
                    I understand the deadline
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => acknowledgmentMutation.mutate("dismiss")}
                  disabled={acknowledgmentMutation.isPending}
                  className="min-h-10 text-white/60 hover:bg-white/10 hover:text-white"
                >
                  Dismiss for now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {profile?.dismissedAt && !showReminder && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setShowReminder(true)}
          className="min-h-10 px-0 text-sm text-orange-300 hover:bg-transparent hover:text-orange-200"
        >
          Show tax-information reminder
        </Button>
      )}

      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-none text-orange-300" />
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-white">Final-voting deadlines</h3>
            <p className="mt-1 text-sm text-white/50">Each date comes from the finale voting cutoff when configured, or the competition voting end date.</p>
            {deadlinesQuery.isLoading ? (
              <p className="mt-3 text-sm text-white/40">Loading deadlines…</p>
            ) : deadlines.length ? (
              <ul className="mt-3 divide-y divide-white/[0.08]">
                {deadlines.map((item) => (
                  <li key={`${item.competitionId}-${item.deadline}`} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-white/75">{item.competitionTitle}</span>
                    <span className="text-white/50">Due {dateLabel(item.deadline)} · {item.taxYear} tax year</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-white/40">No competition deadlines are available yet.</p>
            )}
          </div>
        </div>
      </section>

      {profileQuery.isLoading ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-6 text-sm text-white/45">Loading your tax profile…</div>
      ) : profileQuery.isError ? (
        <div className="rounded-lg border border-red-400/25 bg-red-400/[0.06] p-4 text-sm text-red-100">Your tax profile could not be loaded. Try again shortly.</div>
      ) : (
        <>
          {!profile?.encryptionReady && (
            <div className="rounded-lg border border-red-400/25 bg-red-400/[0.06] p-4 text-sm text-red-100">
              Secure tax storage is not configured. Tax IDs cannot be saved until an administrator restores the encryption configuration.
            </div>
          )}
          {profile?.acknowledgedAt && (
            <p className="text-xs text-white/40">Deadline acknowledged {dateLabel(profile.acknowledgedAt)}.</p>
          )}
          <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4 sm:p-5" aria-labelledby="saved-w9-heading">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <FileText className="h-4 w-4 text-orange-300" />
                  <h3 id="saved-w9-heading" className="font-medium text-white">Tax Details · Form W-9</h3>
                  {profile?.current && (
                    <Badge variant="outline" className="border-white/15 text-[10px] text-white/55">
                      {profile.current.w9Complete ? `Complete · ${profile.current.w9FormVersion || "W-9"}` : "Needs W-9 update"}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-white/50">
                  Saved information is encrypted. Your full tax ID is never displayed after saving.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => setW9DialogOpen(true)}
                disabled={!profile?.encryptionReady}
                className="min-h-11 w-full shrink-0 bg-orange-500 text-white hover:bg-orange-400 sm:w-auto"
                data-testid="button-open-w9"
              >
                {profile?.current?.w9Complete ? "Update Form W-9" : "Complete Form W-9"}
              </Button>
            </div>

            {profile?.current ? (
              <>
                <dl className="mt-4 grid gap-x-6 sm:grid-cols-2">
                  {[
                    ["Legal name", profile.current.legalName],
                    ["Business / disregarded entity", profile.current.businessName],
                    ["Federal tax classification", profile.current.federalTaxClassification
                      ? classificationLabels[profile.current.federalTaxClassification] || profile.current.federalTaxClassification
                      : "Not recorded in this version"],
                    ["Other classification detail", profile.current.otherTaxClassification],
                    ["LLC tax classification", profile.current.llcTaxClassification],
                    ["Foreign owners / beneficiaries (line 3b)", typeof profile.current.hasForeignOwners === "boolean"
                      ? (profile.current.hasForeignOwners ? "Yes" : "No")
                      : "Not recorded in this version"],
                    ["Exempt payee code", profile.current.exemptPayeeCode],
                    ["FATCA exemption code", profile.current.fatcaExemptionCode],
                    ["Mailing address", profile.current.address1],
                    ["Apartment / suite", profile.current.address2],
                    ["City", profile.current.city],
                    ["State / region", profile.current.state],
                    ["ZIP / postal code", profile.current.postalCode],
                    ["Country", profile.current.country],
                    ["Requester name and address", profile.current.requesterNameAddress],
                    ["Account numbers", profile.current.accountNumbers],
                    ["Tax ID", currentHasTin
                      ? `${profile.current.taxIdType === "ein" ? "EIN" : "SSN"} ending in ${profile.current.taxIdLast4}`
                      : "Not on file"],
                    ["Backup withholding", profile.current.backupWithholdingCrossedOut
                      ? "IRS notified taxpayer; certification item 2 crossed out"
                      : "Not indicated"],
                    ["Certification", profile.current.certificationAccepted ? "Accepted" : "Not recorded in this version"],
                    ["Electronic signature", profile.current.signature],
                    ["Signature date", profile.current.signatureDate],
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0 border-b border-white/[0.07] py-2.5">
                      <dt className="text-xs text-white/45">{label}</dt>
                      <dd className="mt-0.5 break-words text-sm text-white/85">{value || "—"}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-xs text-white/40">
                  Each save preserves a dated prior version. Leave the tax ID blank in the update form to keep the saved number.
                </p>
              </>
            ) : (
              <p className="mt-4 text-sm text-white/40">No Form W-9 is saved for this tax year yet.</p>
            )}
            {!profile?.acknowledgedAt && (
              <p className="mt-3 text-xs text-amber-200/70">
                Acknowledge the tax deadline above before saving a completed W-9.
              </p>
            )}
          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-orange-300" />
                  <h3 className="font-medium text-white">{taxYear} Form 1099-NEC</h3>
                </div>
                <p className="mt-1 text-sm text-white/50">Recipient copy only. The amount is calculated from Quest payout-ledger entries recorded as paid during this tax year.</p>
                <p className="mt-2 text-sm text-white/75">Paid gross amount: <span className="font-semibold tabular-nums text-white">{money(profile?.paidGrossCents || 0)}</span></p>
                {!profile?.payerConfigured && <p className="mt-2 text-xs text-amber-200/80">Payer details are not configured yet. Contact an administrator before downloading.</p>}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => exportMutation.mutate()}
                disabled={!profile?.currentVersionId || !profile?.payerConfigured || exportMutation.isPending}
                className="min-h-11 border-white/20 text-white hover:bg-white/10"
              >
                <Download className="mr-2 h-4 w-4" />
                {exportMutation.isPending ? "Preparing…" : "Download recipient copy"}
              </Button>
            </div>
            {profile?.versions?.length ? (
              <div className="mt-4 border-t border-white/10 pt-4">
                <Label htmlFor="tax-version" className="text-xs text-white/50">Use a saved profile version</Label>
                <select
                  id="tax-version"
                  value={selectedVersionId}
                  onChange={(event) => setSelectedVersionId(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-white/15 bg-[#171717] px-3 text-sm text-white sm:max-w-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                >
                  {profile.versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.legalName}{version.businessName ? ` · ${version.businessName}` : ""} · ID ending {version.taxIdLast4} · saved {dateLabel(version.createdAt)}
                    </option>
                  ))}
                </select>
                <div className="mt-3 space-y-2">
                  {profile.versions.map((version) => (
                    <div key={`history-${version.id}`} className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-white/65">{version.legalName}{version.businessName ? ` · ${version.businessName}` : ""}</span>
                      <span className="text-white/40">ID ending {version.taxIdLast4} · {dateLabel(version.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-white/40">Save your tax details before requesting a recipient copy.</p>
            )}
            <Badge variant="outline" className="mt-4 border-white/10 text-[10px] text-white/40">Not a filing copy</Badge>
          </section>
        </>
      )}
    </section>
  );
}