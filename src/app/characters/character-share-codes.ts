const SHARE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const SHARE_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

export function parseShareCode(input: string): string | null {
  const code = input.trim().replace(/[-\s]/g, '').toUpperCase();
  return SHARE_CODE_PATTERN.test(code) ? code : null;
}

export function formatShareCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

export function generateShareCode(): string {
  // 32 symbols divide 256 evenly, so each character is equally likely.
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), byte => SHARE_CODE_ALPHABET[byte % 32]).join('');
}
