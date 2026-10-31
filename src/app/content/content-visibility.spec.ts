import type { ContentRecord } from './content.model';
import { isReprinted } from './content-visibility';

const record = (data: ContentRecord['data']): ContentRecord => ({ key: 'test', kind: 'class', name: 'Test', publication: 'TEST', file: 'test.json', data, links: [] });

describe('Explicit reprint visibility', () => {
  it('recognizes explicit flags in both ordinary payloads and canonical reference definitions', () => {
    expect(isReprinted(record({ isReprinted: true }))).toBe(true);
    expect(isReprinted(record({ reprinted: true }))).toBe(true);
    const vehicle = { ...record({}), kind: 'vehicle', referenceDefinition: { version: 1, kind: 'vehicle', name: 'Old vehicle', source: 'TEST', isReprinted: true } } as ContentRecord;
    expect(isReprinted(vehicle)).toBe(true);
  });
  it('does not infer reprints from edition, links, false flags or truthy strings/numbers', () => {
    for (const data of [{}, { isReprinted: false }, { isReprinted: 'true' }, { reprinted: 1 }, { legacy: true }, { reprintedAs: ['Test|XPHB'] }]) {
      expect(isReprinted(record(data))).toBe(false);
    }
  });
});
