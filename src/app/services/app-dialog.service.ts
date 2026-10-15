import { Injectable, signal } from '@angular/core';

export interface AppDialogRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancellable: boolean;
  copyValue?: string;
  resolve: (accepted: boolean) => void;
}

/** Queued dialogs let route guards await a decision without blocking the browser. */
@Injectable({ providedIn: 'root' })
export class AppDialogService {
  readonly current = signal<AppDialogRequest | null>(null);
  private readonly queue: AppDialogRequest[] = [];

  confirm(message: string, title = 'Confirm Change', confirmLabel = 'Continue'): Promise<boolean> {
    return this.open({ title, message, confirmLabel, cancellable: true });
  }
  alert(message: string): Promise<boolean> {
    return this.open({ title: 'Notice', message, confirmLabel: 'OK', cancellable: false });
  }
  showCopy(message: string, value: string): Promise<boolean> {
    return this.open({ title: 'Copy Manually', message, copyValue: value, confirmLabel: 'Done', cancellable: false });
  }
  private open(options: Omit<AppDialogRequest, 'resolve'>): Promise<boolean> {
    return new Promise(resolve => {
      this.queue.push({ ...options, resolve });
      this.next();
    });
  }
  finish(accepted: boolean) {
    const request = this.current();
    this.current.set(null);
    request?.resolve(accepted);
    this.next();
  }
  private next() {
    if (!this.current()) this.current.set(this.queue.shift() ?? null);
  }
}
