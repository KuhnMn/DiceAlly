/** FNV-1a 128 over UTF-8; deterministic fingerprints, not cryptographic authentication. */
export function stableHash128(text: string): string {
  let hash = 0x6c62272e07bb014262b821756295c58dn;
  for (const byte of new TextEncoder().encode(text)) {
    hash = BigInt.asUintN(128, (hash ^ BigInt(byte)) * 0x1000000000000000000013bn);
  }
  return hash.toString(16).padStart(32, '0');
}
