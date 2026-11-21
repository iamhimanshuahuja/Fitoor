/** Supabase auth errors → plain words (same wording as the web app). */
export function friendlyAuthError(e) {
  const m = String(e?.message || e || '');
  if (/invalid login credentials/i.test(m)) return 'Wrong email or password. Try again, or tap “Forgot password?”.';
  if (/email not confirmed/i.test(m)) return 'Please confirm your email first. Check your inbox (and spam) for our link.';
  if (/already registered|already been registered|user already exists/i.test(m)) return 'This email already has an account. Log in instead, or reset your password.';
  if (/password should be at least|weak password/i.test(m)) return 'Use a longer password: at least 8 characters.';
  if (/rate limit|too many requests/i.test(m)) return 'Too many tries. Wait a minute and try again.';
  if (/invalid email|unable to validate email/i.test(m)) return 'That email address doesn’t look right.';
  if (/network|fetch/i.test(m)) return 'Can’t reach Fitoor. Check your internet and try again.';
  return m || 'Something went wrong. Try again.';
}
