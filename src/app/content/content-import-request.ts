import { ContentSource } from './content.model';

export type ContentImportRequest =
  | { action: 'cancel' }
  | { action: 'import'; namespace: string; source: ContentSource }
  | { action: 'check-homebrew'; namespace: string; source: ContentSource; fileId: string }
  | { action: 'update-homebrew'; namespace: string; source: ContentSource; fileId: string }
  | { action: 'remove-homebrew'; namespace: string; source: ContentSource; fileId: string }
  | { action: 'homebrew'; namespace: string; source: ContentSource; url?: string; file?: File };
