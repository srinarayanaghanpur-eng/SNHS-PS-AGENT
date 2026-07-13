import { describe, expect, it } from 'vitest';
import { fnv1aBytes, sha256Hex } from './hash';

const enc = (s: string) => new TextEncoder().encode(s);

describe('sha256Hex', () => {
  it('matches FIPS vector for empty input', () => {
    expect(sha256Hex(new Uint8Array(0)))
      .toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
  it('matches FIPS vector for "abc"', () => {
    expect(sha256Hex(enc('abc')))
      .toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('matches FIPS vector for 448-bit message', () => {
    expect(sha256Hex(enc('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')))
      .toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });
  it('handles multi-block binary input deterministically', () => {
    const big = new Uint8Array(200_000).map((_, i) => i % 251);
    expect(sha256Hex(big)).toBe(sha256Hex(big));
    expect(sha256Hex(big)).not.toBe(sha256Hex(big.slice(0, 199_999)));
  });
});

describe('fnv1aBytes', () => {
  it('is stable and length-sensitive', () => {
    expect(fnv1aBytes(enc('hello'))).toBe(fnv1aBytes(enc('hello')));
    expect(fnv1aBytes(enc('hello'))).not.toBe(fnv1aBytes(enc('hello!')));
  });
});
