import { ExportedCharacter, InventoryItem } from './character.model';

/** Container flags and membership reference stable inventory identities. */
export interface InventoryLayout {
  containerIds: string[];
  parentByItemId: Record<string, string>;
}

export function isContainer(sheet: ExportedCharacter, item: InventoryItem): boolean {
  return !!item.editorId && !!sheet.inventoryLayout?.containerIds.includes(item.editorId);
}

export function containerTargets(sheet: ExportedCharacter, item: InventoryItem): InventoryItem[] {
  const parents = sheet.inventoryLayout?.parentByItemId ?? {};
  return (sheet.inventory ?? []).filter(candidate => {
    if (candidate === item || !isContainer(sheet, candidate)) return false;
    const seen = new Set<string>();
    let id = candidate.editorId;
    while (id) {
      if (id === item.editorId || seen.has(id)) return false;
      seen.add(id); id = parents[id];
    }
    return true;
  });
}

function layoutFor(sheet: ExportedCharacter): InventoryLayout {
  for (const item of sheet.inventory ?? []) item.editorId ||= crypto.randomUUID();
  return sheet.inventoryLayout ??= { containerIds: [], parentByItemId: {} };
}

export function setContainer(sheet: ExportedCharacter, item: InventoryItem, enabled: boolean): void {
  if (!sheet.inventory?.includes(item)) return;
  const layout = layoutFor(sheet);
  const id = item.editorId!;
  if (enabled) {
    if (!layout.containerIds.includes(id)) layout.containerIds.push(id);
  } else {
    const parent = layout.parentByItemId[id];
    for (const [child, container] of Object.entries(layout.parentByItemId)) {
      if (container !== id) continue;
      if (parent && parent !== child) layout.parentByItemId[child] = parent;
      else delete layout.parentByItemId[child];
    }
    layout.containerIds = layout.containerIds.filter(value => value !== id);
  }
}

export function moveInventoryItem(sheet: ExportedCharacter, item: InventoryItem, parentId: string): boolean {
  if (!sheet.inventory?.includes(item)) return false;
  const layout = layoutFor(sheet);
  if (parentId && !containerTargets(sheet, item).some(target => target.editorId === parentId)) return false;
  if (parentId) layout.parentByItemId[item.editorId!] = parentId;
  else delete layout.parentByItemId[item.editorId!];
  return true;
}

export function removeInventoryLayoutItem(sheet: ExportedCharacter, item: InventoryItem): void {
  if (!sheet.inventoryLayout || !item.editorId) return;
  setContainer(sheet, item, false);
  delete sheet.inventoryLayout.parentByItemId[item.editorId];
}

export interface InventoryNode { item: InventoryItem; children: InventoryNode[]; }

/** Filtered ancestors are transparent; projection never changes saved membership. */
export function inventoryTree(sheet: ExportedCharacter, visible: readonly InventoryItem[]): InventoryNode[] {
  const nodes = new Map(visible.map(item => [item, { item, children: [] } as InventoryNode]));
  const byId = new Map((sheet.inventory ?? []).filter(item => item.editorId).map(item => [item.editorId!, item]));
  const parents = sheet.inventoryLayout?.parentByItemId ?? {};
  const roots: InventoryNode[] = [];
  for (const [item, node] of nodes) {
    const seen = new Set<string>(item.editorId ? [item.editorId] : []);
    let parent: string | undefined = item.editorId ? parents[item.editorId] : undefined;
    let destination: InventoryNode | undefined;
    while (parent) {
      if (seen.has(parent)) { destination = undefined; break; }
      seen.add(parent);
      const ancestor = byId.get(parent);
      if (!ancestor || !isContainer(sheet, ancestor)) break;
      destination ??= nodes.get(ancestor);
      parent = parents[parent];
    }
    if (destination) destination.children.push(node);
    else roots.push(node);
  }
  return roots;
}
