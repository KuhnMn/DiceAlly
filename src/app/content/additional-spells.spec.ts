import { additionalSpells } from './additional-spells';
import { ContentRecord, JsonObject } from './content.model';

function record(value: JsonObject['value']): ContentRecord {
  return { kind: 'feat', key: 'gift', name: 'Gift', publication: 'TEST', file: 'test.json', links: [], data: { additionalSpells: value } };
}
describe('Shared additional spells contract', () => {
  it('preserves schema branches and paths without implementing new mechanics', () => {
    const source = record([{ ability: { choose: ['int', 'wis'] }, innate: { s1: { limited: { pb: ['Light'] } } },
      known: { _: [{ choose: { from: ['Light', 'Shield'], count: 1 } }] } }]);
    expect(additionalSpells(source)).toEqual(source.data['additionalSpells']);
  });
  it('rejects misplaced choice counts and invented fields', () => {
    expect(() => additionalSpells(record([{ known: { '1': [{ choose: { from: ['Light', 'Shield'] }, count: 1 }] } }]))).toThrow();
    expect(() => additionalSpells(record([{ guessed: ['Light'] }]))).toThrow();
  });
  it('accepts historical absence without accepting malformed grant blocks', () => {
    expect(additionalSpells(record(null))).toBeUndefined();
    expect(additionalSpells(record([]))).toBeUndefined();
    expect(() => additionalSpells(record([{}]))).toThrow();
  });
});
