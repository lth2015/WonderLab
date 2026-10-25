// 送一条鱼 (docs/gift-protocol.md): a fish travels inside its link.
//
//   https://want.world/#gift=v1.<base64url payload>
//
// The payload is everything needed to bring the fish to life again and
// nothing more: its stroke (shape relative to its first point, in units of
// the sender's short screen edge, with timing), the variety it became, its
// seed, its stroke's readings, and an optional one-character seal. No world,
// no position, no growth, no sender identity beyond what the seal says.
//
// The data sits after `#`, which browsers do not send to servers; the app
// reads it, removes it from the address bar, and never passes it to any
// network request (docs/gift-protocol.md §3).
//
// A CRC-32 catches a link damaged in transit. It is not a signature: anyone
// can edit a gift and recompute it, so a decoded gift is untrusted input and
// every field is range-checked like a saved world.

import { FAMILIES, VARIETIES, type Family } from '../engine/koi-style';

export const GIFT_KEY = 'gift';
export const GIFT_VERSION = 'v1';
/** Longest link payload accepted, characters. Real strokes are far shorter (docs/gift-protocol.md §2.3). */
export const MAX_PAYLOAD = 1200;
/** Most points kept from a stroke. */
export const MAX_POINTS = 48;
/** Coordinates are stored in 1/1024ths of the sender's short screen edge. */
const UNIT = 1024;
/** Times are stored in 8 ms steps. */
const TICK = 8;

const POINTERS = ['mouse', 'touch', 'pen', 'keyboard'] as const;
const FAMILY_LIST = Object.keys(FAMILIES) as Family[];

export interface GiftFish {
  /** The stroke from its first point: [dx, dy, t], dx/dy in short screen edges (y up), t in ms. */
  stroke: [number, number, number][];
  variety: string;
  seed: number;
  /** Short screen edges per second. */
  speed: number;
  curviness: number;
  family: Family;
  pointer: string;
  /** Optional one-character seal, the sender's 落款. */
  seal?: string;
}

// ---------------------------------------------------------------- bytes

