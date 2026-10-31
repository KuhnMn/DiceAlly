import type { ContentRecord } from './content.model';
import { isReprinted } from './content-visibility';

const record = (data: ContentRecord['data']): ContentRecord => ({ key: 'test', kind: 'class', name: 'Test', publication: 'TEST', file: 'test.json', data, links: [] });

describe('Reprint metadata visibility', () => {
  it('recognizes explicit flags in both ordinary payloads and canonical reference definitions', () => {
    expect(isReprinted(record({ isReprinted: true }))).toBe(true);
    expect(isReprinted(record({ reprinted: true }))).toBe(true);
    const vehicle = { ...record({}), kind: 'vehicle', referenceDefinition: { version: 1, kind: 'vehicle', name: 'Old vehicle', source: 'TEST', isReprinted: true } } as ContentRecord;
    expect(isReprinted(vehicle)).toBe(true);
  });
  it('recognizes string and structured reprintedAs targets, including canonical reference payloads', () => {
    expect(isReprinted(record({ reprintedAs: ['Druid|XPHB'] }))).toBe(true);
    expect(isReprinted(record({ reprintedAs: [{ uid: 'Stars|Druid|XPHB|XPHB', edition: 'one' }] }))).toBe(true);
    const vehicle = { ...record({}), kind: 'vehicle', referenceDefinition: { version: 1, kind: 'vehicle', name: 'Old vehicle', source: 'TEST',
      reprintedAs: [{ uid: 'Vehicle|XDMG', tag: 'vehicle' }] } } as ContentRecord;
    expect(isReprinted(vehicle)).toBe(true);
  });
  it('does not infer reprints from edition, false flags, truthy strings/numbers or empty/malformed targets', () => {
    for (const data of [{}, { isReprinted: false }, { isReprinted: 'true' }, { reprinted: 1 }, { legacy: true },
      { reprintedAs: [] }, { reprintedAs: ['  '] }, { reprintedAs: 'Druid|XPHB' }, { reprintedAs: [{ uid: 1 }, null, {}] }]) {
      expect(isReprinted(record(data))).toBe(false);
    }
  });
});
