import { collectDependencies } from './content-dependencies';
import { ContentRecord } from './content.model';

const row = (key: string, links: ContentRecord['links'] = []): ContentRecord => ({ key, kind: 'feat', name: key, publication: 'TEST', file: 'test', data: {}, links });
function cache(...records: ContentRecord[]) {
  return { get: async (_revision: string, key: string) => records.find(r => r.key === key) };
}
describe('Selected dependency snapshots', () => {
  it('handles cycles, skips unselected catalogues/descriptions and produces detached records', async () => {
    const root = row('root', [
      { role: 'grant', target: 'spell', scope: 'rule', required: true, status: 'resolved' },
      { role: 'choice', target: 'other', scope: 'catalog', required: true, status: 'resolved' },
      { role: 'entry', target: 'missing', scope: 'description', required: false, status: 'missing' },
    ]);
    const spell = row('spell', [{ role: 'back', target: 'root', scope: 'rule' }]);
    const store = cache(root, spell, row('other'));
    const snapshot = await collectDependencies(store, 'revision', ['root', 'root']);
    expect(snapshot.roots).toEqual(['root']); expect(snapshot.records.map(r => r.key)).toEqual(['root', 'spell']);
    snapshot.records[0].data['changed'] = true; expect(root.data['changed']).toBeUndefined();
    const descriptive = await collectDependencies(store, 'revision', ['root'], { includeDescriptions: true });
    expect(descriptive.unresolved).toHaveLength(1);
    const selected = await collectDependencies(store, 'revision', ['root'], { follow: l => l.target !== 'missing' });
    expect(selected.records.map(r => r.key)).toEqual(['root', 'spell', 'other']);
  });
  it('fails on required missing dependencies, missing roots, limits and cancellation', async () => {
    const store = cache(row('root', [{ role: 'grant', target: 'missing', required: true, status: 'missing' }]));
    await expect(collectDependencies(store, 'r', ['root'])).rejects.toThrow('Required character dependency');
    await expect(collectDependencies(store, 'r', ['absent'])).rejects.toThrow('Selected dependency is missing');
    await expect(collectDependencies(cache(row('a', [{ role: 'grant', target: 'b' }]), row('b')), 'r', ['a'], { maxRecords: 1 })).rejects.toThrow('exceeds 1');
    const controller = new AbortController(); controller.abort();
    await expect(collectDependencies(store, 'r', ['root'], { signal: controller.signal })).rejects.toThrow();
  });
});
