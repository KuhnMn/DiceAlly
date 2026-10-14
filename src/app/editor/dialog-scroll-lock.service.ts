import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/** Reference counting keeps a confirmation over a catalog from restoring scroll too early. */
@Injectable({ providedIn: 'root' })
export class DialogScrollLockService {
  private readonly document = inject(DOCUMENT);
  private activeDialogs = 0;
  private previousOverflow = '';

  lock() {
    if (this.activeDialogs++ === 0) {
      this.previousOverflow = this.document.body.style.overflow;
      this.document.body.style.overflow = 'hidden';
    }
  }

  unlock() {
    if (this.activeDialogs === 0) return;
    if (--this.activeDialogs === 0) this.document.body.style.overflow = this.previousOverflow;
  }
}
