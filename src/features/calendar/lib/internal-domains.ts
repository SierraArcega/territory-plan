// Email domains we treat as internal/colleagues — Fullmind reps and the
// Elevate K12 partner org. These are never offered as "add to contacts" in the
// calendar logging flow. Lowercase; compared case-insensitively.
export const INTERNAL_EMAIL_DOMAINS = [
  "fullmindlearning.com",
  "elevatek12.com",
] as const;

/** The domain part of an email, lowercased. Returns "" when malformed. */
export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).toLowerCase();
}

/** True when the email belongs to an internal/colleague domain. */
export function isInternalEmail(email: string): boolean {
  return (INTERNAL_EMAIL_DOMAINS as readonly string[]).includes(
    emailDomain(email)
  );
}

/** True only for genuinely external emails (district contacts, etc.). */
export function isExternalEmail(email: string): boolean {
  const domain = emailDomain(email);
  return domain !== "" && !isInternalEmail(email);
}
