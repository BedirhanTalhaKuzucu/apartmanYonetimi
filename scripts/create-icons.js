import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(width, height, drawFn) {
  // RGBA buffer
  const rawData = Buffer.alloc(height * (width * 4 + 1));
  
  for (let y = 0; y < height; y++) {
    const lineOffset = y * (width * 4 + 1);
    rawData[lineOffset] = 0; // Filter type 0 (None)
    
    for (let x = 0; x < width; x++) {
      const pixelOffset = lineOffset + 1 + x * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0; // Compression method
  ihdr[11] = 0; // Filter method
  ihdr[12] = 0; // Interlace method

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', deflated);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Icon Drawer: Elegant Royal Blue Gradient with a white building and windows
function drawIcon(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;

  // Background gradient: from #2563eb (37, 99, 235) to #1d4ed8 (29, 78, 216)
  let r = Math.round(37 + (29 - 37) * ny);
  let g = Math.round(99 + (78 - 99) * ny);
  let b = Math.round(235 + (216 - 235) * ny);
  let a = 255;

  // Rounded rectangle corner mask for iOS style
  const radius = 0.22;
  const cornerX = Math.min(nx, 1 - nx);
  const cornerY = Math.min(ny, 1 - ny);
  if (cornerX < radius && cornerY < radius) {
    const dx = radius - cornerX;
    const dy = radius - cornerY;
    if (dx * dx + dy * dy > radius * radius) {
      // Corner anti-aliasing / transparency
      const dist = Math.sqrt(dx * dx + dy * dy) - radius;
      if (dist > 0.01) return [0, 0, 0, 0];
      a = Math.max(0, Math.min(255, Math.round(255 * (1 - dist / 0.01))));
    }
  }

  // Draw Building Silhouette
  // Main building: center 0.28 to 0.72, height 0.22 to 0.78
  const inMainBuilding = nx >= 0.28 && nx <= 0.72 && ny >= 0.22 && ny <= 0.78;
  // Side low wing: 0.18 to 0.28, 0.42 to 0.78
  const inLeftWing = nx >= 0.18 && nx < 0.28 && ny >= 0.42 && ny <= 0.78;
  // Right low wing: 0.72 to 0.82, 0.42 to 0.78
  const inRightWing = nx > 0.72 && nx <= 0.82 && ny >= 0.42 && ny <= 0.78;

  if (inMainBuilding || inLeftWing || inRightWing) {
    // White building body
    let br = 255, bg = 255, bb = 255;

    // Entrance door: 0.44 to 0.56, 0.65 to 0.78
    if (nx >= 0.44 && nx <= 0.56 && ny >= 0.64 && ny <= 0.78) {
      return [37, 99, 235, 255]; // Blue door
    }

    // Main building windows: 3 rows, 2 columns
    const windowCols = [
      [0.34, 0.44],
      [0.56, 0.66],
    ];
    const windowRows = [
      [0.28, 0.36],
      [0.40, 0.48],
      [0.52, 0.60],
    ];

    for (const [x1, x2] of windowCols) {
      for (const [y1, y2] of windowRows) {
        if (nx >= x1 && nx <= x2 && ny >= y1 && ny <= y2) {
          return [37, 99, 235, 255]; // Blue window
        }
      }
    }

    // Side wing windows
    if (
      (nx >= 0.20 && nx <= 0.26 && ny >= 0.50 && ny <= 0.68) ||
      (nx >= 0.74 && nx <= 0.80 && ny >= 0.50 && ny <= 0.68)
    ) {
      return [37, 99, 235, 255];
    }

    return [br, bg, bb, a];
  }

  // Subtle highlight circle behind building
  const cdx = nx - 0.5;
  const cdy = ny - 0.45;
  if (cdx * cdx + cdy * cdy < 0.25) {
    r = Math.min(255, r + 15);
    g = Math.min(255, g + 15);
    b = Math.min(255, b + 15);
  }

  return [r, g, b, a];
}

// Generate icons
const iconDir = path.resolve('public', 'icons');
if (!fs.existsSync(iconDir)) fs.mkdirSync(iconDir, { recursive: true });

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

for (const { name, size } of sizes) {
  const pngBuf = createPNG(size, size, drawIcon);
  fs.writeFileSync(path.join(iconDir, name), pngBuf);
  console.log(`Created public/icons/${name} (${size}x${size})`);
}

// Also write apple-touch-icon.png directly in public/
fs.writeFileSync(path.resolve('public', 'apple-touch-icon.png'), createPNG(180, 180, drawIcon));
console.log('Created public/apple-touch-icon.png');
