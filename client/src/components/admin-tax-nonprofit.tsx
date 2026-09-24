import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileCheck2, Landmark, LockKeyhole, Save, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type PayerSettings = {
  payerName: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  payerTinLast4: string;
  configured: boolean;
};

type AllocationSource = {
  id: string;
  competitionId: number | null;
  batchId: string | null;
  payeeId: string | null;
  selection: string;
  createdAt: string | null;
  allocatedCents: number;
  usedCents: number;
  remainingCents: number;
  sourceLedgerId: string;
  sourceLedgerStatus: string;
};

type Disbursement = {
  id: string;
  organizationLegalName: string;
  organizationEinLast4: string;
  organizationVerified: boolean;
  verificationMethod: string;
  allocationTransactionId: string;
  sourceLedgerId: string;
  sourceAllocationCents: number;
  amountCents: number;
  allocationDate: string;
  transferDate: string;
  transactionReference: string;
  receiptUrl: string | null;
  transactionEvidenceUrl: string | null;
  agreementUrl: string | null;
  notes: string;
  evidenceComplete: boolean;
};

type DisbursementResponse = {
  records: Disbursement[];
  monthlyTotals: Array<{ month: string; amountCents: number; records: number; missingEvidence: number }>;
};

type DisbursementForm = {
  allocationTransactionId: string;
  organizationLegalName: string;
  organizationEin: string;
  amountDollars: string;
  allocationDate: string;
  transferDate: string;
  transactionReference: string;
  organizationVerified: boolean;
  verificationMethod: string;
  receiptUrl: string;
  transactionEvidenceUrl: string;
  agreementUrl: string;
  notes: string;
};

