/** Display recovery consistently; legacy resources default to a long rest. */
export function regainLabel(condition?: string | null): string {
  switch (condition || 'LONG_REST') {
    case 'LONG_REST': return 'Long Rest';
    case 'SHORT_REST': return 'Short Rest';
    case 'SHORT_REST_ONE': return '1 use per Short Rest';
    case 'MANUAL': return 'Manually';
    default: return condition!.replaceAll('_', ' ');
  }
}
