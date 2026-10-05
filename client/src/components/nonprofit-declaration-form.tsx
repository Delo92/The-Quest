import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck } from "lucide-react";
import {
  DEFAULT_NONPROFIT_CONTRIBUTION_PERCENT,
  MAX_NONPROFIT_CONTRIBUTION_PERCENT,
  MIN_NONPROFIT_CONTRIBUTION_PERCENT,
  effectiveNonprofitContributionRate,
  isValidNonprofitContributionRate,
} from "@shared/nonprofit-policy";

export type NonprofitDeclaration = {
  publicName: string;
  legalName: string;
  legalStatus: string;
  taxIdStatus: string;
  taxIdLast4: string;
  mailingAddress: string;
  website: string;
  donationContactName: string;
  donationContactEmail: string;
  donationContactPhone: string;
  designation: string;
  contributionRate: number | null;
  contributionRateAtAcknowledgment?: number | null;
  programAcknowledged: boolean;
  programAcknowledgedAt?: string | null;
  consentToDonate: boolean;
  verificationStatus?: string;
  verifiedAt?: string | null;
};

export const emptyNonprofitDeclaration: NonprofitDeclaration = {
  publicName: "",
  legalName: "",
  legalStatus: "pending",
  taxIdStatus: "not_provided",
  taxIdLast4: "",
  mailingAddress: "",
  website: "",
  donationContactName: "",
  donationContactEmail: "",
  donationContactPhone: "",
  designation: "",
  contributionRate: DEFAULT_NONPROFIT_CONTRIBUTION_PERCENT,
  contributionRateAtAcknowledgment: null,
  programAcknowledged: false,
  consentToDonate: false,
};

