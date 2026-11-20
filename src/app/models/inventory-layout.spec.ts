import { ExportedCharacter } from './character.model';
import { containerTargets, inventoryTree, moveInventoryItem, removeInventoryLayoutItem, setContainer } from './inventory-layout';
import { portableCharacter } from '../characters/portable-character';

function fixture() {
  const inventory = ['Backpack', 'Pouch', 'Coin', 'Rope'].map((name, i) => ({ name, editorId: String(i) }));
  const sheet: ExportedCharacter = { inventory };
  const [bag, pouch, coin, rope] = inventory;
  setContainer(sheet, bag, true); setContainer(sheet, pouch, true);
  moveInventoryItem(sheet, pouch, bag.editorId); moveInventoryItem(sheet, coin, pouch.editorId);
  return { sheet, bag, pouch, coin, rope };
}

describe('Inventory container membership', () => {
  it('stores membership separately and rejects self and descendant targets', () => {
    const { sheet, bag, pouch, coin } = fixture();
    expect(containerTargets(sheet, bag)).toEqual([]);
    expect(moveInventoryItem(sheet, bag, bag.editorId)).toBe(false);
    expect(moveInventoryItem(sheet, bag, pouch.editorId)).toBe(false);
    expect(moveInventoryItem(sheet, coin, 'missing')).toBe(false);
    expect(sheet.inventoryLayout?.parentByItemId).toEqual({ '1': '0', '2': '1' });
    expect(coin).toEqual({ name: 'Coin', editorId: '2' });
    expect(portableCharacter(sheet).inventoryLayout).toEqual(sheet.inventoryLayout);
  });

  it('projects contents through hidden ancestors without modifying membership', () => {
    const { sheet, bag, pouch, coin, rope } = fixture();
    const before = structuredClone(sheet.inventoryLayout);
    const tree = inventoryTree(sheet, [bag, coin, rope]);
    expect(tree.map(node => node.item)).toEqual([bag, rope]);
    expect(tree[0].children.map(node => node.item)).toEqual([coin]);
    expect(inventoryTree(sheet, [coin, rope]).map(node => node.item)).toEqual([coin, rope]);
    expect(inventoryTree(sheet, [bag, pouch, coin])[0].children[0].children[0].item).toBe(coin);
    expect(sheet.inventoryLayout).toEqual(before);
  });

  it('promotes contents when a container is removed or unmarked', () => {
    const { sheet, bag, pouch, coin } = fixture();
    setContainer(sheet, pouch, false);
    expect(sheet.inventoryLayout?.parentByItemId[coin.editorId]).toBe(bag.editorId);
    expect(sheet.inventoryLayout?.parentByItemId[pouch.editorId]).toBe(bag.editorId);
    removeInventoryLayoutItem(sheet, bag);
    sheet.inventory = sheet.inventory!.filter(item => item !== bag);
    expect(sheet.inventoryLayout).toEqual({ containerIds: [], parentByItemId: {} });
    expect(inventoryTree(sheet, sheet.inventory!)).toHaveLength(3);
  });

  it('keeps malformed cyclic or dangling assignments renderable', () => {
    const { sheet } = fixture();
    sheet.inventoryLayout!.parentByItemId['0'] = '1';
    sheet.inventoryLayout!.parentByItemId['3'] = 'missing';
    expect(inventoryTree(sheet, sheet.inventory!)).toHaveLength(4);
  });
});
