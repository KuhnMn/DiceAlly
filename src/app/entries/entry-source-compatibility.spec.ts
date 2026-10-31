import { TestBed } from '@angular/core/testing';
import { EntryRendererComponent } from './entry-renderer.component';
import { higherLevelEntries } from './entry-compatibility';
import { SourceEntries } from '../content/content-entries';

describe('Source descriptions and Android entry compatibility', () => {
  it('renders structured feature references as readable names inside nested source and saved Android entries', () => {
    const fixture = TestBed.createComponent(EntryRendererComponent);
    fixture.componentRef.setInput('entries', [{ type: 'entries', name: 'Granted features', entries: [
      { type: 'refSubclassFeature', subclassFeature: 'Star Map|Druid|XPHB|Stars|XPHB|3' },
      { type: 'refSubclassFeature', subclassFeature: 'Starry Form|Druid|XPHB|Stars|XPHB|3' },
      { type: 'com.ltx.data.refClassFeature', classFeature: 'Wild Shape|Druid|PHB|2' },
      { type: 'refFeat', feat: 'Magic Initiate|XPHB' },
      { type: 'refOptionalfeature', optionalfeature: 'Agonizing Blast|XPHB' },
    ] }]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect([...root.querySelectorAll('.text-primary')].map(element => element.textContent?.trim()))
      .toEqual(['Star Map', 'Starry Form', 'Wild Shape', 'Magic Initiate', 'Agonizing Blast']);
    expect(root.textContent).toContain('Granted features');
    expect(root.textContent).not.toMatch(/\||XPHB|PHB|Druid/);
    fixture.destroy();
  });

  it('renders nested note references without exposing tags or changing sentence capitalization', () => {
    const fixture = TestBed.createComponent(EntryRendererComponent);
    fixture.componentRef.setInput('entry', 'Before. {@note Created by the {@subclassFeature Eldritch Cannon|Artificer|EFA|Artillerist|EFA|3} subclass feature; casting {@spell Mending|XPHB} restores {@dice 2d6} hit points.} After.');
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Before. Created by the Eldritch Cannon subclass feature;');
    expect(text).toContain('casting Mending restores 2d6 hit points. After.');
    expect(text).not.toMatch(/\{@|\}|\|EFA|\|XPHB/);
    expect(fixture.nativeElement.querySelector('.text-primary')?.textContent).toBe('Eldritch Cannon');
  });
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
