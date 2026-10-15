import { emptyBasicCharacter } from '../editor/basic-info';
import { independentCharacter, parseShareCode } from './character-sharing.service';

describe('Database character sharing', () => {
  it('normalizes complete share codes and rejects old temporary codes', () => {
    expect(parseShareCode('ABCDEF-012345-ABCDEF-012345')).toBe('abcdef012345abcdef012345');
    expect(parseShareCode('123456')).toBeNull();
    expect(parseShareCode('../users/alice')).toBeNull();
  });
  it('imports an independent copy without changing the shared snapshot', () => {
    const sheet = emptyBasicCharacter();
    sheet.notes = [{ id: 1, title: 'Notes', body: 'Keep me' }];
    const first = independentCharacter(sheet), second = independentCharacter(sheet);
    expect(first.character!.characterUuid).not.toBe(sheet.character!.characterUuid);
    expect(second.character!.characterUuid).not.toBe(first.character!.characterUuid);
    first.notes![0].body = 'Changed';
    expect(sheet.notes![0].body).toBe('Keep me');
    expect(second.notes![0].body).toBe('Keep me');
  });
});