export default function NonprofitDeclarationForm({
  value,
  onChange,
  level,
}: {
  value: NonprofitDeclaration;
  onChange: (value: NonprofitDeclaration) => void;
  level: "contestant" | "host";
}) {
  const set = (key: keyof NonprofitDeclaration, next: string | boolean) => {
    const changingRecipient = key === "publicName" || key === "legalName";
    onChange({
      ...value,
      [key]: next,
      ...(changingRecipient ? {
        programAcknowledged: false,
        programAcknowledgedAt: null,
        contributionRateAtAcknowledgment: null,
        consentToDonate: false,
      } : {}),
    } as NonprofitDeclaration);
  };
  const field = (key: keyof NonprofitDeclaration, label: string, placeholder: string, type = "text") => (
    <div className="space-y-1.5">
      <Label className="text-white/65">{label}</Label>
      <Input type={type} value={String(value[key] || "")} onChange={(event) => set(key, event.target.value)} placeholder={placeholder} className="bg-white/[0.07] border-white/15 text-white placeholder:text-white/25" />
    </div>
  );

  const effectiveRate = effectiveNonprofitContributionRate(value.contributionRate)
    ?? DEFAULT_NONPROFIT_CONTRIBUTION_PERCENT;
  const canAcknowledge = isValidNonprofitContributionRate(effectiveRate)
    && Boolean(value.publicName.trim() || value.legalName.trim());
  return (
    <div className="space-y-4 rounded-md border border-orange-400/20 bg-white/[0.03] p-5" data-testid="nonprofit-declaration-form">
      <div className="flex items-start gap-3 border-b border-white/10 pb-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 text-orange-300" />
        <div>
          <p className="text-sm font-semibold text-white">Required nonprofit declaration</p>
          <p className="mt-1 text-xs leading-relaxed text-white/60">
            Choose your own rate from {MIN_NONPROFIT_CONTRIBUTION_PERCENT}% to {MAX_NONPROFIT_CONTRIBUTION_PERCENT}% of your eligible share.
            You can save this declaration in stages; prize payments remain on hold until you name a nonprofit and acknowledge your contribution. The rate defaults to 10% if you leave it unset.
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {field("publicName", "Public nonprofit name", "Name shown in donation records")}
        {field("legalName", "Legal organization name", "Registered legal name")}
        <div className="space-y-1.5">
          <Label className="text-white/65">Legal status</Label>
          <select value={value.legalStatus} onChange={(event) => set("legalStatus", event.target.value)} className="h-10 w-full rounded-md border border-white/15 bg-white/[0.07] px-3 text-sm text-white">
            <option value="501c3">501(c)(3)</option><option value="other">Other nonprofit</option><option value="pending">Verification pending</option><option value="not_verified">Not verified</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-white/65">Tax ID status</Label>
          <select value={value.taxIdStatus} onChange={(event) => set("taxIdStatus", event.target.value)} className="h-10 w-full rounded-md border border-white/15 bg-white/[0.07] px-3 text-sm text-white">
            <option value="not_provided">Not provided</option><option value="on_file_external">Held in external records</option><option value="verified">Verified</option>
          </select>
        </div>
        {field("taxIdLast4", "Tax ID last four (optional)", "Last four only")}
        {field("website", "Website", "https://example.org", "url")}
        {field("donationContactName", "Donation contact", "Contact name")}
        {field("donationContactEmail", "Donation contact email", "donations@example.org", "email")}
        {field("donationContactPhone", "Donation contact phone", "(555) 555-5555", "tel")}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${level}-nonprofit-contribution-rate`} className="text-white/65">Your contribution rate (%)</Label>
        <Input
          id={`${level}-nonprofit-contribution-rate`}
          type="number"
          min={MIN_NONPROFIT_CONTRIBUTION_PERCENT}
          max={MAX_NONPROFIT_CONTRIBUTION_PERCENT}
          step="0.01"
          value={value.contributionRate ?? DEFAULT_NONPROFIT_CONTRIBUTION_PERCENT}
          onChange={(event) => {
            const raw = event.target.value.trim();
            const rate = raw === "" ? null : Number(raw);
            onChange({
              ...value,
              contributionRate: rate,
              contributionRateAtAcknowledgment: null,
              programAcknowledged: false,
              programAcknowledgedAt: null,
              consentToDonate: false,
            });
          }}
          placeholder={`${MIN_NONPROFIT_CONTRIBUTION_PERCENT}–${MAX_NONPROFIT_CONTRIBUTION_PERCENT}%`}
          className="bg-white/[0.07] border-white/15 text-white placeholder:text-white/25"
          aria-describedby={`${level}-nonprofit-contribution-help`}
          data-testid={`${level}-nonprofit-contribution-rate`}
        />
        <p id={`${level}-nonprofit-contribution-help`} className="text-xs leading-relaxed text-white/45">
          This percentage is deducted from your own eligible payout share and allocated to the nonprofit named above. If you leave the rate unset, the 10% default applies.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-white/65">Mailing address</Label>
        <Textarea value={value.mailingAddress} onChange={(event) => set("mailingAddress", event.target.value)} placeholder="Address needed for formal donation records" className="min-h-20 bg-white/[0.07] border-white/15 text-white placeholder:text-white/25" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-white/65">Nonprofit designation or instructions</Label>
        <Textarea value={value.designation} onChange={(event) => set("designation", event.target.value)} placeholder="Optional restrictions or program designation" className="min-h-20 bg-white/[0.07] border-white/15 text-white placeholder:text-white/25" />
      </div>
      <label className="flex items-start gap-3 rounded-md border border-orange-400/20 bg-orange-400/5 p-3 text-xs text-white/65">
        <input
          type="checkbox"
          checked={value.programAcknowledged === true}
          disabled={!canAcknowledge}
          onChange={(event) => onChange({
            ...value,
            contributionRate: event.target.checked ? effectiveRate : value.contributionRate,
            programAcknowledged: event.target.checked,
            programAcknowledgedAt: event.target.checked ? new Date().toISOString() : null,
            contributionRateAtAcknowledgment: event.target.checked ? effectiveRate : null,
            consentToDonate: event.target.checked,
          })}
          className="mt-0.5 h-4 w-4 shrink-0 accent-orange-500"
          aria-label="Acknowledge the required nonprofit contribution policy"
        />
        <span>
          {canAcknowledge
            ? <>I acknowledge that {effectiveRate}% of my eligible share will be allocated to the nonprofit named above before prize earnings are paid.</>
            : <>Enter a nonprofit name before acknowledging. Your rate must be from {MIN_NONPROFIT_CONTRIBUTION_PERCENT}% to {MAX_NONPROFIT_CONTRIBUTION_PERCENT}%; the 10% default applies if you leave it unset.</>}
          {" "}I can save remaining organization details later.
        </span>
      </label>
    </div>
  );
}