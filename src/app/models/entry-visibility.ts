/** Presentation only: hidden entries retain all character rules and session state. */
export interface ViewerEntryVisibility {
  hidden?: boolean;
}

export function visibleInViewer<T extends ViewerEntryVisibility>(entry: T | null | undefined): entry is T {
  return !!entry && entry.hidden !== true;
}
