/** Keep credentials private while exposing the Firebase code needed to diagnose deployment failures. */
export function signInErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code : '';
  const messages: Record<string, string> = {
    'auth/unauthorized-domain': 'This website domain is not authorized in Firebase Authentication.',
    'auth/network-request-failed': 'Could not reach Firebase Authentication. Check your connection or browser request blocking.',
    'auth/operation-not-allowed': 'Email/password sign-in is not enabled for this Firebase project.',
    'auth/invalid-api-key': 'The deployed Firebase API key is invalid. Rebuild with the correct environment configuration.',
    'auth/app-not-authorized': 'Firebase rejected this website. Check the API key website restrictions.',
    'auth/too-many-requests': 'Too many sign-in attempts. Wait a while before trying again.',
    'auth/web-storage-unsupported': 'Browser storage is unavailable. Allow storage for this website to sign in.',
    'auth/user-disabled': 'This account has been disabled. Contact the app owner.',
  };
  const message = messages[code] ?? 'Sign-in failed. Check your email and password, then try again.';
  return code ? `${message} (${code})` : message;
}

export function passwordResetErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code : '';
  const messages: Record<string, string> = {
    'auth/invalid-email': 'Enter a valid email address to reset your password.',
    'auth/missing-email': 'Enter your email address to reset your password.',
    'auth/too-many-requests': 'Too many password reset requests. Wait a while before trying again.',
    'auth/network-request-failed': 'Could not reach Firebase Authentication. Check your connection or browser request blocking.',
  };
  return `${messages[code] ?? 'Could not request a password reset.'}${code ? ` (${code})` : ' Please try again later.'}`;
}
