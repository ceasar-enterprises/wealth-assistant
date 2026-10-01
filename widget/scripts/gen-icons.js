/*
 * Wealth Command - icon generator (pure Node, no dependencies).
 *
 * Renders a gold "$" on a dark navy ring into RGBA PNGs at the sizes the app
 * needs, then writes them to src/assets:
 *
 *   icon-16.png   tray (small)
 *   icon-32.png   tray (dpi aware) / taskbar fallback
 *   icon-64.png   hi-res tray
 *   icon-256.png  window / about icon
 *
 * Shapes are drawn geometrically (smooth alpha via Scanline Coverage), so the
 * same code produces a crisp glyph at every size.
 *
 * Usage:  node scripts/gen-icons.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ----------------------------- PNG encoder ---------------------------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  // Scanlines with filter byte 0 (None).
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ----------------------------- drawing ------------------------------ */

// Coverage of a pixel whose centre is at (x, y) against a rectangle
// [x0, x1] x [y0, y1]: 1 = fully inside, 0 = fully outside, smooth edge.
function rectCoverage(px, py, x0, y0, x1, y1) {
  const dx = Math.max(x0 - px, px - x1, 0);
  const dy = Math.max(y0 - py, py - y1, 0);
  const d = Math.hypot(dx, dy);
  return Math.max(0, Math.min(1, 0.5 - d + 0.5));
}

function circleCoverage(px, py, cx, cy, r) {
  const d = Math.hypot(px - cx, py - cy) - r;
  return Math.max(0, Math.min(1, 0.5 - d));
}

function ringCoverage(px, py, cx, cy, rOuter, rInner) {
  const d = Math.hypot(px - cx, py - cy);
  return Math.max(0, Math.min(1, rOuter - d, d - rInner));
}

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/* Gold "$" glyph, drawn geometrically inside a unit-ish box [0,1]. */
function dollarShapes(u, v, box, thickness) {
  // u, v in [0,1] mapped into the box; returns array of [x0,y0,x1,y1].
  const m = (t) => box[0] + box[2] * t;
  const n = (t) => box[1] + box[3] * t;
  const w = box[2];
  const h = box[3];
  const t4 = thickness;
  return [
    [m(0.22) - t4, n(0.14), m(0.78) + t4, n(0.22)], // top bar of S
    [m(0.22) - t4, n(0.80), m(0.78) + t4, n(0.88)], // bottom bar of S
    [m(0.22) - t4, n(0.14), m(0.22), n(0.50)], // upper-left stem
    [m(0.78), n(0.50), m(0.78) + t4, n(0.88)], // lower-right stem
    [m(0.47), n(0.10), m(0.53) + t4, n(0.90)], // vertical spine
    [m(0.22) - t4, n(0.46) - t4, m(0.78) + t4, n(0.54) + t4], // crossbar
  ];
}

const NAVY = [10, 22, 38];
const GOLD = [212, 175, 55];
const GOLD_HI = [240, 199, 94];

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.5 - Math.max(1, size * 0.02);
  const rInner = rOuter - Math.max(1.5, size * 0.07);
  const shrink = 0.25; // glyph occupies ~box inside the ring

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      // background: navy circle + gold ring
      const bodyA = circleCoverage(px, py, cx, cy, rInner);
      const goldRingA = ringCoverage(px, py, cx, cy, rOuter, Math.max(rInner, rOuter - Math.max(1.5, size * 0.06)));
      // glyph coverage
      const box = [size * 0.28, size * 0.245, size * 0.44, size * 0.51];
      const thickness = Math.max(1, size * 0.075);
      let glyphA = 0;
      for (const r of dollarShapes(x / size, y / size, box, thickness)) {
        glyphA = Math.max(glyphA, rectCoverage(px, py, r[0], r[1], r[2], r[3]));
      }
      // composite: glyph gold, ring gold, body navy
      let cr = NAVY[0];
      let cg = NAVY[1];
      let cb = NAVY[2];
      let alpha = bodyA;
      cr = lerp(cr, GOLD[0], Math.min(1, goldRingA));
      cg = lerp(cg, GOLD[1], Math.min(1, goldRingA));
      cb = lerp(cb, GOLD[2], Math.min(1, goldRingA));
      alpha = Math.max(alpha, goldRingA);
      // glyph (slightly brighter gold inside)
      if (glyphA > 0) {
        cr = lerp(cr, GOLD_HI[0], Math.min(1, glyphA));
        cg = lerp(cg, GOLD_HI[1], Math.min(1, glyphA));
        cb = lerp(cb, GOLD_HI[2], Math.min(1, glyphA));
        alpha = Math.max(alpha, glyphA);
      }
      const i = (y * size + x) * 4;
      rgba[i] = clamp255(cr);
      rgba[i + 1] = clamp255(cg);
      rgba[i + 2] = clamp255(cb);
      rgba[i + 3] = clamp255(alpha * 255);
    }
  }
  return encodePng(size, size, rgba);
}

/* ------------------------------- main ------------------------------- */

const OUT_DIR = path.join(__dirname, '..', 'src', 'assets');
fs.mkdirSync(OUT_DIR, { recursive: true });
const targets = [
  [16, 'icon-16.png'],
  [32, 'icon-32.png'],
  [64, 'icon-64.png'],
  [256, 'icon-256.png'],
];
for (const [size, name] of targets) {
  const png = renderIcon(size);
  fs.writeFileSync(path.join(OUT_DIR, name), png);
  console.log(`wrote src/assets/${name} (${size}x${size}, ${png.length} bytes)`);
}