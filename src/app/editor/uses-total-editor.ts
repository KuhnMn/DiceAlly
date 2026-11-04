import { usesTotalFromSelection, type UsesTotal } from '../models/uses-total';

/** Remember variants while editing, without storing inactive values in the document. */
export class UsesTotalEditor {
  private readonly drafts = new WeakMap<object, Map<string, UsesTotal>>();

  select(tracker: { total: UsesTotal }, kind: string): void {
    let variants = this.drafts.get(tracker);
    if (!variants) this.drafts.set(tracker, variants = new Map());
    variants.set(tracker.total.kind, tracker.total);
    tracker.total = variants.get(kind) ?? usesTotalFromSelection(kind, tracker.total);
  }
}
