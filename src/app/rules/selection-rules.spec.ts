import { mapContent } from '../content/content-adapter';
import { deriveOptionalFeatures, OptionalFeatureSlot } from './optional-feature-rules';
import { deriveSpecies, SpeciesContribution } from './species-rules';
function fixture() {
  const records = mapContent({ class: [{ name: 'Mage',source: 'TEST' }],optionalfeature: [
    { name: 'Option',source: 'TEST',featureType: ['TEST'] },{ name: 'Restricted',source: 'TEST',featureType: ['TEST'],prerequisite: [{ level: 3 }] },
  ] },'synthetic.json').records;
  const species = (name: string,data: Record<string,unknown>) => ({ key: name,kind: 'species',name,publication: 'TEST',file: 'synthetic',data,links: [] });
  records.push(species('Sky',{ speed: { walk: { number: 30 },fly: { number: 40,condition: 'without armor' } },resist: [{ type: 'cold' }],darkvision: 60 }),
    species('Sea',{ speed: { walk: { number: 25 },swim: { number: 30 } },resist: [{ type: 'fire' }] }));
  return { index: { sourceIdentity: 'source',revisionId: 'revision',records: new Map(records.map(r => [r.key,r])) },records };
}
describe('Optional feature selections', () => {
  it('validates slots, coalesces shared grants and preserves manual customization', () => {
    const f = fixture(); const owner = f.records.find(r => r.kind === 'class')!; const option = f.records.find(r => r.name === 'Option')!;
    const slot: OptionalFeatureSlot = { id: 'slot',selectionId: 'selection',ownerKey: owner.key,count: 1,featureTypes: ['TEST'],selectedKeys: [option.key] };
    const first = deriveOptionalFeatures([slot,{ ...slot,id: 'other' }],f.index);
    expect(first.canAccept).toBe(true); expect(first.instances).toHaveLength(1); expect(first.instances[0].grants).toHaveLength(2);
    first.instances[0].manual = true; first.instances[0].customization = { notes: ['Keep'],used: 2 };
    const removed = deriveOptionalFeatures([],f.index,first.instances);
    expect(removed.instances[0].customization).toEqual(first.instances[0].customization); expect(removed.instances[0].grants).toEqual([]);
    expect(deriveOptionalFeatures([{ ...slot,selectedKeys: [] }],f.index,first.instances).canAccept).toBe(false);
    expect(deriveOptionalFeatures([slot],{ ...f.index,revisionId: 'new' },first.instances).canAccept).toBe(false);
  });
  it('does not assume prerequisites or feature types are satisfied', () => {
    const f = fixture(); const slot = { id: 'slot',selectionId: 'selection',ownerKey: f.records.find(r => r.kind === 'class')!.key,count: 1,
      featureTypes: ['TEST'],selectedKeys: [f.records.find(r => r.name === 'Restricted')!.key] };
    expect(deriveOptionalFeatures([slot],f.index).canAccept).toBe(false);
    expect(deriveOptionalFeatures([{ ...slot,featureTypes: ['OTHER'] }],f.index).canAccept).toBe(false);
  });
});
describe('Species contribution previews', () => {
  it('W06: changes only generated contributions while retaining manual movement/resistance and conditions', () => {
    const f = fixture(); const manual: SpeciesContribution[] = [{ field: 'speed',value: { mode: 'fly',number: 80 },origin: 'manual' },{ field: 'resist',value: 'acid',origin: 'manual' }];
    const sky = deriveSpecies({ id: 'species',key: 'Sky' },f.index,manual);
    expect(sky.canAccept).toBe(true); expect(sky.generated.some(c => c.field === 'sense')).toBe(true);
    expect(sky.generated.some(c => c.field === 'speed' && (c.value as Record<string,unknown>)['condition'] === 'without armor')).toBe(true);
    sky.instance!.customization = { notes: ['Keep'] };
    expect(deriveSpecies({ id: 'species',key: 'Sky' },f.index,manual,sky.instance).instance).toEqual(sky.instance);
    const sea = deriveSpecies({ id: 'species',key: 'Sea' },f.index,manual,sky.instance);
    expect(sea.manual).toEqual(manual); expect(sea.removed).toHaveLength(1);
    expect(sea.generated.every(c => c.origin !== sky.instance!.id)).toBe(true);
    sea.manual[0].origin = 'changed'; expect(manual[0].origin).toBe('manual');
  });
  it('blocks missing or updated content and supports explicit removal', () => {
    const f = fixture(); const sky = deriveSpecies({ id: 'species',key: 'Sky' },f.index);
    expect(deriveSpecies({ id: 'species',key: 'missing' },f.index,[],sky.instance).canAccept).toBe(false);
    expect(deriveSpecies({ id: 'species',key: 'Sky' },{ ...f.index,revisionId: 'new' },[],sky.instance).canAccept).toBe(false);
    const removed = deriveSpecies(undefined,f.index,[],sky.instance);
    expect(removed.removed).toHaveLength(1); expect(removed.generated).toEqual([]);
  });
});
