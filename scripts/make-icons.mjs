/**
 * Generates the PWA icons.
 *
 * Deliberately dependency-free: a minimal PNG encoder plus 4x supersampling
 * for anti-aliasing, so the project keeps one less dependency in the build.
 *
 *   node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

const BG = [17, 17, 17];
const FG = [250, 250, 250];

// A barbell, on a 32 unit grid, scaled to the icon.
const PLATES = [
  [4, 12, 7, 20],
  [7.5, 8.5, 11.5, 23.5],
  [12, 14.4, 20, 17.6],
  [20.5, 8.5, 24.5, 23.5],
  [25, 12, 28, 20],
];

function insideRoundedRect(x, y, r) {
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function insideRect(x, y, r) {
  return x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
}

function renderPixel(x, y) {
  if (!insideRoundedRect(x, y, 0.22)) return [0, 0, 0, 0];
  for (const plate of PLATES) {
    if (insideRect(x, y, plate)) return [...FG, 255];
  }
  return [...BG, 255];
}

function renderIcon(size) {
  const SS = 4; // supersampling factor
  const data = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          const [pr, pg, pb, pa] = renderPixel(x, y);
          r += pr * pa;
          g += pg * pa;
          b += pb * pa;
          a += pa;
        }
      }

      const samples = SS * SS;
      const alpha = a / samples;
      const offset = (py * size + px) * 4;

      if (alpha > 0) {
        data[offset] = Math.round(r / a);
        data[offset + 1] = Math.round(g / a);
        data[offset + 2] = Math.round(b / a);
        data[offset + 3] = Math.round(alpha);
      }
    }
  }

  return data;
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(size, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0; // filter type: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const png = encodePng(size, renderIcon(size));
  const file = path.join(OUT_DIR, `icon-${size}.png`);
  writeFileSync(file, png);
  console.log(`wrote ${file} (${png.length} bytes)`);
}
