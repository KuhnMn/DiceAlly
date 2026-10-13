import { arithmetic, resolveCopyVariables } from './copy-variables';
import { inheritCopy } from './content-adapter';

describe('Copy template variables and provenance', () => {
  it('resolves named creature text, DC, attack and damage without evaluating JavaScript', () => {
    const actor = { name: 'Synthetic Person', isNamedCreature: true, cr: '5', str: 16, wis: 14, size: ['L'] };
    expect(resolveCopyVariables('<$short_name$>|<$spell_dc__wis$>|<$to_hit__str$>|<$damage_avg__2.5*size_mult+str$>|<$damage_mod__str$>', actor))
      .toBe('Synthetic|13|+6|8| + 3');
    expect(() => arithmetic('globalThis.location=1')).toThrow();
    expect(arithmetic('(2+3)*4/2')).toBe(10);
    expect(() => arithmetic('1/0')).toThrow();
  });
  it('does not inherit publication metadata unless preserved and honors explicit null deletion', () => {
    const base = { name: 'Base', source: 'TEST', page: 9, srd: true, speed: { walk: 30 } };
    const result = inheritCopy(base, { name: 'Child', source: 'OTHER', speed: null, _copy: { name: 'Base', source: 'TEST', _preserve: { page: true } } });
    expect(result['page']).toBe(9);
    expect(result['srd']).toBeUndefined();
    expect(result['speed']).toBeUndefined();
    expect(base.speed).toEqual({ walk: 30 });
  });
  it('combines child and template modifiers in order without changing reusable templates', () => {
    const template = { name: 'T', source: 'TEST', apply: { _root: { size: ['S'] }, _mod: { trait: { mode: 'appendArr', items: { name: 'Template' } } } } };
    const result = inheritCopy({ trait: [{ name: 'Base' }] }, { name: 'Child', source: 'TEST', _copy: {
      _templates: [{ name: 'T', source: 'TEST' }], _mod: { trait: { mode: 'appendArr', items: { name: 'Child' } } },
    } }, [template]);
    expect(result['trait']).toEqual([{ name: 'Base' }, { name: 'Child' }, { name: 'Template' }]);
    expect(template.apply._mod.trait.items).toEqual({ name: 'Template' });
  });
});
