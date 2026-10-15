import { ContentSource } from './content.model';

export type ContentImportRequest =
  | { action: 'cancel' }
  | { action: 'import'; namespace: string; source: ContentSource }
  | { action: 'remove-homebrew'; namespace: string; source: ContentSource; fileId: string }
  | { action: 'homebrew'; namespace: string; source: ContentSource; url?: string; file?: File };
