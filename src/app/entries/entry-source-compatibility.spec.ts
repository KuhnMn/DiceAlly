import { TestBed } from '@angular/core/testing';
import { EntryRendererComponent } from './entry-renderer.component';
import { higherLevelEntries } from './entry-compatibility';
import { SourceEntries } from '../content/content-entries';

describe('Source descriptions and Android entry compatibility', () => {
  it('renders validated strings, integer cells and Android text wrappers together', () => {
    const fixture = TestBed.createComponent(EntryRendererComponent);
    const source: SourceEntries = [{ type: 'table', rows: [[0, 'Source text']] }];
    fixture.componentRef.setInput('entries', [...source, { type: 'com.ltx.data.StringEntry', text: 'Saved Android text' }]);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('0'); expect(text).toContain('Source text'); expect(text).toContain('Saved Android text');
  });
  it('preserves legacy higher-level wrappers and source entry alternatives without rewriting snapshots', () => {
    const legacy = { entries: [{ type: 'com.ltx.data.StringEntry', text: 'Keep' }] };
    expect(higherLevelEntries(legacy)).toEqual(legacy.entries);
    expect(higherLevelEntries('Source higher-level text')).toEqual(['Source higher-level text']);
    expect(higherLevelEntries({ type: 'list', items: ['Option'] })).toEqual([{ type: 'list', items: ['Option'] }]);
  });
});
