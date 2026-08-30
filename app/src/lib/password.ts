// Password rules, kept pure so sign-up and password-reset can't drift apart
// and so they're unit-testable without a browser or a Supabase project.

export const PASSWORD_MIN = 8;

/** bcrypt hashes at most 72 BYTES and silently ignores the rest. Supabase
 * hashes with bcrypt, so a longer password would have its tail quietly
 * dropped — meaning a user could set a 100-character password and later
 * "successfully" sign in with only its first 72 bytes. Rejecting it up
 * front is better than accepting something we can't actually honour. */
export const PASSWORD_MAX_BYTES = 72;

export type PasswordCheck = { ok: true } | { ok: false; error: string };

export function validatePassword(password: string): PasswordCheck {
  if (password.length < PASSWORD_MIN) {
    return { ok: false, error: `Use at least ${PASSWORD_MIN} characters.` };
  }

  // Length is counted in bytes, not characters: emoji and most non-Latin
  // scripts take several bytes each, so a short-looking password can still
  // exceed bcrypt's limit.
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return { ok: false, error: "That password is too long — keep it under 72 bytes." };
  }

  if (!password.trim()) {
    return { ok: false, error: "Your password can't be only spaces." };
  }

  // Not a strength meter — just a floor that catches the genuinely useless
  // ("aaaaaaaa", "11111111") without pretending to score entropy.
  if (new Set(password).size < 4) {
    return { ok: false, error: "Use a mix of at least a few different characters." };
  }

  return { ok: true };
}
