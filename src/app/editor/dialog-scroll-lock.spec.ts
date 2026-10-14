import { TestBed } from '@angular/core/testing';
import { DialogScrollLockService } from './dialog-scroll-lock.service';

describe('Nested editor dialogs', () => {
  it('keeps scroll locked until both the catalog and its confirmation are closed', () => {
    const lock = TestBed.inject(DialogScrollLockService);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    lock.lock(); lock.lock();
    expect(document.body.style.overflow).toBe('hidden');
    lock.unlock();
    expect(document.body.style.overflow).toBe('hidden');
    lock.unlock();
    expect(document.body.style.overflow).toBe('auto');
    document.body.style.overflow = previous;
  });
});
