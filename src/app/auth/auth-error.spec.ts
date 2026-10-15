import { signInErrorMessage } from './auth-error';

describe('Sign-in diagnostics', () => {
  it('identifies deployment failures without displaying raw errors or credentials', () => {
    expect(signInErrorMessage({ code: 'auth/network-request-failed', message: 'private detail' })).toContain('Could not reach Firebase');
    expect(signInErrorMessage({ code: 'auth/unauthorized-domain' })).toContain('not authorized');
    expect(signInErrorMessage({ code: 'auth/invalid-credential', message: 'private detail' })).not.toContain('private detail');
    expect(signInErrorMessage(null)).toContain('Check your email and password');
  });
});
