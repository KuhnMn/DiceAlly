import { capitalizeFirst } from './text';

describe('Display sentence casing', () => {
  it('changes only the first letter and preserves acronyms, Unicode and empty text', () => {
    for (const [value, expected] of [['', ''], ['spell DC', 'Spell DC'], ['äther', 'Äther'], ['Already Mixed', 'Already Mixed']]) {
      expect(capitalizeFirst(value)).toBe(expected);
    }
  });
});
