import { CatalogMembershipIndex, catalogEntryKeys } from './catalog-membership-index';
import { EditorCombatIndex } from './editor-combat-index';
import { combatLinksForResource } from './combat-actions';
import { emptyBasicCharacter } from './basic-info';

describe('Editor lookup indexes', () => {
  it('builds catalog membership once and supports additions, removals and in-place edits', () => {
    const entries = Array.from({ length: 500 }, (_, i) => ({ name: `Item ${i}`, source: 'TEST' }));
    const index = new CatalogMembershipIndex<typeof entries[number]>();
    let visits = 0;
    const keys = (entry: typeof entries[number]) => { visits++; return catalogEntryKeys(entry); };
    for (const entry of entries) expect(index.has(entries, keys, catalogEntryKeys(entry)[0])).toBe(true);
    expect(visits).toBe(500);
    entries.push({ name: 'New', source: 'TEST' });
    expect(index.has(entries, keys, JSON.stringify(['name', 'New', 'TEST']))).toBe(true);
    entries.pop();
    expect(index.has(entries, keys, JSON.stringify(['name', 'New', 'TEST']))).toBe(false);
    entries[0].name = 'Renamed'; index.clear();
    expect(index.has(entries, keys, JSON.stringify(['name', 'Item 0', 'TEST']))).toBe(false);
    expect(index.has(entries, keys, JSON.stringify(['name', 'Renamed', 'TEST']))).toBe(true);
  });

  it('matches existing Combat link behavior across resource types, legacy links and spell memberships', () => {
    const sheet = emptyBasicCharacter();
    sheet.spells = ['KNOWN', 'PREPARED', 'SPELLBOOK'].map((listType, i) => ({ editorId: `spell-${i}`, name: 'Light', source: 'TEST', castingSourceName: 'Wizard', listType }));
    sheet.spells.push({ editorId: 'bard', name: 'Light', source: 'TEST', castingSourceName: 'Bard' });
    sheet.inventory = [{ editorId: 'item', name: 'Sword', source: 'TEST' }];
    sheet.features = [{ editorId: 'feature', name: 'Gift' }];
    sheet.monsters = [{ editorId: 'monster', name: 'Wolf' }];
    sheet.combatActions = [
      { linkedResourceType: 'SPELL', linkedResource: { editorId: 'spell-1', name: 'Light' } },
      { linkedResourceType: 'ITEM', linkedResource: { name: 'Sword', source: 'TEST' } },
      { linkedResourceType: 'CLASS_FEATURE', linkedResource: { editorId: 'feature', name: 'Gift' } },
      { linkedResourceType: 'MONSTER', linkedResource: { editorId: 'monster', name: 'Wolf' } },
      { linkedResourceType: 'SPELL', linkedResource: { editorId: 'missing', name: 'Light' } },
    ];
    const index = new EditorCombatIndex();
    const resources = [...sheet.spells, ...sheet.inventory, ...sheet.features, ...sheet.monsters];
    for (const resource of resources) expect(index.count(sheet, resource)).toBe(combatLinksForResource(sheet, resource).length);
    sheet.combatActions.splice(0, 1); index.clear();
    for (const resource of resources) expect(index.count(sheet, resource)).toBe(combatLinksForResource(sheet, resource).length);
  });
});
