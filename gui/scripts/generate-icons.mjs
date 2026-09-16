// 生成 MindMarket 风格图标:#8ed462 绿底圆角方块 + 白色 "CB" 字母。
// 手写 PNG 编码(zlib + CRC32),无需任何 npm 依赖。
// 用法: node scripts/generate-icons.mjs   （在 gui/ 下运行）
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "src-tauri", "icons");

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  typeBuf.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 8 + data.length);
  return out;
}

function pngEncode(size, rgba) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// 5x7 点阵字母
const GLYPHS = {
  C: [
    ".XXX.",
    "X...X",
    "X....",
    "X....",
    "X....",
    "X...X",
    ".XXX.",
  ],
  B: [
    "XXXX.",
    "X...X",
    "X...X",
    "XXXX.",
    "X...X",
    "X...X",
    "XXXX.",
  ],
};

const GREEN = { r: 0x8e, g: 0xd4, b: 0x62 };
const WHITE = { r: 0xff, g: 0xff, b: 0xff };

// 绿底圆角方块(全幅不透明,圆角由系统图标遮罩裁切),中央白色 "CB"。
function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const unit = size / 16;
  const letters = ["C", "B"];
  const glyphW = 5;
  const gap = 1.5;
  const totalW = letters.length * glyphW + (letters.length - 1) * gap; // 11.5 units
  const originX = (size - totalW * unit) / 2;
  const originY = (size - 7 * unit) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let color = GREEN;
      for (let li = 0; li < letters.length; li++) {
        const glyph = GLYPHS[letters[li]];
        const gx = Math.floor((x - originX) / unit - li * (glyphW + gap));
        const gy = Math.floor((y - originY) / unit);
        if (
          gx >= 0 &&
          gx < glyphW &&
          gy >= 0 &&
          gy < 7 &&
          glyph[gy][gx] === "X"
        ) {
          color = WHITE;
          break;
        }
      }
      const offset = (y * size + x) * 4;
      rgba[offset] = color.r;
      rgba[offset + 1] = color.g;
      rgba[offset + 2] = color.b;
      rgba[offset + 3] = 0xff;
    }
  }
  return rgba;
}

const SIZES = [16, 32, 64, 128, 256, 512, 1024];
mkdirSync(iconsDir, { recursive: true });
const pngs = new Map();
for (const size of SIZES) pngs.set(size, pngEncode(size, render(size)));

// 默认引用名
writeFileSync(join(iconsDir, "icon.png"), pngs.get(512));
writeFileSync(join(iconsDir, "32x32.png"), pngs.get(32));
writeFileSync(join(iconsDir, "128x128.png"), pngs.get(128));
writeFileSync(join(iconsDir, "128x128@2x.png"), pngs.get(256));

// iconset → icns（macOS iconutil）
const iconsetDir = join(iconsDir, "icon.iconset");
rmSync(iconsetDir, { recursive: true, force: true });
mkdirSync(iconsetDir, { recursive: true });
const entries = [
  ["icon_16x16.png", 16],
  ["icon_16x16@2x.png", 32],
  ["icon_32x32.png", 32],
  ["icon_32x32@2x.png", 64],
  ["icon_128x128.png", 128],
  ["icon_128x128@2x.png", 256],
  ["icon_256x256.png", 256],
  ["icon_256x256@2x.png", 512],
  ["icon_512x512.png", 512],
  ["icon_512x512@2x.png", 1024],
];
for (const [name, size] of entries) writeFileSync(join(iconsetDir, name), pngs.get(size));
execFileSync("iconutil", ["-c", "icns", iconsetDir, "-o", join(iconsDir, "icon.icns")], {
  stdio: "inherit",
});
rmSync(iconsetDir, { recursive: true, force: true });
console.log("icons generated:", iconsDir);
