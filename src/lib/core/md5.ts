/**
 * MD5 — the hash behind every generated result.
 *
 * Implemented here rather than taken from a dependency, and kept dependency-free on
 * purpose: a hash that decides every generated result should not be able to change
 * under us via a lockfile bump.
 *
 * The contract is exactly three things: UTF-8 input, 32 lowercase hex characters
 * out, and a digest that never moves, because the seed recorded for every stored run
 * is this function's output. `md5.test.ts` pins it with the RFC 1321 vectors plus
 * exact digests over ASCII, multi-byte UTF-8 and lengths on both sides of the
 * 56/64-byte padding boundaries — the RFC vectors alone would not catch an encoding
 * mismatch, which is precisely the bug most likely to slip in.
 *
 * The shift amounts and the `K` table are the ones RFC 1321 prints; `K` is derived
 * below from the RFC's own formula rather than pasted as 64 magic constants, so the
 * table stays auditable.
 */

/** Left-rotate a 32-bit word. Inputs may be signed; the result is unsigned. */
function rotateLeft(word: number, shift: number): number {
	return ((word << shift) | (word >>> (32 - shift))) >>> 0;
}

/** Per-round left-rotation amounts, in the order the RFC specifies them. */
const SHIFTS = new Uint8Array([
	7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9,
	14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10,
	15, 21, 6, 10, 15, 21
]);

/**
 * `K[i] = floor(abs(sin(i + 1)) * 2^32)`, the RFC's own definition. Derived here
 * instead of pasted as 64 magic constants so the table is auditable.
 */
const K = new Int32Array(64);
for (let i = 0; i < 64; i++) {
	K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
}

const ENCODER = new TextEncoder();

/**
 * Hashes a string and returns 32 lowercase hex characters.
 *
 * The input is encoded as UTF-8 rather than as UTF-16 code units, so a name hashes to
 * the same digest everywhere: `md5('逗比寒')` is one fixed value on any platform.
 */
export function md5(input: string): string {
	const message = ENCODER.encode(input);
	const bitLength = message.length * 8;

	// Pad with a single 0x80, then zeros, until the length is congruent to 56
	// modulo 64; the final 8 bytes hold the bit length little-endian.
	const paddedLength = (((message.length + 8) >> 6) + 1) << 6;
	const buffer = new Uint8Array(paddedLength);
	buffer.set(message);
	buffer[message.length] = 0x80;

	const view = new DataView(buffer.buffer);
	// Split rather than `bitLength | 0`: a >512 MiB input must not wrap here.
	view.setUint32(paddedLength - 8, bitLength >>> 0, true);
	view.setUint32(paddedLength - 4, Math.floor(bitLength / 4294967296), true);

	// Initial state, RFC 1321 §3.3.
	let h0 = 0x67452301 | 0;
	let h1 = 0xefcdab89 | 0;
	let h2 = 0x98badcfe | 0;
	let h3 = 0x10325476 | 0;

	const chunk = new Int32Array(16);

	for (let offset = 0; offset < paddedLength; offset += 64) {
		for (let i = 0; i < 16; i++) {
			chunk[i] = view.getInt32(offset + i * 4, true);
		}

		let a = h0;
		let b = h1;
		let c = h2;
		let d = h3;

		for (let i = 0; i < 64; i++) {
			let f: number;
			let g: number;

			if (i < 16) {
				f = (b & c) | (~b & d);
				g = i;
			} else if (i < 32) {
				f = (d & b) | (~d & c);
				g = (5 * i + 1) % 16;
			} else if (i < 48) {
				f = b ^ c ^ d;
				g = (3 * i + 5) % 16;
			} else {
				f = c ^ (b | ~d);
				g = (7 * i) % 16;
			}

			const rotated = rotateLeft((a + f + K[i] + chunk[g]) | 0, SHIFTS[i]);

			a = d;
			d = c;
			c = b;
			b = (b + rotated) | 0;
		}

		h0 = (h0 + a) | 0;
		h1 = (h1 + b) | 0;
		h2 = (h2 + c) | 0;
		h3 = (h3 + d) | 0;
	}

	return [h0, h1, h2, h3].map(toLittleEndianHex).join('');
}

/**
 * The digest is little-endian, so each state word is emitted lowest byte first.
 * `>>> 0` keeps the shifts unsigned; `& 0xff` keeps each byte in range.
 */
function toLittleEndianHex(word: number): string {
	let hex = '';
	for (let i = 0; i < 4; i++) {
		hex += ((word >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
	}
	return hex;
}
