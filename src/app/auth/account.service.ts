import { Injectable, computed, inject, signal } from '@angular/core';
import type { User } from 'firebase/auth';
import type { FirebaseAuthClient } from './firebase-auth';
import { AUTH_CLIENT_LOADER } from './auth-client-loader';
import { APP_RUNTIME_CONFIG } from '../app.tokens';

/** Authentication identifies a user; the database independently decides whether they are approved. */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly config = inject(APP_RUNTIME_CONFIG).firebase;
  private auth?: FirebaseAuthClient;
  private readonly loadAuth = inject(AUTH_CLIENT_LOADER);
  readonly initializationFailed = signal(false);
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
    this.ready = this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      this.auth = await this.loadAuth(this.config!);
      await new Promise<void>(resolve => {
        this.auth!.observe(async user => {
          this.loading.set(true);
          this.approved.set(false);
          this.user.set(user);
          this.error.set('');
          await this.checkApproval();
          resolve();
        });
      });
    } catch {
      this.initializationFailed.set(true);
      this.error.set('Sign-in could not be loaded. Check your connection and reload the app to try again.');
      this.loading.set(false);
    }
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
    await this.ready;
    if (!this.auth) throw new Error(this.error() || 'Firebase is not configured.');
    await this.auth.signIn(email.trim(), password);
  }
  async resetPassword(email: string) {
    await this.ready;
    if (!this.auth) throw new Error(this.error() || 'Firebase is not configured.');
    await this.auth.resetPassword(email.trim());
  }
  async signOut() {
    if (this.auth) await this.auth.signOut();
    this.approved.set(false);
    this.user.set(null);
    this.loading.set(false);
    this.error.set('');
  }
}
