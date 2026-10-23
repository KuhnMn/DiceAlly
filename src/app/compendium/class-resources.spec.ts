import { TestBed } from '@angular/core/testing';
import { mapContent } from '../content/content-adapter';
import { canonicalClassRecord } from '../content/class-adapter';
import { ContentRecord } from '../content/content.model';
import { classCastingNotes, classGrantedSpells, classResourceTables, preparedSpellFormula, resourceCell } from './class-resources';
import { ClassResourcesComponent } from './class-resources.component';

const series = (value: number) => Array.from({ length: 20 }, () => value);
function owner(data: Record<string, unknown> = {}): ContentRecord {
  return canonicalClassRecord(mapContent({ class: [{ name: 'Mage', source: 'PHB', classFeatures: [], ...data }] }, 'class.json').records[0]);
}
function subclass(data: Record<string, unknown> = {}): ContentRecord {
  return canonicalClassRecord(mapContent({ subclass: [{ name: 'School', shortName: 'School', source: 'TCE', className: 'Mage', classSource: 'PHB', subclassFeatures: [], ...data }] }, 'class.json').records[0]);
}

describe('Compendium source progression tables', () => {
  it('formats numeric table cells as dice, signed bonuses and movement instead of raw JSON', () => {
    expect(resourceCell({ type: 'dice', toRoll: [{ number: 1, faces: 8 }] })).toBe('1d8');
    expect(resourceCell({ type: 'bonusSpeed', value: 10 })).toBe('+10 ft.');
    expect(resourceCell({ type: 'bonus', value: -2 })).toBe('-2');
    expect(resourceCell(0)).toBe(0); expect(resourceCell(undefined)).toBe('—');
  });
  it('retains exact slot counts, avoids duplicate cantrip columns and distinguishes spells gained from totals', () => {
    const record = owner({ casterProgression: 'full', cantripProgression: series(3), spellsKnownProgressionFixed: [6, ...series(2).slice(1)],
      classTableGroups: [{ colLabels: ['{@filter Cantrips Known|spells|level=0}'], rows: series(3).map(value => [value]) },
        { title: 'Spell Slots per Spell Level', colLabels: ['1st', '2nd'], rowsSpellProgression: [[2, 0], [3, 0], [4, 2], ...Array.from({ length: 17 }, () => [4, 3])] }] });
    const before = structuredClone(record);
    const tables = classResourceTables(record, null);
    expect(tables).toHaveLength(3);
    expect(tables[1].rows.slice(0, 3)).toEqual([[2, 0], [3, 0], [4, 2]]);
    expect(tables[2].labels).toEqual(['Spells Learned at This Level']);
    expect(tables[2].rows.slice(0, 2)).toEqual([[6], [2]]);
    expect(tables[2].note).toContain('not the total'); expect(record).toEqual(before);
  });

  it('adds only the selected subclass resources and gated class tables, including rich dice cells', () => {
    const dice = { type: 'dice', toRoll: [{ number: 1, faces: 6 }] };
    const record = owner({ classTableGroups: [
      { title: 'Core', colLabels: ['Second Wind'], rows: series(2).map(value => [value]) },
      { title: 'School Only', subclasses: [{ name: 'School', source: 'TCE' }], colLabels: ['Points'], rows: series(4).map(value => [value]) },
      { title: 'Other Edition', subclasses: [{ name: 'School', source: 'XPHB' }], colLabels: ['Points'], rows: series(99).map(value => [value]) },
    ] });
    const selected = subclass({ subclassTableGroups: [{ colLabels: ['Psionic Die'], rows: Array.from({ length: 20 }, () => [dice]) }] });
    expect(classResourceTables(record, null).map(table => table.title)).toEqual(['Core']);
    const tables = classResourceTables(record, selected);
    expect(tables.map(table => table.title)).toEqual(['Core', 'School Only', 'Subclass Resources']);
    expect(tables[2].subclass).toBe(true); expect(tables[2].rows[0][0]).toEqual(dice);
    expect(classResourceTables(record, subclass({ classSource: 'XPHB' })).map(table => table.title)).toEqual(['Core']);
  });

  it('uses subclass cantrip/preparation progressions even when the base class is not a caster', () => {
    const record = owner();
    const selected = subclass({ casterProgression: '1/3', cantripProgression: [0, 0, ...series(2).slice(2)], preparedSpellsProgression: [0, 0, ...series(3).slice(2)] });
    const tables = classResourceTables(record, selected);
    expect(tables).toHaveLength(1); expect(tables[0].owner).toBe('School'); expect(tables[0].subclass).toBe(true);
    expect(tables[0].rows.slice(0, 3)).toEqual([[0, 0], [0, 0], [2, 3]]);
    expect(classResourceTables(record, null)).toEqual([]);
  });

  it('preserves pact slot level and slot count without treating pact slots as full-caster slots', () => {
    const record = owner({ casterProgression: 'pact', classTableGroups: [{ colLabels: ['Spell Slots', 'Slot Level'],
      rows: [[1, '{@filter 1st|spells|level=1}'], [2, '{@filter 1st|spells|level=1}'], ...Array.from({ length: 18 }, () => [2, 2])] }] });
    const tables = classResourceTables(record, null);
    expect(tables).toHaveLength(1); expect(tables[0].rows[0]).toEqual([1, '{@filter 1st|spells|level=1}']);
    expect(classCastingNotes(record, null)).toContainEqual({ owner: 'Mage', label: 'Spellcasting', text: 'Pact Magic' });
  });

  it('retains per-level optional selections, exact-level gains and fixed spells without inventing carry-forward values', () => {
    const record = owner({ spellsKnownProgressionFixedByLevel: { '11': { '6': 1 }, '13': { '7': 1 } }, optionalfeatureProgression: [
      { name: 'Invocations', featureType: ['EI'], progression: series(2) },
      { name: 'Style', featureType: ['FS:F'], progression: { '2': 1, '6': 2 } },
      { name: 'Choice', featureType: ['MM'], progression: { '*': 1 } },
    ] });
    const tables = classResourceTables(record, null);
    expect(tables[0].rows[10]).toEqual([1, '—']); expect(tables[0].rows[11]).toEqual(['—', '—']);
    expect(tables[1].rows[0]).toEqual([2]);
    expect(tables[2].rows.slice(0, 3)).toEqual([['—'], [1], ['—']]);
    expect(classCastingNotes(record, null).some(note => note.text.includes('1 selections when'))).toBe(true);
  });

  it('shows preparation formulas without evaluating a fictional ability modifier', () => {
    expect(preparedSpellFormula('<$level$> / 2 + <$int_mod$>')).toBe('Class Level / 2 + Intelligence Modifier');
    const record = owner({ preparedSpells: '<$level$> + <$wis_mod$>', preparedSpellsChange: 'restLong' });
    expect(classCastingNotes(record, null)).toEqual([
      { owner: 'Mage', label: 'Prepared Spells', text: 'Class Level + Wisdom Modifier' },
      { owner: 'Mage', label: 'Change Prepared Spells', text: 'After a Long Rest' },
    ]);
  });

  it('separates expanded choices from granted spells and preserves class-level versus spell-level requirements', () => {
    const record = owner();
    const selected = subclass({ additionalSpells: [{ name: 'School Spells', known: { '3': ['shield|PHB'] }, expanded: { s2: ['misty step|PHB'] } }] });
    const groups = classGrantedSpells(record, selected);
    expect(groups.map(group => [group.expanded, group.requirement])).toEqual([[false, 'Class Level 3'], [true, 'When Spell Level 2 Is Available']]);
    expect(groups[0].entries).toEqual(['{@spell shield|PHB}']); expect(classGrantedSpells(record, null)).toEqual([]);
  });
});

describe('Class resource presentation', () => {
  it('renders structured resource values, previews a level, and removes a deselected subclass table', () => {
    const record = owner({ classTableGroups: [{ colLabels: ['Uses', 'Die'], rows: Array.from({ length: 20 }, (_, index) => [index, { type: 'dice', toRoll: [{ number: 1, faces: 6 }] }]) }] });
    const fixture = TestBed.createComponent(ClassResourcesComponent);
    fixture.componentRef.setInput('owner', record);
    fixture.componentRef.setInput('subclass', subclass({ subclassTableGroups: [{ title: 'School Points', colLabels: ['Points'], rows: series(3).map(value => [value]) }] }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('1d6');
    fixture.componentInstance.levelChanged('3'); fixture.detectChanges();
    expect(fixture.componentInstance.selectedLevel()).toBe(3);
    expect(fixture.nativeElement.querySelector('tr.preview-level').textContent).toContain('3');
    expect(fixture.componentInstance.cell(fixture.componentInstance.tables()[0], 0, 0)).toBe(0);
    fixture.componentRef.setInput('subclass', null); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('School Points');
    fixture.destroy();
  });
});
