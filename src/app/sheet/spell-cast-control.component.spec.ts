import { TestBed } from '@angular/core/testing';
import { SpellCastControlComponent } from './spell-cast-control.component';
import { CharacterStore } from '../stores/character.store';
import { emptyBasicCharacter } from '../editor/basic-info';
import { ExportedCharacter, SpellEntryFull } from '../models/character.model';
import { CombatActionComponent } from './combat-action.component';
import { SpellsPageComponent } from './spells-page.component';
import { AppDialogService } from '../services/app-dialog.service';
import { By } from '@angular/platform-browser';

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
  it('offers Ritual - Free only for ritual spells, fixes its level to base and never spends slots or Uses', async () => {
    const entry = spell(), value = sheet(); value.spells = [entry];
    entry.entity!.meta = { ritual: true }; entry.uses = [{ totalFreeUses: 1, usedFreeUses: 0 }];
    const { fixture, control, store } = setup(entry, value);
    const resourceSelect = fixture.nativeElement.querySelector('select[aria-label="Casting resource"]') as HTMLSelectElement;
    expect([...resourceSelect.options].some(option => option.textContent === 'Ritual - Free')).toBe(true);
    expect(control.resource()?.kind).toBe('slot');
    control.setLevel('2'); resourceSelect.value = 'ritual'; resourceSelect.dispatchEvent(new Event('change')); fixture.detectChanges();
    expect(control.level()).toBe(1); expect(control.levels()).toEqual([1]); expect(control.upcasting()).toBe(false);
    expect(fixture.nativeElement.querySelector('select[aria-label="Cast level"]').disabled).toBe(true);
    control.setLevel('2'); expect(control.level()).toBe(1);
    const before = structuredClone(value);
    await control.cast(); await control.cast();
    expect(store.characterData()).toEqual(before); expect(control.canCast()).toBe(true);
    expect(control.feedback()).toContain('as a ritual');
    entry.entity!.meta.ritual = false; fixture.detectChanges();
    expect(control.resources().some(resource => resource.kind === 'ritual')).toBe(false);
    expect(control.canCast()).toBe(false);
    fixture.destroy();
  });

  it('supports ritual casting without slots and preserves preparation and concentration confirmations', async () => {
    const entry = spell(), value = sheet(); value.spells = [entry]; value.character!.spellSlots = {};
    entry.listType = 'KNOWN'; entry.entity!.meta = { ritual: true }; entry.entity!.duration = [{ concentration: true }];
    value.character!.concentrationEffect = 'Entangle';
    const { fixture, control, store } = setup(entry, value), dialogs = TestBed.inject(AppDialogService);
    control.setResource('ritual'); expect(control.canCast()).toBe(true);
    const before = structuredClone(value), cancelled = control.cast();
    expect(dialogs.current()?.title).toBe('Spell Not Prepared'); dialogs.finish(false); await cancelled;
    expect(store.characterData()).toEqual(before);
    const declined = control.cast(); dialogs.finish(true); await Promise.resolve();
    expect(dialogs.current()?.title).toBe('Concentration Already Active'); dialogs.finish(false); await declined;
    expect(store.characterData()).toEqual(before);
    const accepted = control.cast(); dialogs.finish(true); await Promise.resolve(); dialogs.finish(true); await accepted;
    expect(store.characterData()!.character!.concentrationEffect).toBe(entry.name);
    expect(store.characterData()!.character!.spellSlots).toEqual({});
    expect(store.characterData()!.spells).toEqual(value.spells);
    fixture.destroy();
  });

  it.each(['KNOWN', 'SPELLBOOK'])('warns before casting a %s spell and spends nothing on cancellation', async listType => {
    const entry = spell(), value = sheet(); entry.listType = listType; value.spells = [entry];
    entry.entity!.duration = [{ concentration: true }]; value.character!.concentrationEffect = 'Entangle';
    const { fixture, control, store } = setup(entry, value), dialogs = TestBed.inject(AppDialogService);
    const before = structuredClone(value), cancelled = control.cast();
    expect(dialogs.current()?.title).toBe('Spell Not Prepared');
    expect(dialogs.current()?.message).toContain('Test Spell is not prepared');
    expect(dialogs.current()?.confirmLabel).toBe('Cast Anyway');
    expect(control.canCast()).toBe(false); expect(store.characterData()).toEqual(before);
    dialogs.finish(false); await cancelled;
    expect(dialogs.current()).toBeNull(); expect(store.characterData()).toEqual(before);
    const cast = control.cast(); dialogs.finish(true); await Promise.resolve();
    expect(dialogs.current()?.title).toBe('Concentration Already Active');
    dialogs.finish(true); await cast;
    expect(store.characterData()!.character!.spellSlots!['Wizard'][0].used).toBe(2);
    expect(store.characterData()!.character!.concentrationEffect).toBe(entry.name);
    expect(store.characterData()!.spells![0].listType).toBe(listType);
    fixture.destroy();
  });

  it.each([0, 1])('also warns for an unprepared level %s spell cast using attached Uses', async level => {
    const entry = spell(level), value = sheet(); entry.listType = 'KNOWN'; entry.uses = [{ totalFreeUses: 2, usedFreeUses: 0 }]; value.spells = [entry];
    const { fixture, control, store } = setup(entry, value), dialogs = TestBed.inject(AppDialogService);
    control.setResource('use:0');
    const cancelled = control.cast(); dialogs.finish(false); await cancelled;
    expect(store.characterData()!.spells![0].uses![0].usedFreeUses).toBe(0);
    const accepted = control.cast(); dialogs.finish(true); await accepted;
    expect(store.characterData()!.spells![0].uses![0].usedFreeUses).toBe(1);
    expect(store.characterData()!.character!.spellSlots!['Wizard'][0].used).toBe(1);
    fixture.destroy();
  });

  it('recognizes the same spell prepared in another list while keeping editions and casting sources distinct', async () => {
    const entry = spell(), value = sheet(); entry.listType = 'SPELLBOOK'; value.spells = [entry, { ...spell(), editorId: 'prepared' }];
    const { fixture, control, store } = setup(entry, value), dialogs = TestBed.inject(AppDialogService);
    expect(control.isPrepared()).toBe(true); await control.cast(); expect(dialogs.current()).toBeNull();
    const current = structuredClone(store.characterData()!);
    current.spells![1].source = 'Other Edition'; store.setCharacter(current); expect(control.isPrepared()).toBe(false);
    current.spells![1].source = entry.source; current.spells![1].castingSourceName = 'Other Source'; expect(control.isPrepared()).toBe(false);
    fixture.destroy();
  });

  it('preserves a manually selected source and recovery pool across cast levels and unavailable levels', async () => {
    const value = sheet();
    value.character!.spellSlots = {
      Wizard: [{ level: 1, total: 2, used: 0 }, { level: 2, total: 2, used: 0 }, { level: 3, total: 2, used: 0 }],
      Artificer: [
        { level: 2, total: 3, used: 0, regainCondition: 'LONG_REST' },
        { level: 1, total: 1, used: 0, regainCondition: 'SHORT_REST' },
        { level: 2, total: 1, used: 0, regainCondition: 'SHORT_REST' },
      ],
    };
    const { fixture, control, store } = setup(spell(), value);
    control.setResource(control.pools().find(pool => pool.source === 'Artificer' && pool.slot.regainCondition === 'SHORT_REST')!.key);
    const key = control.selectedPool();
    control.setLevel('2'); fixture.detectChanges();
    expect(control.selectedPool()).toBe(key);
    expect(control.pool()).toMatchObject({ source: 'Artificer', index: 2 });
    const select = fixture.nativeElement.querySelector('select[aria-label="Casting resource"]') as HTMLSelectElement;
    expect(select.value).toBe(key);
    control.setLevel('3');
    expect(control.resource()?.key).toBe(key); expect(control.levels()).toEqual([1, 2]); expect(control.canCast()).toBe(false);
    await control.cast(); expect(store.characterData()).toBe(value);
    control.setLevel('2'); await control.cast();
    expect(store.characterData()!.character!.spellSlots!['Artificer'].map(slot => slot.used)).toEqual([0, 0, 1]);
    expect(store.characterData()!.character!.spellSlots!['Wizard'].map(slot => slot.used)).toEqual([0, 0, 0]);
    control.setLevel('1'); expect(control.pool()?.index).toBe(1);
    fixture.destroy();
  });

  it('lists all resources before the cast row and derives applicable levels from the selected resource', async () => {
    const entry = spell(), value = sheet(); value.spells = [entry];
    value.character!.spellSlots!['Warlock'] = [{ level: 3, total: 2, used: 0, regainCondition: 'SHORT_REST' }];
    value.character!.spellSlots!['Artificer'] = [{ level: 2, total: 1, used: 1 }];
    entry.uses = [{ tag: 'Free Cast', totalFreeUses: 1, usedFreeUses: 0 }];
    const { fixture, control, store } = setup(entry, value);
    const resourceSelect = fixture.nativeElement.querySelector('select[aria-label="Casting resource"]') as HTMLSelectElement;
    const levelSelect = fixture.nativeElement.querySelector('select[aria-label="Cast level"]') as HTMLSelectElement;
    expect(resourceSelect.compareDocumentPosition(levelSelect) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(control.resources()).toHaveLength(4);
    const keys = control.resources().map(resource => resource.key);
    const warlock = control.resources().find(resource => resource.label.startsWith('Warlock'))!;
    resourceSelect.value = warlock.key; resourceSelect.dispatchEvent(new Event('change')); fixture.detectChanges();
    expect(control.levels()).toEqual([3]); expect(control.level()).toBe(3); expect(levelSelect.disabled).toBe(true);
    expect(control.resources().map(resource => resource.key)).toEqual(keys);
    await control.cast(); expect(store.characterData()!.character!.spellSlots!['Warlock'][0].used).toBe(1);
    control.setResource('use:0'); fixture.detectChanges();
    expect(control.levels()).toEqual([1]); expect(control.level()).toBe(1); expect(levelSelect.disabled).toBe(true);
    expect(control.resources().map(resource => resource.key)).toEqual(keys);
    await control.cast(); expect(store.characterData()!.spells![0].uses![0].usedFreeUses).toBe(1);
    const artificer = control.resources().find(resource => resource.label.startsWith('Artificer'))!;
    control.setResource(artificer.key); fixture.detectChanges();
    expect(control.levels()).toEqual([2]); expect(control.level()).toBe(2); expect(control.canCast()).toBe(false);
    const wizard = control.resources().find(resource => resource.label.startsWith('Wizard'))!;
    control.setResource(wizard.key); expect(control.level()).toBe(2); expect(control.levels()).toEqual([1, 2]);
    fixture.destroy();
  });

  it('keeps legacy prepared and known copies separate when spending attached uses', async () => {
    const entry = spell(), value = sheet(); delete entry.editorId;
    entry.uses = [{ tag: 'Gift', totalFreeUses: 2, usedFreeUses: 0 }];
    value.spells = [{ ...structuredClone(entry), listType: 'KNOWN' }, entry];
    const { fixture, control, store } = setup(entry, value);
    control.setResource('use:0'); await control.cast(); await control.cast();
    expect(store.characterData()!.spells!.map(spell => spell.uses![0].usedFreeUses)).toEqual([0, 2]);
    fixture.destroy();
  });

  it('keeps lower-level resources listed even when they have no applicable level for this spell', () => {
    const value = sheet(); value.character!.spellSlots!['Warlock'] = [{ level: 5, total: 1, used: 0 }];
    const { fixture, control } = setup(spell(4), value);
    expect(control.resources().map(resource => resource.label)).toEqual(['Wizard · Long Rest', 'Warlock · Long Rest']);
    expect(control.resource()?.label).toBe('Wizard · Long Rest');
    expect(control.levels()).toEqual([]); expect(control.level()).toBeNull(); expect(control.canCast()).toBe(false);
    control.setResource(control.resources()[1].key);
    expect(control.levels()).toEqual([5]); expect(control.level()).toBe(5); expect(control.canCast()).toBe(true);
    fixture.destroy();
  });

  it.each([0, 1])('spends only the explicitly selected attached use for a level %s spell', async level => {
    const entry = spell(level), value = sheet(); value.spells = [entry];
    entry.uses = [{ tag: 'Gift', totalFreeUses: 1, usedFreeUses: 0 }, { tag: 'Other Use', totalFreeUses: 3, usedFreeUses: 1 }];
    const { fixture, control, store } = setup(entry, value);
    expect(control.resource()?.kind).toBe(level === 0 ? 'cantrip' : 'slot');
    expect(fixture.nativeElement.querySelector('select[aria-label="Casting resource"]')).not.toBeNull();
    if (level) control.setLevel('4');
    control.setResource('use:0'); expect(control.level()).toBe(level);
    await control.cast(); await control.cast();
    expect(store.characterData()!.spells![0].uses!.map(use => use.usedFreeUses)).toEqual([1, 1]);
    expect(store.characterData()!.character!.spellSlots!['Wizard'].map(slot => slot.used)).toEqual([1, 0]);
    expect(control.canCast()).toBe(false);
    control.setResource('use:1'); await control.cast();
    expect(store.characterData()!.spells![0].uses![1].usedFreeUses).toBe(2);
    if (level === 0) { control.setResource('cantrip'); expect(control.canCast()).toBe(true); }
    const rested = structuredClone(store.characterData()!); rested.spells![0].uses![0].usedFreeUses = 0; store.setCharacter(rested);
    control.setResource('use:0'); expect(control.canCast()).toBe(true);
    fixture.destroy();
  });

  it('requires an explicit choice when only uses are available and reads manual tracker changes immediately', async () => {
    const entry = spell(), value = sheet(); value.spells = [entry]; value.character!.spellSlots = {};
    entry.uses = [{ tag: 'Gift', totalFreeUses: 1, usedFreeUses: 0 }];
    const { fixture, control, store } = setup(entry, value);
    expect(control.canCast()).toBe(false);
    control.setResource('use:0'); expect(control.canCast()).toBe(true);
    entry.uses[0].usedFreeUses = 1;
    expect(control.canCast()).toBe(false); await control.cast(); expect(store.characterData()).toBe(value);
    entry.uses[0].usedFreeUses = 0;
    await control.cast(); expect(store.characterData()!.spells![0].uses![0].usedFreeUses).toBe(1);
    fixture.destroy();
  });

  it.each([{ level: 0, use: false }, { level: 0, use: true }, { level: 1, use: false }, { level: 1, use: true }])('confirms concentration before spending a resource for $level / use=$use, with cancellation', async ({ level, use }) => {
    const entry = spell(level), value = sheet(); value.spells = [entry]; value.character!.concentrationEffect = 'Entangle';
    entry.entity!.duration = [{ type: 'timed', concentration: true, duration: { amount: 1, type: 'minute' } }];
    entry.uses = [{ tag: 'Gift', totalFreeUses: 2, usedFreeUses: 0 }];
    const { fixture, control, store } = setup(entry, value);
    if (use) control.setResource('use:0');
    const dialogs = TestBed.inject(AppDialogService), before = structuredClone(value);
    const cancelled = control.cast();
    expect(dialogs.current()?.message).toContain('Entangle'); expect(control.canCast()).toBe(false);
    await control.cast(); // A second click cannot queue another cast while a decision is pending.
    expect(store.characterData()).toEqual(before);
    dialogs.finish(false); await cancelled;
    expect(dialogs.current()).toBeNull(); expect(store.characterData()).toEqual(before);
    const confirmed = control.cast(); dialogs.finish(true); await confirmed;
    expect(store.characterData()!.character!.concentrationEffect).toBe('Test Spell');
    expect(store.characterData()!.spells![0].uses![0].usedFreeUses).toBe(use ? 1 : 0);
    expect(store.characterData()!.character!.spellSlots!['Wizard'][0].used).toBe(!use && level > 0 ? 2 : 1);
    fixture.destroy();
  });

  it('tracks cantrip concentration without slots and lets the user opt out of tracking', async () => {
    const entry = spell(0), value = sheet(); value.spells = [entry]; value.character!.spellSlots = {};
    entry.entity!.duration = [{ concentration: true, duration: { amount: 1, type: 'minute' } }];
    const { fixture, control, store } = setup(entry, value);
    const toggle = fixture.nativeElement.querySelector('button[aria-label="Track concentration after casting"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    toggle.click(); await control.cast(); expect(store.characterData()!.character!.concentrationEffect).toBeFalsy();
    toggle.click(); await control.cast(); expect(store.characterData()!.character!.concentrationEffect).toBe(entry.name);
    fixture.destroy();
  });

  it.each([0, 1])('skips concentration prompts and preserves the existing tracker when tracking is off for level %s', async level => {
    const entry = spell(level), value = sheet();
    entry.entity!.duration = [{ concentration: true }];
    value.character!.concentrationEffect = 'Entangle';
    const { fixture, control, store } = setup(entry, value);
    fixture.nativeElement.querySelector('button[aria-label="Track concentration after casting"]').click();
    expect(control.trackConcentration()).toBe(false);
    await control.cast();
    expect(TestBed.inject(AppDialogService).current()).toBeNull();
    expect(store.characterData()!.character!.concentrationEffect).toBe('Entangle');
    expect(store.characterData()!.character!.spellSlots!['Wizard'][0].used).toBe(level === 0 ? 1 : 2);
    fixture.destroy();
  });

  it.each(['spent', 'character', 'closed'])('does not spend a resource after confirmation when its state changed: %s', async change => {
    const entry = spell(), value = sheet(); value.character!.concentrationEffect = 'Entangle';
    entry.entity!.duration = [{ concentration: true }];
    const { fixture, control, store } = setup(entry, value), dialogs = TestBed.inject(AppDialogService);
    const casting = control.cast();
    if (change === 'spent') value.character!.spellSlots!['Wizard'][0].used = 2;
    if (change === 'character') store.setCharacter(sheet());
    if (change === 'closed') fixture.destroy();
    const before = structuredClone(store.characterData());
    dialogs.finish(true); await casting;
    expect(store.characterData()).toEqual(before);
    if (change !== 'closed') fixture.destroy();
  });

  it('highlights the unchanged higher-level dice text only when using a higher-level slot', () => {
    const entry = spell(), value = sheet(); value.spells = [entry];
    entry.entity!.entriesHigherLevel = [{ type: 'entries', entries: ['Deals {@damage 10d6} damage at this level.'] }];
    entry.uses = [{ totalFreeUses: 1 }];
    TestBed.inject(CharacterStore).setCharacter(value);
    const fixture = TestBed.createComponent(SpellsPageComponent);
    fixture.componentRef.setInput('characterData', value); fixture.detectChanges();
    fixture.componentInstance.toggleExpanded(fixture.componentInstance.spellExpansionId(entry)); fixture.detectChanges();
    const control = fixture.debugElement.query(By.directive(SpellCastControlComponent)).componentInstance as SpellCastControlComponent;
    control.setLevel('2'); fixture.detectChanges();
    const section = fixture.nativeElement.querySelector('[aria-label="Higher-level casting"]') as HTMLElement;
    expect(section.classList.contains('bg-primary-container')).toBe(true);
    expect(section.closest('app-spell-cast-control')).toBeNull();
    expect(section.textContent).toContain('Level 2'); expect(section.textContent).toContain('10d6'); expect(section.textContent).not.toContain('45');
    control.setResource('use:0'); fixture.detectChanges();
    expect(section.classList.contains('bg-primary-container')).toBe(false); expect(control.level()).toBe(1);
    fixture.destroy();
  });

  it('defaults to the spell level, spends one slot, disables at zero remaining, and rejects repeated casts before rerender', () => {
    const { fixture, control, store } = setup();
    expect(control.level()).toBe(1); expect(control.levels()).toEqual([1, 2]);
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
    expect(fixture.nativeElement.textContent).toContain('Choose an applicable cast level'); fixture.destroy();
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
