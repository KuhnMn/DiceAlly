/** Shared by spell slots and every feature, species and spell use tracker. Values match live JSON. */
export const RECOVERY_OPTIONS = [
  { value: 'SHORT_REST', label: 'Short Rest' },
  { value: 'SHORT_REST_ONE', label: 'Short Rest +1' },
  { value: 'LONG_REST', label: 'Long Rest' },
  { value: 'MANUAL', label: 'Manual Only' },
] as const;
