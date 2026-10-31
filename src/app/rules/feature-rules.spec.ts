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
  function referencedFixture() {
    const f = fixture(), root = structuredClone(f.find('subclassFeature', 'School Gift'));
    root.data['entries'] = [{ type: 'entries', name: 'Gifts', entries: [
      { type: 'refSubclassFeature', subclassFeature: 'Star Map|Mage|TEST|A|TEST|3' },
      { type: 'refSubclassFeature', subclassFeature: 'Starry Form|Mage|TEST|A|TEST|3' },
      'See {@subclassFeature Other School|Mage|TEST|B|TEST|3} for comparison.',
    ] }];
    const extra = mapContent({ subclassFeature: [
      { name: 'Star Map', source: 'TEST', className: 'Mage', classSource: 'TEST', subclassShortName: 'A', subclassSource: 'TEST', level: 3,
        entries: [{ type: 'refSubclassFeature', subclassFeature: 'Starry Form|Mage|TEST|A|TEST|3' }] },
      { name: 'Starry Form', source: 'TEST', className: 'Mage', classSource: 'TEST', subclassShortName: 'A', subclassSource: 'TEST', level: 3,
        entries: [{ type: 'refSubclassFeature', subclassFeature: 'School Gift|Mage|TEST|A|TEST|3' }] },
    ] }, 'nested-features.json').records;
    const records = new Map(f.index.records); records.set(root.key, root);
    extra.forEach(record => records.set(record.key, record));
    return { ...f, root, extra, index: { ...f.index, records },
      selection: { ...f.selection, subclassKey: f.find('subclass', 'School A').key } };
  }

  it('expands structured feature grants recursively, deduplicates shared/cyclic references and ignores prose links', () => {
    const f = referencedFixture(), before = JSON.stringify([...f.index.records]);
    const result = deriveClassFeatures([f.selection], f.index);
    expect(result.diagnostics).toEqual([]);
    expect(result.instances.filter(instance => instance.snapshot.kind === 'subclassFeature').map(instance => instance.snapshot.name))
      .toEqual(['School Gift', 'Star Map', 'Starry Form']);
    expect(result.instances.every(instance => instance.grants.length === 1)).toBe(true);
    expect(deriveClassFeatures([f.selection], f.index, result.instances).instances).toEqual(result.instances);
    expect(JSON.stringify([...f.index.records])).toBe(before);
  });

  it('gates referenced features by the granting and referenced levels and removes them when the subclass changes', () => {
    const f = referencedFixture();
    const early = f.extra[0]; early.data['level'] = 1;
    // Keep the qualified identity consistent when testing an earlier-level child.
    const earlyRecords = mapContent({ subclassFeature: [early.data] }, early.file).records;
    f.index.records.delete(early.key); f.index.records.set(earlyRecords[0].key, earlyRecords[0]);
    f.root.data['entries'] = [{ type: 'refSubclassFeature', subclassFeature: 'Star Map|Mage|TEST|A|TEST|1' }];
    const beforeLevel = deriveClassFeatures([{ ...f.selection, level: 2 }], f.index);
    expect(beforeLevel.canAccept).toBe(true);
    expect(beforeLevel.instances.some(instance => instance.snapshot.kind === 'subclassFeature')).toBe(false);
    const first = deriveClassFeatures([f.selection], f.index);
    const child = first.instances.find(instance => instance.snapshot.name === 'Star Map')!;
    expect(child.grants[0].level).toBe(3);
    const suppressed = deriveClassFeatures([f.selection], f.index, first.instances, [child.grants[0].id]);
    expect(suppressed.instances.some(instance => instance.snapshot.name === 'Star Map')).toBe(false);
    const switched = deriveClassFeatures([{ ...f.selection, subclassKey: f.find('subclass', 'School B').key }], f.index, first.instances);
    expect(switched.removed.map(instance => instance.snapshot.name)).toEqual(['School Gift', 'Star Map', 'Starry Form']);
    f.root.data['entries'] = [{ type: 'refSubclassFeature', subclassFeature: 'Later|Mage|TEST|A|TEST|5' }];
    const later = mapContent({ subclassFeature: [{ ...f.extra[1].data, name: 'Later', level: 5, entries: [] }] }, 'later.json').records[0];
    f.index.records.set(later.key, later);
    expect(deriveClassFeatures([f.selection], f.index).instances.some(instance => instance.snapshot.name === 'Later')).toBe(false);
    expect(deriveClassFeatures([{ ...f.selection, level: 5 }], f.index).instances.some(instance => instance.snapshot.name === 'Later')).toBe(true);
  });

  it('blocks missing or wrong-subclass granted features without replacing existing character state', () => {
    const f = referencedFixture(), first = deriveClassFeatures([f.selection], f.index);
    f.index.records.delete(f.extra[0].key);
    const missing = deriveClassFeatures([f.selection], f.index, first.instances);
    expect(missing.canAccept).toBe(false); expect(missing.diagnostics[0].message).toContain('Missing qualified feature');
    expect(missing.instances).toEqual(first.instances); expect(missing.removed).toEqual([]);
    f.root.data['entries'] = [{ type: 'refSubclassFeature', subclassFeature: 'School Gift|Mage|TEST|B|TEST|3' }];
    const wrongSubclass = deriveClassFeatures([f.selection], f.index, first.instances);
    expect(wrongSubclass.canAccept).toBe(false);
    expect(wrongSubclass.diagnostics[0].message).toContain('different subclass');
    expect(wrongSubclass.instances).toEqual(first.instances);
  });

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
