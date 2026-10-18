import { TestBed } from '@angular/core/testing';
import { EditorListHeaderComponent } from './editor-list-header.component';

describe('Editor list header', () => {
  it('keeps list visibility, accessible controls and the catalog action independent', async () => {
    const fixture = TestBed.createComponent(EditorListHeaderComponent);
    fixture.componentRef.setInput('title', 'Features');
    fixture.componentRef.setInput('count', 3);
    fixture.componentRef.setInput('controlsId', 'added-features');
    await fixture.whenStable();
    const visibility: boolean[] = [];
    let added = 0;
    fixture.componentInstance.visible.subscribe(value => visibility.push(value));
    fixture.componentInstance.add.subscribe(() => added++);
    const [toggle, add] = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    expect(toggle.textContent).toContain('Hide List');
    expect(toggle.textContent).toContain('(3)');
    expect(toggle.getAttribute('aria-controls')).toBe('added-features');
    toggle.click(); await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.textContent).toContain('Show List');
    expect(visibility).toEqual([false]);
    add.click();
    expect(added).toBe(1);
    expect(fixture.componentInstance.visible()).toBe(false);
  });
});
