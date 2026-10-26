/** Shared labels for editor navigation and wizard handoffs. */
export const EDITOR_PAGES = ['Basic Info', 'Ability Scores', 'Proficiencies & More', 'Feature Sources', 'Species & Features', 'Spells', 'Items', 'Companions', 'Bastions', 'Combat', 'Notes', 'Sheet Settings'] as const;
export type EditorPage = typeof EDITOR_PAGES[number];
