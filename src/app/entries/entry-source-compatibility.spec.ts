import { TestBed } from '@angular/core/testing';
import { EntryRendererComponent } from './entry-renderer.component';
import { higherLevelEntries } from './entry-compatibility';
import { SourceEntries } from '../content/content-entries';

describe('Source descriptions and Android entry compatibility', () => {
  it('renders quotes recursively with attribution instead of exposing source JSON', () => {
    const fixture = TestBed.createComponent(EntryRendererComponent);
    const entries: SourceEntries = [
      { type: 'quote', entries: ["When I met {@creature Jim Darkmagic}, I wondered how he got anything done.",
        { type: 'entries', name: 'An aside', entries: ['His outfit is perfect for that.'] }], by: 'Mörgaen' },
      'The spell description continues here.',
    ];
    fixture.componentRef.setInput('entries', entries);
    fixture.detectChanges();
    const quote = fixture.nativeElement.querySelector('blockquote') as HTMLElement;
    expect(quote.textContent).toContain('Jim Darkmagic');
    expect(quote.textContent).toContain('An aside');
    expect(quote.textContent).toContain('His outfit is perfect for that.');
    expect(quote.querySelector('footer')?.textContent).toContain('Mörgaen');
    expect(quote.textContent).not.toContain('The spell description continues');
    expect(fixture.nativeElement.textContent).toContain('The spell description continues');
    expect(fixture.nativeElement.textContent).not.toContain('"type"');
    expect(fixture.nativeElement.textContent).not.toContain('{@');
  });

  it('supports multiple quote authors, source attribution and quotes without attribution', () => {
    const fixture = TestBed.createComponent(EntryRendererComponent);
    fixture.componentRef.setInput('entries', [
      { type: 'quote', entries: ['Quoted words'], by: ['First author', 'Second author'], from: 'A {@i Book}', skipItalics: true, skipMarks: true },
      { type: 'quote', entries: ['Anonymous words'] },
    ]);
    fixture.detectChanges();
    const quotes = fixture.nativeElement.querySelectorAll('blockquote');
    expect(quotes[0].querySelector('footer').textContent).toContain('First author, Second author, A Book');
    expect(quotes[0].querySelector('.italic')).toBeNull();
    expect(quotes[1].querySelector('footer')).toBeNull();
    expect(quotes[1].textContent).toContain('Anonymous words');
  });

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
