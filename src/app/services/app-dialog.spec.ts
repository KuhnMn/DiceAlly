import { TestBed } from '@angular/core/testing';
import { AppDialogService } from './app-dialog.service';
import { AppDialogComponent } from '../app-dialog.component';

describe('Application dialogs', () => {
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
