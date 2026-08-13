import { describe, expect, it } from 'vitest';
import { urlBase64ToUint8Array } from './vapid-key';

describe('urlBase64ToUint8Array', () => {
  it('decodes a base64url string with no padding needed', () => {
    expect(urlBase64ToUint8Array('TWFu')).toEqual(new Uint8Array([77, 97, 110]));
  });

  it('pads a base64url string missing trailing "="', () => {
    expect(urlBase64ToUint8Array('TQ')).toEqual(new Uint8Array([77]));
  });

  it('maps "-" and "_" back to standard base64 "+" and "/" before decoding', () => {
    // Standard-base64 "+/8=" (bytes [0xfb, 0xff]) becomes base64url "-_8" with
    // padding stripped — round-tripping it must recover the same bytes.
    expect(urlBase64ToUint8Array('-_8')).toEqual(new Uint8Array([0xfb, 0xff]));
  });

  it('decodes a real VAPID public key to a 65-byte uncompressed EC point', () => {
    const decoded = urlBase64ToUint8Array(
      'BELMiDS5U2BdkFHnuX4pz358gbt135ksX_ycvU1caxZMkIi23hP17QR5z5Euxi8UJ2tVPiFgcywCHu_yBiwsxs8',
    );

    expect(decoded).toHaveLength(65);
    expect(decoded[0]).toBe(0x04);
  });
});
