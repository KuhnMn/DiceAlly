import { Injectable, computed, inject, signal } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { Auth, User, getAuth, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { APP_RUNTIME_CONFIG } from '../app.tokens';

/** Authentication identifies a user; the database independently decides whether they are approved. */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly config = inject(APP_RUNTIME_CONFIG).firebase;
  private auth?: Auth;
  readonly user = signal<User | null>(null);
  readonly approved = signal(false);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly configured = !!this.config;
  readonly accessible = computed(() => !!this.user() && this.approved());
  readonly ready: Promise<void>;

  constructor() {
    if (!this.config || typeof window === 'undefined') {
      this.loading.set(false);
      this.ready = Promise.resolve();
      return;
    }
    this.auth = getAuth(initializeApp(this.config));
    this.ready = new Promise(resolve => {
      onAuthStateChanged(this.auth!, async user => {
        this.loading.set(true);
        this.approved.set(false);
        this.user.set(user);
        this.error.set('');
        await this.checkApproval();
        resolve();
      });
    });
  }

  /** Recheck after an administrator changes membership, without requiring another sign-in. */
  async checkApproval() {
    const user = this.user();
    if (!user || !this.config) { this.loading.set(false); return; }
    this.loading.set(true);
    this.approved.set(false);
    this.error.set('');
    try {
      const base = this.config.databaseURL.replace(/\/$/, '');
      const response = await fetch(`${base}/members/${encodeURIComponent(user.uid)}.json?auth=${encodeURIComponent(await user.getIdToken())}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(response.status === 401 || response.status === 403
          ? 'Firebase denied the membership lookup. Publish the supplied Realtime Database rules; each signed-in user must be allowed to read their own membership entry.'
          : `Membership lookup failed (HTTP ${response.status}). Check the database URL and connection.`);
      }
      const membership: unknown = await response.json();
      if (this.user() !== user) return;
      this.approved.set(membership === true);
      if (membership === null || membership === false) {
        this.error.set(`No approval found. Add members/${user.uid} with Boolean value true in Realtime Database → Data.`);
      } else if (membership !== true) {
        this.error.set(`The membership entry has the wrong format. Set members/${user.uid} to Boolean true, not a string or object.`);
      }
    } catch (error) {
      if (this.user() === user) this.error.set(error instanceof Error ? error.message : 'Account verification failed.');
    } finally {
      if (this.user() === user) this.loading.set(false);
    }
  }

  async signIn(email: string, password: string) {
    if (!this.auth) throw new Error('Firebase is not configured.');
    await signInWithEmailAndPassword(this.auth, email.trim(), password);
  }
  async resetPassword(email: string) {
    if (!this.auth) throw new Error('Firebase is not configured.');
    await sendPasswordResetEmail(this.auth, email.trim());
  }
  async signOut() {
    if (this.auth) await signOut(this.auth);
    this.approved.set(false);
    this.user.set(null);
    this.loading.set(false);
    this.error.set('');
  }
}
