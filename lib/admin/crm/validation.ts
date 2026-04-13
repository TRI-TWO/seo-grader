import type { NewPortalClientInput } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_RE = /^\d{5}$/;
/** Light phone check: at least 7 digits somewhere in the string */
const PHONE_RE = /(\d.*){7,}/;

export type ValidationResult = {
  ok: boolean;
  fieldErrors?: Record<string, string>;
};

export function validateNewClientForm(input: NewPortalClientInput): ValidationResult {
  const fieldErrors: Record<string, string> = {};
  const t = (s: string) => s.trim();

  if (!t(input.contact_name)) fieldErrors.contact_name = "Required.";
  if (!t(input.company_name)) fieldErrors.company_name = "Required.";
  if (!t(input.email)) fieldErrors.email = "Required.";
  else if (!EMAIL_RE.test(t(input.email))) fieldErrors.email = "Enter a valid email.";
  if (!t(input.phone)) fieldErrors.phone = "Required.";
  else if (!PHONE_RE.test(t(input.phone))) fieldErrors.phone = "Enter a valid phone number.";
  if (!t(input.address_line_1)) fieldErrors.address_line_1 = "Required.";
  if (!t(input.city)) fieldErrors.city = "Required.";
  if (!t(input.state)) fieldErrors.state = "Required.";
  if (!ZIP_RE.test(t(input.zip))) fieldErrors.zip = "Enter a valid 5-digit US ZIP.";
  if (!t(input.industry)) fieldErrors.industry = "Required.";

  return { ok: Object.keys(fieldErrors).length === 0, fieldErrors };
}

export function validateClientDeleteSelection(ids: string[]): ValidationResult {
  if (!ids.length) {
    return { ok: false, fieldErrors: { selection: "Select at least one client." } };
  }
  return { ok: true };
}
