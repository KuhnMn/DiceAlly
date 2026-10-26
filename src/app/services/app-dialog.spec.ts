import { TestBed } from '@angular/core/testing';
import { AppDialogService } from './app-dialog.service';
import { AppDialogComponent } from '../app-dialog.component';

describe('Application dialogs', () => {
  // JSDOM does not implement native modal dialog methods.
  const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
  const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
  });
  afterEach(() => {
    for (const [name, descriptor] of [['showModal', showModal], ['close', close]] as const) {
      if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
    }
  });

  it('opens a reminder as a native modal while the health editor stays open', async () => {
    const healthDialog = document.createElement('dialog');
    document.body.append(healthDialog);
    healthDialog.showModal();
    const dialogs = TestBed.inject(AppDialogService);
    const result = dialogs.alertWithAction('Roll concentration.', 'Concentration Reminder', 'End Concentration');
    const fixture = TestBed.createComponent(AppDialogComponent);
    try {
      fixture.componentRef.setInput('request', dialogs.current());
      fixture.detectChanges();
      await fixture.whenStable();
      const reminder = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
      expect(reminder.open).toBe(true);
      reminder.dispatchEvent(new Event('cancel', { cancelable: true }));
      expect(await result).toBe(true);
      expect(healthDialog.open).toBe(true);
    } finally {
      fixture.destroy();
      healthDialog.close();
      healthDialog.remove();
    }
  });

  it('waits for a choice and queues overlapping requests', async () => {
    const dialogs = TestBed.inject(AppDialogService);
    const leave = dialogs.confirm('Leave?', 'Unsaved Changes', 'Leave Without Saving');
    const notice = dialogs.alert('Saved');
    expect(dialogs.current()?.title).toBe('Unsaved Changes');
    dialogs.finish(false);
    expect(await leave).toBe(false);
    expect(dialogs.current()?.message).toBe('Saved');
    dialogs.finish(true);
    expect(await notice).toBe(true);
    expect(dialogs.current()).toBeNull();
  });

  it('offers Okay and an explicit secondary action, while Escape only acknowledges', async () => {
    const dialogs = TestBed.inject(AppDialogService);
    const result = dialogs.alertWithAction('Roll concentration.', 'Concentration Reminder', 'End Concentration');
    const fixture = TestBed.createComponent(AppDialogComponent);
    fixture.componentRef.setInput('request', dialogs.current()); fixture.detectChanges();
    expect([...fixture.nativeElement.querySelectorAll('button')].map((button: any) => button.textContent.trim())).toEqual(['End Concentration', 'Okay']);
    fixture.componentInstance.escape(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(await result).toBe(true);
    fixture.destroy();
  });

  it('renders safe text and cancels a confirmation with Escape', async () => {
    const dialogs = TestBed.inject(AppDialogService);
    const result = dialogs.confirm('<script>unsafe</script>');
    const fixture = TestBed.createComponent(AppDialogComponent);
    fixture.componentRef.setInput('request', dialogs.current()); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('script')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('<script>unsafe</script>');
    fixture.componentInstance.escape(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(await result).toBe(false);
    fixture.destroy();
  });
});