class Writer {
  private bytes: number[] = [];
  u8(v: number): void {
    this.bytes.push(v & 0xff);
  }
  u16(v: number): void {
    this.u8(v >> 8);
    this.u8(v);
  }
  /** Unsigned LEB128. */
  uvar(v: number): void {
    let n = Math.max(0, Math.round(v));
    while (n >= 0x80) {
      this.u8((n & 0x7f) | 0x80);
      n = Math.floor(n / 128);
    }
    this.u8(n);
  }
  /** Signed, zigzag then LEB128. */
  svar(v: number): void {
    const n = Math.round(v);
    this.uvar(n >= 0 ? n * 2 : -n * 2 - 1);
  }
  bytesOut(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

class Reader {
  private i = 0;
  constructor(private readonly b: Uint8Array) {}
  get done(): boolean {
    return this.i >= this.b.length;
  }
  u8(): number {
    if (this.i >= this.b.length) throw new Error('short');
    return this.b[this.i++];
  }
  u16(): number {
    return (this.u8() << 8) | this.u8();
  }
  uvar(): number {
    let n = 0;
    let mul = 1;
    for (let k = 0; k < 5; k++) {
      const byte = this.u8();
      n += (byte & 0x7f) * mul;
      if (!(byte & 0x80)) return n;
      mul *= 128;
    }
    throw new Error('varint');
  }
  svar(): number {
    const n = this.uvar();
    return n % 2 ? -(n + 1) / 2 : n / 2;
  }
  take(n: number): Uint8Array {
    if (this.i + n > this.b.length) throw new Error('short');
    const out = this.b.slice(this.i, this.i + n);
    this.i += n;
    return out;
  }
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (const x of b) c = CRC_TABLE[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function toBase64Url(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('alphabet');
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

// ---------------------------------------------------------------- gift

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** One character at most: the first grapheme the user typed, if it is a letter or an ideograph. */
export function cleanSeal(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const ch = [...input.trim()][0];
  return ch && /^[\p{L}\p{N}]$/u.test(ch) ? ch : undefined;
}

/** Thin a stroke to at most MAX_POINTS, keeping its ends. */
function thin(stroke: [number, number, number][]): [number, number, number][] {
  if (stroke.length <= MAX_POINTS) return stroke;
  return Array.from({ length: MAX_POINTS }, (_, i) => stroke[Math.round((i * (stroke.length - 1)) / (MAX_POINTS - 1))]);
}

export function encodeGift(g: GiftFish): string {
  const w = new Writer();
  const seal = cleanSeal(g.seal);
  const pointer = Math.max(0, POINTERS.indexOf(g.pointer as (typeof POINTERS)[number]));
  const family = Math.max(0, FAMILY_LIST.indexOf(g.family));
  // Flags: bit 0 seal present; bits 1–2 pointer; bits 3–4 family.
  w.u8((seal ? 1 : 0) | (pointer << 1) | (family << 3));
  const variety = VARIETIES.indexOf(g.variety);
  w.u8(variety < 0 ? 255 : variety);
  w.u16(Math.round(clamp(g.seed, 0, 99.99) * 655));
  w.uvar(clamp(g.speed, 0, 60) * 1000);
  w.uvar(clamp(g.curviness, 0, 4) * 100);
  const pts = thin(g.stroke);
  w.u8(pts.length);
  let [px, py, pt] = [0, 0, 0];
  for (const [x, y, t] of pts) {
    const qx = Math.round(x * UNIT);
    const qy = Math.round(y * UNIT);
    const qt = Math.round(t / TICK);
    w.svar(qx - px);
    w.svar(qy - py);
    w.uvar(Math.max(0, qt - pt));
    [px, py, pt] = [qx, qy, Math.max(pt, qt)];
  }
  if (seal) {
    const bytes = new TextEncoder().encode(seal);
    w.u8(bytes.length);
    for (const b of bytes) w.u8(b);
  }
  const body = w.bytesOut();
  const crc = crc32(body);
  const out = new Uint8Array(body.length + 4);
  out.set(body);
  out.set([crc >>> 24, (crc >>> 16) & 0xff, (crc >>> 8) & 0xff, crc & 0xff], body.length);
  return `${GIFT_VERSION}.${toBase64Url(out)}`;
}

export type DecodeResult = { ok: true; gift: GiftFish; id: string } | { ok: false; reason: 'version' | 'too_long' | 'damaged' };

/** Decode an untrusted gift string (`v1.<payload>`). Never throws. */
export function decodeGift(value: string): DecodeResult {
  const dot = value.indexOf('.');
  if (dot < 0 || value.slice(0, dot) !== GIFT_VERSION) return { ok: false, reason: 'version' };
  const payload = value.slice(dot + 1);
  if (payload.length > MAX_PAYLOAD) return { ok: false, reason: 'too_long' };
  try {
    const all = fromBase64Url(payload);
    if (all.length < 12) throw new Error('short');
    const body = all.slice(0, all.length - 4);
    const tail = all.slice(all.length - 4);
    const crc = ((tail[0] << 24) | (tail[1] << 16) | (tail[2] << 8) | tail[3]) >>> 0;
    if (crc !== crc32(body)) throw new Error('crc');
    const r = new Reader(body);
    const flags = r.u8();
    const variety = VARIETIES[r.u8()] ?? VARIETIES[0];
    const seed = r.u16() / 655;
    const speed = clamp(r.uvar() / 1000, 0, 60);
    const curviness = clamp(r.uvar() / 100, 0, 4);
    const n = r.u8();
    if (n < 2 || n > MAX_POINTS) throw new Error('points');
    const stroke: [number, number, number][] = [];
    let [x, y, t] = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      x += r.svar();
      y += r.svar();
      t += r.uvar();
      // A real stroke spans less than two screens and lasts under a minute.
      if (Math.abs(x) > 2 * UNIT || Math.abs(y) > 2 * UNIT || t * TICK > 60000) throw new Error('range');
      stroke.push([x / UNIT, y / UNIT, t * TICK]);
    }
    let seal: string | undefined;
    if (flags & 1) seal = cleanSeal(new TextDecoder('utf-8', { fatal: true }).decode(r.take(r.u8())));
    if (!r.done) throw new Error('trailing');
    const gift: GiftFish = {
      stroke,
      variety,
      seed,
      speed,
      curviness,
      family: FAMILY_LIST[(flags >> 3) & 3],
      pointer: POINTERS[(flags >> 1) & 3],
      ...(seal ? { seal } : {}),
    };
    // The same link always means the same gift: received once, not again.
    return { ok: true, gift, id: crc.toString(36) };
  } catch {
    return { ok: false, reason: 'damaged' };
  }
}

/** The link for a gift: `base` is the page it opens (e.g. https://want.world/), the gift goes after #. */
export function giftLink(base: string, g: GiftFish): string {
  return `${base}#${GIFT_KEY}=${encodeGift(g)}`;
}
