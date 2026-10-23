import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, browserSessionPersistence, indexedDBLocalPersistence, initializeAuth, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import type { FirebaseWebConfig } from '../app.tokens';

/** Email/password auth retains the default persistence order without unused popup/redirect support. */
export function createAuthClient(config: FirebaseWebConfig) {
  const auth = initializeAuth(initializeApp(config), {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
  });
  return {
    observe: (callback: Parameters<typeof onAuthStateChanged>[1]) => onAuthStateChanged(auth, callback),
    signIn: (email: string, password: string) => signInWithEmailAndPassword(auth, email, password),
    resetPassword: (email: string) => sendPasswordResetEmail(auth, email),
    signOut: () => signOut(auth),
  };
}
export type FirebaseAuthClient = ReturnType<typeof createAuthClient>;
