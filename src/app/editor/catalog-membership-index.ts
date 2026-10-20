/** A render-pass lookup for mutable editor collections. Owners clear it in DoCheck. */
export class CatalogMembershipIndex<T> {
  private entries?: readonly T[];
  private length = -1;
  private keys = new Set<string>();

  clear() { this.entries = undefined; }

  has(entries: readonly T[], keysFor: (entry: T) => string[], key: string): boolean {
    if (this.entries !== entries || this.length !== entries.length) {
      this.keys = new Set(entries.flatMap(keysFor));
      this.entries = entries; this.length = entries.length;
    }
    return this.keys.has(key);
  }
}

export function catalogEntryKeys(entry: { contentReference?: { key: string }; name?: string; source?: string }): string[] {
  return [JSON.stringify(entry.contentReference ? ['key', entry.contentReference.key] : ['name', entry.name, entry.source])];
}
