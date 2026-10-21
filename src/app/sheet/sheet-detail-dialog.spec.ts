import { TestBed } from '@angular/core/testing';
import { HitDiceTrackerComponent } from './hit-dice-tracker.component';
import { FeaturesPageComponent } from './features-page.component';
import { SpellsPageComponent } from './spells-page.component';
import { adaptSpecies } from '../content/species-adapter';

describe('Sheet detail overlays', () => {
  it('shows all structured species sense ranges in the summary and dialog without parsing descriptions', () => {
    const fixture = TestBed.createComponent(FeaturesPageComponent);
    const definition = adaptSpecies({ darkvision: 60, blindsight: 10, tremorsense: 30, truesight: 120 });
    fixture.componentRef.setInput('characterData', { character: {}, species: {
      name: 'Test species', entity: { name: 'Test species', source: 'TEST', definition, darkvision: 999 },
    } });
    fixture.detectChanges();
    const summary = fixture.nativeElement.querySelector('[aria-label="Species details"]');
    for (const text of ['Darkvision: 60 ft.', 'Blindsight: 10 ft.', 'Tremorsense: 30 ft.', 'Truesight: 120 ft.']) expect(summary.textContent).toContain(text);
    expect(summary.textContent).not.toContain('999');
    fixture.componentInstance.toggleExpanded('species'); fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog');
    for (const text of ['Darkvision: 60 ft.', 'Blindsight: 10 ft.', 'Tremorsense: 30 ft.', 'Truesight: 120 ft.']) expect(dialog.textContent).toContain(text);
    fixture.componentRef.setInput('characterData', { character: {}, species: {
      name: 'Old species', entity: { name: 'Old species', source: 'TEST', blindsight: 0, entries: [{ text: 'Darkvision 90 feet.' }] },
    } });
    fixture.detectChanges();
    expect(fixture.componentInstance.speciesSenses()).toEqual([{ sense: 'blindsight', label: 'Blindsight', rangeFeet: 0 }]);
  });

  it('opens one feature at a time and dismisses without losing notes or spent uses', () => {
    const fixture = TestBed.createComponent(FeaturesPageComponent);
    const features = [
      { editorId: 'first', name: 'First', uses: [{ totalFreeUses: 6, usedFreeUses: 0 }], notes: [{ tag: 'Reminder', notes: ['Keep this'], isEditable: true }] },
      { editorId: 'second', name: 'Second' },
    ];
    fixture.componentRef.setInput('characterData', { character: {}, features });
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.toggleExpanded('feature-first'); fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.textContent).toContain('Keep this');
    dialog.querySelector<HTMLButtonElement>('button[aria-label="Use one Uses"]')!.click();
    fixture.detectChanges();
    expect(features[0].uses![0].usedFreeUses).toBe(1);
    dialog.dispatchEvent(new Event('close')); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    expect(features[0].notes![0].notes).toEqual(['Keep this']);
    component.toggleExpanded('feature-first'); fixture.detectChanges();
    component.toggleExpanded('feature-second'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('dialog').length).toBe(1);
    expect(fixture.nativeElement.querySelector('dialog h2').textContent).toBe('Second');
  });

  it('keeps long spell components, concentration, and higher-level entries inside the dialog', () => {
    const fixture = TestBed.createComponent(SpellsPageComponent);
    fixture.componentRef.setInput('characterData', { character: {}, spells: [{
      editorId: 'spell', name: 'Test spell', listType: 'PREPARED', entity: {
        components: { v: true, m: 'A very long material component description' },
        duration: [{ type: 'timed', duration: { amount: 10, type: 'minute' }, concentration: true }],
        entries: [{ text: 'Full description' }], entriesHigherLevel: [{ entries: [{ text: 'Extra damage' }] }],
      },
    }] });
    fixture.detectChanges();
    fixture.nativeElement.querySelector('h3 button').click(); fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog');
    expect(dialog.textContent).toContain('A very long material component description');
    expect(dialog.textContent).toContain('Concentration');
    expect(dialog.textContent).toContain('Extra damage');
    expect(dialog.querySelector('[data-horizontal-row]')).toBeNull();
  });
});

describe('Health panel hit dice', () => {
  it('spends and restores dice within bounds without automatically changing HP', () => {
    const fixture = TestBed.createComponent(HitDiceTrackerComponent);
    const character = { currentHp: 12, abilityScores: { constitution: 14 }, hitDice: [{ dieType: 'd8', total: 2, used: 1 }] };
    fixture.componentRef.setInput('character', character); fixture.detectChanges();
    const spend = () => fixture.nativeElement.querySelector('button[aria-label="Spend one d8 hit die"]') as HTMLButtonElement;
    const restore = () => fixture.nativeElement.querySelector('button[aria-label="Restore one d8 hit die"]') as HTMLButtonElement;
    expect(fixture.nativeElement.textContent).toContain('Heal: 1d8 +2');
    spend().click(); fixture.detectChanges();
    expect(character.hitDice[0].used).toBe(2);
    expect(spend().disabled).toBe(true);
    restore().click(); fixture.detectChanges();
    restore().click(); fixture.detectChanges();
    expect(character.hitDice[0].used).toBe(0);
    expect(restore().disabled).toBe(true);
    expect(character.currentHp).toBe(12);
  });
});
