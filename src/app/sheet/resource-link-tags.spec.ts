import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { emptyBasicCharacter } from '../editor/basic-info';
import { FeaturesPageComponent } from './features-page.component';
import { SpellsPageComponent } from './spells-page.component';

describe('Linked resource costs in collapsed lists', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('resolves links by ID in feature and all spell lists and follows edits without spending resources', () => {
    const sheet = emptyBasicCharacter();
    sheet.resources = [{ id: 'psi', sourceId: 'source', name: 'Psionic Energy', mode: 'counter', note: '', total: { kind: 'fixed', value: 8 }, used: 2, recovery: 'SHORT_REST', features: true, spells: true }];
    const resourceLinks = [{ resourceId: 'psi', amount: 2 }];
    sheet.features = [{ editorId: 'feature', name: 'Psychic Attack', featureType: 'FEAT', source: 'TEST', resourceLinks }];
    sheet.spells = ['PREPARED', 'KNOWN', 'SPELLBOOK'].map(listType => ({ name: 'Psychic Spell', listType, resourceLinks,
      entity: { name: 'Psychic Spell', level: 1, school: 'V', source: 'TEST', time: [], range: {}, components: {}, duration: [], entries: [] } }));
    const features = TestBed.createComponent(FeaturesPageComponent);
    features.componentRef.setInput('characterData', sheet);
    features.componentInstance.setFeatureView('FEAT'); features.detectChanges();
    const spells = TestBed.createComponent(SpellsPageComponent);
    spells.componentRef.setInput('characterData', sheet); spells.detectChanges();
    const tag = (root: HTMLElement) => root.querySelector('app-resource-link-tags [title]') as HTMLElement;
    expect(tag(features.nativeElement).title).toBe('Resource: Psionic Energy · Cost: 2');
    const featureRow = tag(features.nativeElement).closest('app-resource-link-tags')!.parentElement!;
    expect(featureRow.previousElementSibling?.textContent).toContain('Psychic Attack');
    expect(featureRow.nextElementSibling?.textContent).toContain('TEST');
    expect(featureRow.textContent).not.toContain('TEST');
    for (const view of ['PREPARED', 'KNOWN', 'SPELLBOOK'] as const) {
      spells.componentInstance.spellView.set(view); spells.detectChanges();
      expect(tag(spells.nativeElement).title).toBe('Resource: Psionic Energy · Cost: 2');
      const spellRow = tag(spells.nativeElement).closest('app-resource-link-tags')!.parentElement!;
      expect(spellRow.textContent).toContain(view === 'PREPARED' ? 'Evocation' : 'Evoc');
      if (view === 'PREPARED') expect(spellRow.querySelector('button[aria-pressed]')).not.toBeNull();
    }
    const updated = { ...sheet, resources: [{ ...sheet.resources[0], name: 'Custom Focus' }],
      features: sheet.features!.map(feature => ({ ...feature, resourceLinks: [{ resourceId: 'psi', amount: 3 }] })) };
    features.componentRef.setInput('characterData', updated); features.detectChanges();
    expect(tag(features.nativeElement).title).toBe('Resource: Custom Focus · Cost: 3');
    expect(sheet.resources[0].used).toBe(2);
    expect(features.nativeElement.querySelector('app-sheet-detail-dialog')).toBeNull();
    features.destroy(); spells.destroy();
  });
});
