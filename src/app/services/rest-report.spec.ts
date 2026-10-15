import { TestBed } from '@angular/core/testing';
import { ExportedCharacter } from '../models/character.model';
import { CharacterStore } from '../stores/character.store';
import { RestService } from './rest.service';

describe('Rest reports', () => {
  const sheet = () => ({ character: { characterUuid: 'rest-test', currentHp: 3, maxHp: 10, tempHp: 2,
    spellSlots: { Wizard: [{ level: 1, total: 2, used: 2, regainCondition: 'LONG_REST' }] } },
    monsters: [{ name: 'Companion', uses: [{ tag: 'Summon', totalFreeUses: 3, usedFreeUses: 2,
      freeUsesRegainCondition: 'SHORT_REST_ONE' }] }],
    features: [{ name: 'Manual', uses: [{ totalFreeUses: 1, usedFreeUses: 1, freeUsesRegainCondition: 'MANUAL' }] }],
  }) as ExportedCharacter;

  it('reports only changed resources and one-use recovery on short rests', () => {
    const service = TestBed.inject(RestService);
    const character = sheet();
    service.performShortRest(character);
    expect(service.report()?.changes).toEqual(['Companion (Summon) uses: 1 restored']);
    expect(character.character?.currentHp).toBe(3);
    service.performLongRest(character);
    expect(service.report()?.changes).toEqual(['HP: 7 restored', 'Temporary HP: 2 cleared',
      'Wizard, level 1 slots: 2 restored', 'Companion (Summon) uses: 1 restored']);
    service.performLongRest(character);
    expect(service.report()?.changes).toEqual([]);
  });

  it('reports actual changes from a native rest adapter', () => {
    const store = TestBed.inject(CharacterStore);
    store.nativeCharacterId.set('rest-test');
    store.nativeRest = character => ({ ...character, character: { ...character.character, currentHp: 8 } });
    const service = TestBed.inject(RestService);
    service.performShortRest(sheet());
    expect(service.report()?.changes).toEqual(['HP: 5 restored']);
  });
});
