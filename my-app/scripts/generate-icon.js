/**
 * Generates a simple 192×192 amber PNG icon for CaféOS.
 * No external dependencies — uses only Node built-ins (zlib).
 * Run: node scripts/generate-icon.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 256;

// ── helpers ──────────────────────────────────────────────────────────────────
function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
}

function crc32(buf) {
  let crc = 0xffffffff;
  const table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const dataBytes = Buffer.from(data);
  const crcInput = Buffer.concat([typeBytes, dataBytes]);
  return Buffer.concat([u32(dataBytes.length), typeBytes, dataBytes, u32(crc32(crcInput))]);
}

// ── pixel data ───────────────────────────────────────────────────────────────
// Amber gradient: centre coffee-brown cup on amber background
function colorAt(x, y) {
  const cx = SIZE / 2, cy = SIZE / 2;
  const dx = x - cx, dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Outer circle (slightly inset)
  if (dist > SIZE * 0.46) return [245, 158, 11];  // amber-400 background

  // Coffee cup silhouette (simple mug shape)
  const relX = dx / (SIZE * 0.46);
  const relY = dy / (SIZE * 0.46);

  // Handle (right side bump)
  if (relX > 0.35 && relX < 0.58 && relY > -0.1 && relY < 0.35) {
    const hx = relX - 0.46, hy = relY - 0.12;
    const hd = Math.sqrt(hx * hx + hy * hy);
    if (hd < 0.15 && hd > 0.09) return [92, 51, 23];  // handle ring
  }

  // Mug body trapezoid
  const bodyTop = -0.42, bodyBot = 0.38;
  const widthTop = 0.52, widthBot = 0.60;
  if (relY > bodyTop && relY < bodyBot) {
    const progress = (relY - bodyTop) / (bodyBot - bodyTop);
    const halfW = widthTop + (widthBot - widthTop) * progress;
    if (Math.abs(relX) < halfW) {
      // Steam wisps
      if (relY < -0.22) return [215, 215, 215];  // steam color
      // Liquid inside
      if (relY > -0.28) return [92, 51, 23];    // dark coffee brown
    }
  }

  // rim at top
  if (relY > bodyTop - 0.08 && relY < bodyTop + 0.02 && Math.abs(relX) < 0.56)
    return [139, 90, 43];

  return [245, 158, 11]; // amber background
}

// Build raw pixel rows (filter byte 0 = None per row)
const rawRows = Buffer.alloc(SIZE * (1 + SIZE * 3));
let offset = 0;
for (let y = 0; y < SIZE; y++) {
  rawRows[offset++] = 0; // filter type None
  for (let x = 0; x < SIZE; x++) {
    const [r, g, b] = colorAt(x, y);
    rawRows[offset++] = r;
    rawRows[offset++] = g;
    rawRows[offset++] = b;
  }
}

// ── assemble PNG ─────────────────────────────────────────────────────────────
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const ihdrData = Buffer.alloc(13);
ihdrData.writeUInt32BE(SIZE, 0);   // width
ihdrData.writeUInt32BE(SIZE, 4);   // height
ihdrData[8] = 8;  // bit depth
ihdrData[9] = 2;  // color type: RGB
ihdrData[10] = 0; // compression
ihdrData[11] = 0; // filter
ihdrData[12] = 0; // interlace

const compressed = zlib.deflateSync(rawRows, { level: 6 });

const png = Buffer.concat([
  signature,
  chunk('IHDR', ihdrData),
  chunk('IDAT', compressed),
  chunk('IEND', Buffer.alloc(0)),
]);

// ── write output ─────────────────────────────────────────────────────────────
const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon-192.png'), png);
console.log('✅ Generated public/icons/icon-192.png (192×192 amber coffee icon)');

// Also write a 32×32 version for the system tray (needs smaller size)
// Electron tray on Windows prefers 16 or 32px
const SIZE2 = 32;
const rawRows2 = Buffer.alloc(SIZE2 * (1 + SIZE2 * 3));
let off2 = 0;
for (let y = 0; y < SIZE2; y++) {
  rawRows2[off2++] = 0;
  for (let x = 0; x < SIZE2; x++) {
    // sample from the full-size image
    const [r, g, b] = colorAt(Math.floor(x * SIZE / SIZE2), Math.floor(y * SIZE / SIZE2));
    rawRows2[off2++] = r;
    rawRows2[off2++] = g;
    rawRows2[off2++] = b;
  }
}
const ihdr2 = Buffer.alloc(13);
ihdr2.writeUInt32BE(SIZE2, 0);
ihdr2.writeUInt32BE(SIZE2, 4);
ihdr2[8] = 8; ihdr2[9] = 2;
const png32 = Buffer.concat([
  signature,
  chunk('IHDR', ihdr2),
  chunk('IDAT', zlib.deflateSync(rawRows2, { level: 6 })),
  chunk('IEND', Buffer.alloc(0)),
]);
fs.writeFileSync(path.join(outDir, 'icon-32.png'), png32);
console.log('✅ Generated public/icons/icon-32.png  (32×32 for tray)');
