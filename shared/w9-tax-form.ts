import { z } from "zod";

export const W9_FORM_VERSION = "2024-03";

export const W9_TAX_CLASSIFICATIONS = [
  "individual_sole_proprietor",
  "c_corporation",
  "s_corporation",
  "partnership",
  "trust_estate",
  "llc",
  "other",
] as const;

export const W9TaxFormSchema = z.object({
  legalName: z.string().trim().min(1, "Enter the name shown on your tax return.").max(160),
  businessName: z.string().trim().max(160),
  federalTaxClassification: z.enum([...W9_TAX_CLASSIFICATIONS, ""]),
  llcTaxClassification: z.enum(["", "C", "S", "P"]),
  otherTaxClassification: z.string().trim().max(120),
  hasForeignOwners: z.boolean(),
  exemptPayeeCode: z.string().trim().max(20),
  fatcaExemptionCode: z.string().trim().max(20),
  address1: z.string().trim().min(1, "Enter your mailing address.").max(180),
  address2: z.string().trim().max(100),
  city: z.string().trim().min(1, "Enter your city.").max(100),
  state: z.string().trim().min(2, "Enter a state or region code.").max(2),
  postalCode: z.string().trim().min(1, "Enter your ZIP or postal code.").max(24),
  country: z.string().trim().min(2, "Enter a country code.").max(2),
  requesterNameAddress: z.string().trim().max(320),
  accountNumbers: z.string().trim().max(120),
  taxIdType: z.enum(["ssn", "ein"]),
  taxId: z.string().trim().refine(
    (value) => value === "" || /^\d{9}$/.test(value.replace(/\D/g, "")),
    "Enter a 9-digit SSN or EIN.",
  ),
  backupWithholdingCrossedOut: z.boolean(),
  certificationAccepted: z.boolean().refine(
    (value) => value,
    "You must certify the information before submitting the W-9.",
  ),
  signature: z.string().trim().min(1, "Enter your electronic signature.").max(160),
  signatureDate: z.string().refine((value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Enter a valid signature date."),
}).superRefine((value, context) => {
  if (!value.federalTaxClassification) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["federalTaxClassification"],
      message: "Select your federal tax classification.",
    });
  }
  if (
    value.federalTaxClassification === "llc"
    && !["C", "S", "P"].includes(value.llcTaxClassification)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["llcTaxClassification"],
      message: "Enter C, S, or P for the LLC's tax classification.",
    });
  }
  if (value.federalTaxClassification === "other" && !value.otherTaxClassification) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["otherTaxClassification"],
      message: "Describe the federal tax classification.",
    });
  }
});

export type W9TaxFormValues = z.infer<typeof W9TaxFormSchema>;

const todayLocal = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

export const emptyW9TaxForm: W9TaxFormValues = {
  legalName: "",
  businessName: "",
  federalTaxClassification: "",
  llcTaxClassification: "",
  otherTaxClassification: "",
  hasForeignOwners: false,
  exemptPayeeCode: "",
  fatcaExemptionCode: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "US",
  requesterNameAddress: "",
  accountNumbers: "",
  taxIdType: "ssn",
  taxId: "",
  backupWithholdingCrossedOut: false,
  certificationAccepted: false,
  signature: "",
  signatureDate: todayLocal(),
};