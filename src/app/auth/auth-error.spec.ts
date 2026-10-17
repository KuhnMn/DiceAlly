import { passwordResetErrorMessage, signInErrorMessage } from './auth-error';

describe('Sign-in diagnostics', () => {
  it('reports password reset failures with the Firebase code and no raw error details', () => {
    expect(passwordResetErrorMessage({ code: 'auth/invalid-email' })).toContain('valid email address');
    expect(passwordResetErrorMessage({ code: 'auth/too-many-requests' })).toContain('Wait a while');
    const message = passwordResetErrorMessage({ code: 'auth/internal-error', message: 'private detail' });
    expect(message).toContain('auth/internal-error');
    expect(message).not.toContain('private detail');
  });
  it('identifies deployment failures without displaying raw errors or credentials', () => {
    expect(signInErrorMessage({ code: 'auth/network-request-failed', message: 'private detail' })).toContain('Could not reach Firebase');
    expect(signInErrorMessage({ code: 'auth/unauthorized-domain' })).toContain('not authorized');
    expect(signInErrorMessage({ code: 'auth/invalid-credential', message: 'private detail' })).not.toContain('private detail');
    expect(signInErrorMessage(null)).toContain('Check your email and password');
  });
});
