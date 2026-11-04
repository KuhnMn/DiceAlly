import type { SourceResource } from './source-resources';

export const RESOURCE_MODE_LABELS: Record<SourceResource['mode'], string> = {
  counter: 'Resource',
  both: 'Resource with Reminder',
  note: 'Reminder',
};
