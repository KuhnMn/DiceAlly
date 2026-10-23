import { TestBed } from '@angular/core/testing';
import { SpellCastControlComponent } from './spell-cast-control.component';
import { CharacterStore } from '../stores/character.store';
import { emptyBasicCharacter } from '../editor/basic-info';
import { ExportedCharacter, SpellEntryFull } from '../models/character.model';
import { CombatActionComponent } from './combat-action.component';
import { SpellsPageComponent } from './spells-page.component';

function spell(level = 1, castingSourceName = 'Wizard'): SpellEntryFull {
  return { editorId: 'spell', name: 'Test Spell', castingSourceName, listType: 'PREPARED', source: 'TEST',
    entity: { name: 'Test Spell', source: 'TEST', level, school: 'V', time: [{ number: 1, unit: 'action' }],
      range: { type: 'self' }, components: { v: true }, duration: [{ type: 'instant' }], entries: [{ text: 'Spell description.' }] } };
}
function sheet(): ExportedCharacter {
  const value = emptyBasicCharacter();
  value.character!.spellSlots = { Wizard: [{ level: 1, total: 2, used: 1 }, { level: 2, total: 1, used: 0 }] };
  return value;
}
function setup(entry = spell(), value = sheet()) {
  const store = TestBed.inject(CharacterStore); store.setCharacter(value);
  const fixture = TestBed.createComponent(SpellCastControlComponent);
  fixture.componentRef.setInput('spell', entry); fixture.componentRef.setInput('sheet', value); fixture.detectChanges();
  return { fixture, control: fixture.componentInstance, store, value };
}

describe('Cast from spell details', () => {
  it('defaults to the spell level, spends one slot, disables at zero remaining, and rejects repeated casts before rerender', () => {
    const { fixture, control, store } = setup();
    expect(control.level()).toBe(1); expect(control.levels()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    fixture.nativeElement.querySelector('button').click();
    expect(store.characterData()!.character!.spellSlots!['Wizard'][0].used).toBe(2);
    control.cast(); expect(store.characterData()!.character!.spellSlots!['Wizard'][0].used).toBe(2);
    fixture.detectChanges(); expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);
    expect(store.characterData()!.character!.spellSlots!['Wizard'][1].used).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('0 / 2 available');
    fixture.destroy();
  });

  it('supports upcasting and does not consume a lower-level slot', () => {
    const { fixture, control, store } = setup();
    const select = fixture.nativeElement.querySelector('select[aria-label="Cast level"]') as HTMLSelectElement;
    select.value = '2'; select.dispatchEvent(new Event('change')); fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    expect(store.characterData()!.character!.spellSlots!['Wizard'].map(slot => slot.used)).toEqual([1, 1]);
    expect(control.canCast()).toBe(false); fixture.destroy();
  });

  it('never casts at lower, fractional or invalid levels, and disables when the chosen level has no slots', () => {
    const { fixture, control, store, value } = setup(spell(2));
    expect(control.level()).toBe(2); expect(control.levels()).not.toContain(1);
    for (const invalid of ['1', '2.5', '', '10', '-1', 'invalid']) {
      control.setLevel(invalid); expect(control.canCast()).toBe(false); control.cast(); expect(store.characterData()).toBe(value);
    }
    control.setLevel('3'); fixture.detectChanges(); expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('No spell slots available'); fixture.destroy();
  });

  it('selects the spell casting source by default and consumes only the selected recovery pool at that level', () => {
    const value = sheet(); value.character!.spellSlots = {
      Wizard: [{ level: 1, total: 2, used: 0, regainCondition: 'LONG_REST' }, { level: 1, total: 1, used: 0, regainCondition: 'SHORT_REST' }],
      Warlock: [{ level: 1, total: 1, used: 0, regainCondition: 'SHORT_REST' }],
    };
    const { fixture, control, store } = setup(spell(1, 'Warlock'), value);
    expect(control.pool()?.source).toBe('Warlock'); control.cast();
    expect(store.characterData()!.character!.spellSlots!['Warlock'][0].used).toBe(1);
    expect(control.canCast()).toBe(false);
    const shortRest = control.pools().find(pool => pool.source === 'Wizard' && pool.slot.regainCondition === 'SHORT_REST')!;
    control.selectedPool.set(shortRest.key); control.cast();
    expect(store.characterData()!.character!.spellSlots!['Wizard'].map(slot => slot.used)).toEqual([0, 1]);
    expect(store.characterData()!.character!.spellSlots!['Warlock'][0].used).toBe(1); fixture.destroy();
  });

  it('updates availability after a rest and resets the level when opening a different spell', () => {
    const { fixture, control, store } = setup();
    control.cast(); expect(control.canCast()).toBe(false);
    const rested = structuredClone(store.characterData()!); rested.character!.spellSlots!['Wizard'][0].used = 0; store.setCharacter(rested);
    expect(control.canCast()).toBe(true); control.setLevel('4');
    fixture.componentRef.setInput('spell', { ...spell(2), editorId: 'other' }); fixture.detectChanges();
    expect(control.level()).toBe(2); fixture.destroy();
  });

  it('keeps cantrips fixed at C and always enabled, without spending slots or producing any effect', () => {
    const value = sheet(); value.character!.spellSlots = {};
    const { fixture, control, store } = setup(spell(0), value);
    const before = structuredClone(value);
    const level = fixture.nativeElement.querySelector('select[aria-label="Cast level"]') as HTMLSelectElement;
    expect(level.disabled).toBe(true); expect(level.selectedOptions[0].textContent?.trim()).toBe('C');
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(false);
    control.setLevel('2'); expect(control.level()).toBe(0);
    fixture.nativeElement.querySelector('button').click(); control.cast(); fixture.detectChanges();
    expect(store.characterData()).toBe(value); expect(store.characterData()).toEqual(before);
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull(); fixture.destroy();
  });

  it('does not spend slots from a different character or invent a level for an unknown spell', () => {
    const { fixture, control, store } = setup();
    const other = sheet(); store.setCharacter(other); expect(control.canCast()).toBe(false); control.cast(); expect(store.characterData()).toBe(other);
    fixture.componentRef.setInput('spell', { name: 'Unknown' }); fixture.detectChanges();
    expect(control.canCast()).toBe(false); expect(control.level()).toBeNull(); fixture.destroy();
  });

  it.each(['Spells', 'Combat'])('spends the same tracked slots from the %s detail dialog', location => {
    const value = sheet(), entry = spell(); value.spells = [entry];
    const store = TestBed.inject(CharacterStore); store.setCharacter(value);
    const fixture = location === 'Spells' ? TestBed.createComponent(SpellsPageComponent) : TestBed.createComponent(CombatActionComponent);
    if (fixture.componentInstance instanceof SpellsPageComponent) {
      fixture.componentRef.setInput('characterData', value); fixture.detectChanges();
      fixture.componentInstance.toggleExpanded(fixture.componentInstance.spellExpansionId(entry));
    } else {
      fixture.componentRef.setInput('sheet', value);
      fixture.componentRef.setInput('action', { name: 'Test Spell', linkedResourceType: 'SPELL', linkedResource: { editorId: 'spell' } });
      fixture.detectChanges(); fixture.componentInstance.opened.set(true);
    }
    fixture.detectChanges();
    fixture.nativeElement.querySelector('dialog button[aria-label="Cast Test Spell"]').click();
    expect(store.characterData()!.character!.spellSlots!['Wizard'][0].used).toBe(2);
    fixture.destroy();
  });
});
