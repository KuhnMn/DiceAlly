import { mapContent } from '../content/content-adapter';
import { ContentRecord } from '../content/content.model';
import { ContentClassSelection, ContentRulesIndex, deriveClassFeatures } from './feature-rules';

function fixture() {
  const records = mapContent({
    class: [{ name: 'Mage', source: 'TEST', hd: { number: 1, faces: 6 }, casterProgression: 'full', classFeatures: ['Gift|Mage|TEST|1', 'Gift|Mage|TEST|3', 'Later|Mage|TEST|5'] },
      { name: 'Fighter', source: 'TEST', hd: { number: 1, faces: 10 }, classFeatures: ['Gift|Fighter|TEST|1'] }],
    subclass: [{ name: 'School A', shortName: 'A', source: 'TEST', className: 'Mage', classSource: 'TEST', subclassFeatures: ['School Gift|Mage|TEST|A|TEST|3'] },
      { name: 'School B', shortName: 'B', source: 'TEST', className: 'Mage', classSource: 'TEST', subclassFeatures: ['School Gift|Mage|TEST|B|TEST|3'] }],
    classFeature: [{ name: 'Gift', source: 'TEST', className: 'Mage', classSource: 'TEST', level: 1 },
      { name: 'Gift', source: 'TEST', className: 'Mage', classSource: 'TEST', level: 3 },
      { name: 'Later', source: 'TEST', className: 'Mage', classSource: 'TEST', level: 5 },
      { name: 'Gift', source: 'TEST', className: 'Fighter', classSource: 'TEST', level: 1 }],
    subclassFeature: ['A','B'].map(short => ({ name: 'School Gift', source: 'TEST', className: 'Mage', classSource: 'TEST', subclassShortName: short, subclassSource: 'TEST', level: 3 })),
  }, 'synthetic.json').records;
  const find = (kind: string, name: string): ContentRecord => records.find(r => r.kind === kind && r.name === name)!;
  const index: ContentRulesIndex = { sourceIdentity: 'test-source', revisionId: 'revision-one', records: new Map(records.map(r => [r.key,r])) };
  const selection: ContentClassSelection = { selectionId: 'mage-selection', level: 3, classKey: find('class','Mage').key };
  return { records, find, index, selection };
}
describe('Content-bound feature previews', () => {
  it('B04/W01: selects by level and qualified identity, never name alone', () => {
    const f = fixture();
    const result = deriveClassFeatures([f.selection, { selectionId: 'fighter-selection', classKey: f.find('class','Fighter').key, level: 1 }], f.index);
    expect(result.canAccept).toBe(true); expect(result.instances).toHaveLength(3);
    expect(new Set(result.instances.map(i => i.contentKey)).size).toBe(3);
    expect(result.classInputs.map(c => c.caster)).toEqual(['full','none']);
  });
  it('B05: repeats preserve IDs, snapshots and customization without mutating input', () => {
    const f = fixture(); const first = deriveClassFeatures([f.selection], f.index);
    first.instances[0].id = 'assigned-uuid'; first.instances[0].customization = { notes: ['Keep'], used: 2 };
    const before = structuredClone(first.instances);
    const repeated = deriveClassFeatures([f.selection],f.index,first.instances);
    expect(repeated.instances).toEqual(first.instances); expect(repeated.removed).toEqual([]);
    repeated.instances[0].customization['used'] = 3; expect(first.instances).toEqual(before);
  });
  it('W02: previews level decreases and subclass replacements while retaining manual additions', () => {
    const f = fixture(); f.selection.subclassKey = f.find('subclass','School A').key;
    const first = deriveClassFeatures([f.selection],f.index);
    first.instances[0].manual = true;
    const replacement = deriveClassFeatures([{ ...f.selection, subclassKey: f.find('subclass','School B').key }],f.index,first.instances);
    expect(replacement.removed).toHaveLength(1); expect(replacement.instances).toHaveLength(3);
    const decreased = deriveClassFeatures([{ ...f.selection, level: 1 }],f.index,first.instances);
    expect(decreased.instances).toHaveLength(1); expect(decreased.removed).toHaveLength(2);
    const changedClass = deriveClassFeatures([{ selectionId: 'fighter', level: 1, classKey: f.find('class','Fighter').key }], f.index,first.instances);
    expect(changedClass.instances.filter(i => i.manual)).toHaveLength(1);
    expect(changedClass.instances.find(i => i.manual)?.grants).toEqual([]);
  });
  it('W05: suppressed grants stay suppressed and manually retained instances survive', () => {
    const f = fixture(); const first = deriveClassFeatures([f.selection],f.index); const suppressed = [first.instances[0].grants[0].id];
    expect(deriveClassFeatures([f.selection],f.index,first.instances,suppressed).instances).toHaveLength(1);
    first.instances[0].manual = true;
    const manual = deriveClassFeatures([f.selection],f.index,first.instances,suppressed);
    expect(manual.instances).toHaveLength(2); expect(manual.instances[0].grants).toEqual([]);
  });
  it('blocks missing content and invalid subclass ancestry without deleting previous instances', () => {
    const f = fixture(); const first = deriveClassFeatures([f.selection],f.index);
    const records = new Map(f.index.records); records.delete(first.instances[0].contentKey);
    const missing = deriveClassFeatures([f.selection],{ ...f.index,records },first.instances);
    expect(missing.canAccept).toBe(false); expect(missing.instances).toEqual(first.instances); expect(missing.removed).toEqual([]);
    const invalid = deriveClassFeatures([{ selectionId: 'fighter', level: 3, classKey: f.find('class','Fighter').key, subclassKey: f.find('subclass','School A').key }],f.index);
    expect(invalid.canAccept).toBe(false);
  });
  it('requires explicit updates and rejects unknown casting handlers', () => {
    const f = fixture(); const first = deriveClassFeatures([f.selection],f.index);
    expect(deriveClassFeatures([f.selection],{ ...f.index,revisionId: 'new-revision' },first.instances).canAccept).toBe(false);
    const unknown = structuredClone(f.find('class','Mage')); unknown.data['casterProgression'] = 'future';
    const records = new Map(f.index.records); records.set(unknown.key,unknown);
    expect(deriveClassFeatures([f.selection],{ ...f.index,records }).canAccept).toBe(false);
  });
  it('retains features owned by another source and deduplicates repeated catalogue references', () => {
    const f = fixture(); const first = deriveClassFeatures([f.selection],f.index);
    const foreign = structuredClone(first.instances[0]); foreign.id = 'foreign'; foreign.sourceIdentity = 'other-source';
    const parent = structuredClone(f.find('class','Mage'));
    parent.data['classFeatures'] = ['Gift|Mage|TEST|1','Gift|Mage|TEST|1'];
    const records = new Map(f.index.records); records.set(parent.key,parent);
    const result = deriveClassFeatures([f.selection],{ ...f.index,records },[foreign]);
    expect(result.canAccept).toBe(true); expect(result.instances).toHaveLength(2);
    expect(result.instances.find(i => i.id === 'foreign')).toEqual(foreign);
    expect(result.instances.find(i => i.sourceIdentity === f.index.sourceIdentity)?.grants).toHaveLength(1);
  });
});
