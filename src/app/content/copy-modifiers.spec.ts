import { inheritCopy } from './content-adapter';
import { applyCopyModifiers } from './copy-modifiers';

describe('Copy transformation preservation', () => {
  it('uses category preservation policies without discarding explicit child overrides', () => {
    const base = { name: 'Base', source: 'TEST', page: 12, environment: ['forest'], legendaryGroup: { name: 'Group' }, hp: { average: 20 } };
    const child = { name: 'Child', source: 'TEST', hp: null, _copy: { _preserve: { environment: true } } };
    const result = inheritCopy(base, child, [], 'monster');
    expect(result['environment']).toEqual(['forest']); expect(result['legendaryGroup']).toBeUndefined();
    expect(result['page']).toBeUndefined(); expect(result['hp']).toBeUndefined();
    expect(inheritCopy({ tier: 'major', lootTables: ['A'], weight: 2 }, { name: 'Child', tier: 'minor', _copy: {} }, [], 'item')).toEqual({ name: 'Child', tier: 'minor', weight: 2 });
  });
  it('replaces body text globally while protecting names, metadata and nested tags by default', () => {
    const value = { action: [{ name: 'Old', entries: ['Old OLD {@spell Old} {@b Old {@spell Old}}'], other: 'Old' }] };
    applyCopyModifiers(value, { action: { mode: 'replaceTxt', replace: 'old', flags: 'i', with: 'New' } });
    expect(value.action[0]).toEqual({ name: 'Old', entries: ['New New {@spell Old} {@b Old {@spell Old}}'], other: 'Old' });
    applyCopyModifiers(value, { action: { mode: 'replaceTxt', replace: 'Old', with: 'New', props: ['name', 'entries'], tagInsensitive: true } });
    expect(value.action[0]).toEqual({ name: 'New', entries: ['New New {@spell New} {@b New {@spell New}}'], other: 'Old' });
  });
  it('applies root operations before wildcard operations and limits wildcard fields', () => {
    const value = { action: ['Old'], entries: ['Old'], actionHeader: ['Old'], variant: [{ entries: ['Old'] }] };
    applyCopyModifiers(value, { '*': { mode: 'replaceTxt', replace: 'Old', with: 'New' }, _: { mode: 'setProp', prop: 'action', value: ['Old Old'] } });
    expect(value).toEqual({ action: ['New New'], entries: ['Old'], actionHeader: ['New'], variant: [{ entries: ['New'] }] });
  });
  it('inherits without modifying the base and applies ordered named entry changes', () => {
    const base = { name: 'Base', source: 'TEST', entries: [{ name: 'Old', entries: ['old'] }] };
    const child = { name: 'Child', source: 'TEST', _copy: { name: 'Base', source: 'TEST', _mod: {
      entries: [{ mode: 'replaceArr', replace: 'Old', items: { name: 'New', entries: ['new'] } },
        { mode: 'appendArr', items: { name: 'Extra', entries: ['extra'] } }],
    } } };
    const result = inheritCopy(base, child);
    expect(result['name']).toBe('Child');
    expect(result['entries']).toEqual([{ name: 'New', entries: ['new'] }, { name: 'Extra', entries: ['extra'] }]);
    expect(base.entries).toEqual([{ name: 'Old', entries: ['old'] }]);
    expect(result['_copy']).toBeUndefined();
  });
  it('rejects missing replacement targets and unsafe field paths', () => {
    expect(() => applyCopyModifiers({ entries: [] }, { entries: { mode: 'replaceArr', replace: 'Absent', items: [] } })).toThrow();
    expect(() => applyCopyModifiers({}, { 'constructor.prototype': { mode: 'setProp', value: true } })).toThrow();
  });
  it('deduplicates appended entries and supports nested field removal', () => {
    const value = { properties: ['A'], inherits: { legacy: true } };
    applyCopyModifiers(value, { properties: { mode: 'appendIfNotExistsArr', items: ['A', 'B', 'B'] }, 'inherits.legacy': 'remove' });
    expect(value.properties).toEqual(['A', 'B']);
    expect(value.inherits).toEqual({});
  });
  it('inserts at the end for upstream index -1 without disturbing existing entries', () => {
    const value = { entries: ['first'] };
    applyCopyModifiers(value, { entries: { mode: 'insertArr', index: -1, items: ['second'] } });
    expect(value.entries).toEqual(['first', 'second']);
  });
  it('replaces spell lists and adds skills while preserving other spellcasting fields', () => {
    const value = {
      cr: '5', int: 16, skill: { history: '+7' },
      spellcasting: [{ name: 'Casting', ability: 'int', spells: { '1': { slots: 4, spells: ['Old', 'Retained'] } } }],
    };
    applyCopyModifiers(value, { _: [
      { mode: 'replaceSpells', spells: { '1': [{ replace: 'Old', with: ['New'] }] } },
      { mode: 'addSkills', skills: { history: 1, arcana: 2 } },
    ] });
    expect(value.spellcasting[0].spells['1']).toEqual({ slots: 4, spells: ['New', 'Retained'] });
    expect(value.skill).toEqual({ history: '+7', arcana: '+9' });
    expect(value.spellcasting[0].ability).toBe('int');
  });
  it('preserves append order for at-will spells but sorts additions to existing level lists', () => {
    const value = { spellcasting: [{ will: ['Z'], spells: { '1': { slots: 2, spells: ['Z'] } } }] };
    applyCopyModifiers(value, { _: { mode: 'addSpells', will: ['A'], spells: { '1': { spells: ['A'] } } } });
    expect(value.spellcasting[0].will).toEqual(['Z', 'A']);
    expect(value.spellcasting[0].spells['1']).toEqual({ slots: 2, spells: ['A', 'Z'] });
  });
  it('applies child modifiers before template modifiers while respecting explicit root fields', () => {
    const result = inheritCopy({ str: 10, action: ['Base'] }, {
      name: 'Child', str: 12, _copy: { _templates: [{ name: 'Template', source: 'TEST' }], _mod: { action: { mode: 'appendArr', items: ['Child'] } } },
    }, [{ name: 'Template', source: 'TEST', apply: { _root: { str: 18, dex: 16 }, _mod: { action: { mode: 'appendArr', items: ['Template'] } } } }]);
    expect(result['str']).toBe(12); expect(result['dex']).toBe(16);
    expect(result['action']).toEqual(['Base', 'Child', 'Template']);
  });
  it('matches replacement entries using regex selectors', () => {
    const value = { action: [{ name: 'Old attack', entries: ['synthetic'] }] };
    applyCopyModifiers(value, { action: { mode: 'replaceArr', replace: { regex: '^Old', flags: 'i' }, items: { name: 'New attack', entries: [] } } });
    expect(value.action).toEqual([{ name: 'New attack', entries: [] }]);
  });
  it('applies a reduced-threat style template to numeric fields and tagged attacks/DCs', () => {
    const value = { size: ['L'], cr: '5', hp: { average: 37, formula: '5d10 + 10' }, save: { dex: '+4' }, action: [{ entries: ['{@hit 6} and {@dc 15}'] }] };
    applyCopyModifiers(value, {
      _: [{ mode: 'maxSize', max: 'M' }, { mode: 'scalarMultXp', scalar: 0.5 }],
      hp: [{ mode: 'scalarMultProp', prop: 'average', scalar: 0.5, floor: true }, { mode: 'prefixSuffixStringProp', prop: 'formula', prefix: '(', suffix: ')/2' }],
      save: { mode: 'scalarAddProp', prop: '*', scalar: -2 },
      action: [{ mode: 'scalarAddHit', scalar: -2 }, { mode: 'scalarAddDc', scalar: -2 }],
    });
    expect(value.size).toEqual(['M']);
    expect(value.cr).toEqual({ cr: '5', xp: 900 });
    expect(value.hp).toEqual({ average: 18, formula: '(5d10 + 10)/2' });
    expect(value.save).toEqual({ dex: '+2' });
    expect(value.action[0].entries).toEqual(['{@hit 4} and {@dc 13}']);
  });
});