const money = (cents: number) =>
  `$${(Number(cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dateLabel = (value?: string | null) => value
  ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  : "—";

const today = () => new Date().toISOString().slice(0, 10);
const initialPayer = {
  payerName: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "US",
  phone: "",
  payerEin: "",
};
const initialDisbursement = (): DisbursementForm => ({
  allocationTransactionId: "",
  organizationLegalName: "",
  organizationEin: "",
  amountDollars: "",
  allocationDate: today(),
  transferDate: today(),
  transactionReference: "",
  organizationVerified: false,
  verificationMethod: "",
  receiptUrl: "",
  transactionEvidenceUrl: "",
  agreementUrl: "",
  notes: "",
});

export default function AdminTaxNonprofit() {
  const { toast } = useToast();
  const [payer, setPayer] = useState(initialPayer);
  const [disbursement, setDisbursement] = useState<DisbursementForm>(initialDisbursement);
  const [evidenceEdits, setEvidenceEdits] = useState<Record<string, Partial<DisbursementForm>>>({});
  const payerQuery = useQuery<PayerSettings>({ queryKey: ["/api/admin/tax/payer-settings"] });
  const sourcesQuery = useQuery<AllocationSource[]>({ queryKey: ["/api/admin/nonprofit/allocation-sources"] });
  const recordsQuery = useQuery<DisbursementResponse>({ queryKey: ["/api/admin/nonprofit/disbursements"] });

  useEffect(() => {
    if (!payerQuery.data) return;
    setPayer({
      payerName: payerQuery.data.payerName || "",
      address1: payerQuery.data.address1 || "",
      address2: payerQuery.data.address2 || "",
      city: payerQuery.data.city || "",
      state: payerQuery.data.state || "",
      postalCode: payerQuery.data.postalCode || "",
      country: payerQuery.data.country || "US",
      phone: payerQuery.data.phone || "",
      payerEin: "",
    });
  }, [payerQuery.data]);

  const invalidateAdminData = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/tax/payer-settings"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/nonprofit/allocation-sources"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/nonprofit/disbursements"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/payroll/summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/financial-overview"] });
  };

  const savePayerMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PUT", "/api/admin/tax/payer-settings", payer);
      return response.json();
    },
    onSuccess: () => {
      invalidateAdminData();
      toast({ title: "Payer details saved securely" });
    },
    onError: (error: Error) => toast({ title: "Could not save payer details", description: error.message, variant: "destructive" }),
  });

  const createDisbursementMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/nonprofit/disbursements", disbursement);
      return response.json();
    },
    onSuccess: () => {
      setDisbursement(initialDisbursement());
      invalidateAdminData();
      toast({ title: "Nonprofit transfer recorded" });
    },
    onError: (error: Error) => toast({ title: "Could not record transfer", description: error.message, variant: "destructive" }),
  });

  const updateEvidenceMutation = useMutation({
    mutationFn: async ({ record, edits }: { record: Disbursement; edits: Partial<DisbursementForm> }) => {
      const response = await apiRequest("PATCH", `/api/admin/nonprofit/disbursements/${record.id}`, {
        receiptUrl: edits.receiptUrl ?? record.receiptUrl ?? "",
        transactionEvidenceUrl: edits.transactionEvidenceUrl ?? record.transactionEvidenceUrl ?? "",
        agreementUrl: edits.agreementUrl ?? record.agreementUrl ?? "",
        notes: edits.notes ?? record.notes,
      });
      return response.json();
    },
    onSuccess: (_result, { record }) => {
      setEvidenceEdits((current) => {
        const next = { ...current };
        delete next[record.id];
        return next;
      });
      invalidateAdminData();
      toast({ title: "Disbursement evidence updated" });
    },
    onError: (error: Error) => toast({ title: "Could not update evidence", description: error.message, variant: "destructive" }),
  });

  const setPayerField = (key: keyof typeof initialPayer, value: string) =>
    setPayer((current) => ({ ...current, [key]: value }));
  const setTransferField = (key: keyof DisbursementForm, value: string | boolean) =>
    setDisbursement((current) => ({ ...current, [key]: value }));
  const inputClass = "border-white/15 bg-white/[0.06] text-white placeholder:text-white/25";
  const sources = sourcesQuery.data || [];
  const records = recordsQuery.data?.records || [];

  return (
    <div className="space-y-6" data-testid="admin-tax-nonprofit">
      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 h-5 w-5 flex-none text-orange-300" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium text-white">1099-NEC payer settings</h3>
              <Badge variant="outline" className={payerQuery.data?.configured ? "border-green-400/30 text-green-200" : "border-amber-400/30 text-amber-200"}>
                {payerQuery.data?.configured ? "Configured" : "Needs details"}
              </Badge>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-white/50">
              Enter Original Concepts’ exact legal payer name and mailing details. Do not use an assumed entity name or address; the EIN is encrypted and only its last four digits are returned.
            </p>
          </div>
        </div>

        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            savePayerMutation.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="payer-legal-name" className="text-white/70">Payer’s exact legal name</Label>
              <Input id="payer-legal-name" required value={payer.payerName} onChange={(event) => setPayerField("payerName", event.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="payer-address1" className="text-white/70">Mailing address</Label>
              <Input id="payer-address1" required value={payer.address1} onChange={(event) => setPayerField("address1", event.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="payer-address2" className="text-white/70">Address line 2 (optional)</Label>
              <Input id="payer-address2" value={payer.address2} onChange={(event) => setPayerField("address2", event.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payer-city" className="text-white/70">City</Label>
              <Input id="payer-city" required value={payer.city} onChange={(event) => setPayerField("city", event.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payer-state" className="text-white/70">State / region code</Label>
              <Input id="payer-state" required maxLength={2} placeholder="IL" value={payer.state} onChange={(event) => setPayerField("state", event.target.value.toUpperCase())} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payer-postal" className="text-white/70">ZIP / postal code</Label>
              <Input id="payer-postal" required value={payer.postalCode} onChange={(event) => setPayerField("postalCode", event.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payer-country" className="text-white/70">Country code</Label>
              <Input id="payer-country" required maxLength={2} placeholder="US" value={payer.country} onChange={(event) => setPayerField("country", event.target.value.toUpperCase())} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payer-phone" className="text-white/70">Phone (optional)</Label>
              <Input id="payer-phone" value={payer.phone} onChange={(event) => setPayerField("phone", event.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payer-ein" className="text-white/70">Payer EIN</Label>
              <Input
                id="payer-ein"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={payer.payerEin}
                onChange={(event) => setPayerField("payerEin", event.target.value)}
                placeholder={payerQuery.data?.payerTinLast4 ? `Saved securely · ending in ${payerQuery.data.payerTinLast4}` : "Enter 9 digits"}
                className={inputClass}
              />
              <p className="text-xs text-white/40">Leave blank to keep the saved EIN.</p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={savePayerMutation.isPending} className="min-h-11 bg-orange-500 text-white hover:bg-orange-400">
              <Save className="mr-2 h-4 w-4" /> {savePayerMutation.isPending ? "Saving…" : "Save payer details"}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Landmark className="mt-0.5 h-5 w-5 flex-none text-orange-300" />
          <div>
            <h3 className="font-medium text-white">Record a nonprofit disbursement</h3>
            <p className="mt-1 text-sm text-white/50">This documents a manual transfer only. It does not initiate a payment. Each record must be tied to an existing nonprofit allocation and source ledger entry.</p>
          </div>
        </div>

        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            createDisbursementMutation.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="allocation-source" className="text-white/70">Source allocation</Label>
              <select
                id="allocation-source"
                required
                value={disbursement.allocationTransactionId}
                onChange={(event) => {
                  const source = sources.find((item) => item.id === event.target.value);
                  setDisbursement((current) => ({
                    ...current,
                    allocationTransactionId: event.target.value,
                    allocationDate: source?.createdAt ? new Date(source.createdAt).toISOString().slice(0, 10) : current.allocationDate,
                  }));
                }}
                className="h-10 w-full rounded-md border border-white/15 bg-[#171717] px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
              >
                <option value="">Choose an allocation</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.selection} · {source.competitionId ? `Competition ${source.competitionId} · ` : ""}{money(source.remainingCents)} remaining · ledger {source.sourceLedgerStatus}
                  </option>
                ))}
              </select>
              {!sources.length && !sourcesQuery.isLoading && <p className="text-xs text-amber-200/80">No unrecorded source allocations are available.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-name" className="text-white/70">Nonprofit legal name</Label>
              <Input id="org-name" required value={disbursement.organizationLegalName} onChange={(event) => setTransferField("organizationLegalName", event.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-ein" className="text-white/70">Nonprofit EIN</Label>
              <Input id="org-ein" required type="password" inputMode="numeric" autoComplete="off" value={disbursement.organizationEin} onChange={(event) => setTransferField("organizationEin", event.target.value)} placeholder="Enter 9 digits" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transfer-amount" className="text-white/70">Transfer amount (USD)</Label>
              <Input id="transfer-amount" required type="number" min="0.01" step="0.01" value={disbursement.amountDollars} onChange={(event) => setTransferField("amountDollars", event.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transaction-reference" className="text-white/70">Transaction reference</Label>
              <Input id="transaction-reference" required value={disbursement.transactionReference} onChange={(event) => setTransferField("transactionReference", event.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="allocation-date" className="text-white/70">Allocation date</Label>
              <Input id="allocation-date" type="date" required value={disbursement.allocationDate} onChange={(event) => setTransferField("allocationDate", event.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transfer-date" className="text-white/70">Transfer date</Label>
              <Input id="transfer-date" type="date" required value={disbursement.transferDate} onChange={(event) => setTransferField("transferDate", event.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="verification-method" className="text-white/70">How was the organization verified?</Label>
              <Input id="verification-method" required value={disbursement.verificationMethod} onChange={(event) => setTransferField("verificationMethod", event.target.value)} placeholder="For example, IRS Tax Exempt Organization Search" className={inputClass} />
            </div>
            <label className="flex min-h-11 items-center gap-3 rounded-md border border-white/10 bg-white/[0.025] px-3 text-sm text-white/75 sm:col-span-2">
              <input
                type="checkbox"
                checked={disbursement.organizationVerified}
                onChange={(event) => setTransferField("organizationVerified", event.target.checked)}
                className="h-4 w-4 accent-orange-500"
              />
              I verified the nonprofit’s legal name and tax-exempt status
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="receipt-url" className="text-white/70">Receipt link</Label>
              <Input id="receipt-url" type="url" value={disbursement.receiptUrl} onChange={(event) => setTransferField("receiptUrl", event.target.value)} placeholder="https://…" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="evidence-url" className="text-white/70">Transfer evidence link</Label>
              <Input id="evidence-url" type="url" value={disbursement.transactionEvidenceUrl} onChange={(event) => setTransferField("transactionEvidenceUrl", event.target.value)} placeholder="https://…" className={inputClass} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="agreement-url" className="text-white/70">Donation agreement link</Label>
              <Input id="agreement-url" type="url" value={disbursement.agreementUrl} onChange={(event) => setTransferField("agreementUrl", event.target.value)} placeholder="https://…" className={inputClass} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="disbursement-notes" className="text-white/70">Notes (optional)</Label>
              <Input id="disbursement-notes" value={disbursement.notes} onChange={(event) => setTransferField("notes", event.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={createDisbursementMutation.isPending || !sources.length} className="min-h-11 bg-orange-500 text-white hover:bg-orange-400">
              <Landmark className="mr-2 h-4 w-4" /> {createDisbursementMutation.isPending ? "Recording…" : "Record manual transfer"}
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-orange-300" />
              <h3 className="font-medium text-white">Disbursement records</h3>
            </div>
            <p className="mt-1 text-sm text-white/45">Monthly totals reflect documented transfers, not allocations or evidence records.</p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(recordsQuery.data?.monthlyTotals || []).map((month) => (
            <div key={month.month} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-white">{month.month === "undated" ? "Undated" : new Date(`${month.month}-01T12:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
                {month.missingEvidence > 0 && <Badge variant="outline" className="border-amber-400/30 text-[10px] text-amber-200">{month.missingEvidence} missing evidence</Badge>}
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="text-lg font-semibold tabular-nums text-white">{money(month.amountCents)}</span>
                <span className="text-xs text-white/40">{month.records} transfer{month.records === 1 ? "" : "s"}</span>
              </div>
            </div>
          ))}
          {!recordsQuery.isLoading && !(recordsQuery.data?.monthlyTotals || []).length && (
            <div className="rounded-md border border-dashed border-white/15 p-5 text-sm text-white/40">Monthly totals will appear after a transfer is recorded.</div>
          )}
        </div>

        <div className="space-y-3">
          {records.map((record) => {
            const edits = evidenceEdits[record.id] || {};
            const field = (key: keyof DisbursementForm, current: string | null) =>
              (edits[key] as string | undefined) ?? current ?? "";
            return (
              <article key={record.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-medium text-white">{record.organizationLegalName}</h4>
                      <Badge variant="outline" className="border-white/15 text-[10px] text-white/50">EIN ending {record.organizationEinLast4}</Badge>
                      <Badge variant="outline" className={record.organizationVerified ? "border-green-400/30 text-[10px] text-green-200" : "border-amber-400/30 text-[10px] text-amber-200"}>
                        {record.organizationVerified ? "Verified" : "Unverified"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-white/50">{dateLabel(record.transferDate)} · Ref {record.transactionReference}</p>
                    <p className="mt-1 text-xs text-white/40">{money(record.amountCents)} from allocation {record.allocationTransactionId} · ledger {record.sourceLedgerId}</p>
                  </div>
                  <Badge variant="outline" className={record.evidenceComplete ? "border-green-400/30 text-green-200" : "border-amber-400/30 text-amber-200"}>
                    {record.evidenceComplete ? "Evidence complete" : "Evidence incomplete"}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {([
                    ["receiptUrl", "Receipt link", record.receiptUrl],
                    ["transactionEvidenceUrl", "Transfer evidence", record.transactionEvidenceUrl],
                    ["agreementUrl", "Donation agreement", record.agreementUrl],
                    ["notes", "Notes", record.notes],
                  ] as const).map(([key, label, current]) => (
                    <div key={key} className="space-y-1">
                      <Label htmlFor={`${record.id}-${key}`} className="text-xs text-white/45">{label}</Label>
                      <Input
                        id={`${record.id}-${key}`}
                        type={key === "notes" ? "text" : "url"}
                        value={field(key, current)}
                        onChange={(event) => setEvidenceEdits((state) => ({
                          ...state,
                          [record.id]: { ...state[record.id], [key]: event.target.value },
                        }))}
                        className={inputClass}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[record.receiptUrl, record.transactionEvidenceUrl, record.agreementUrl].filter(Boolean).map((url, index) => (
                    <a key={`${record.id}-evidence-${index}`} href={url!} target="_blank" rel="noreferrer" className="text-xs text-orange-300 underline underline-offset-2 hover:text-orange-200">
                      Open {["receipt", "transfer evidence", "agreement"][index]}
                    </a>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateEvidenceMutation.mutate({ record, edits })}
                    disabled={updateEvidenceMutation.isPending}
                    className="ml-auto min-h-9 border-white/15 text-white/75 hover:bg-white/10"
                  >
                    {updateEvidenceMutation.isPending ? "Saving…" : "Save evidence"}
                  </Button>
                </div>
              </article>
            );
          })}
          {!recordsQuery.isLoading && !records.length && (
            <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-sm text-white/40">No nonprofit transfers have been recorded yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}