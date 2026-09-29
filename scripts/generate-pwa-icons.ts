import { writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Tao icon PNG cho PWA tu `public/logo.svg`: npx tsx scripts/generate-pwa-icons.ts
 *
 * Vi sao can icon PNG (SVG khong du):
 *  - iOS KHONG ho tro `apple-touch-icon` dang SVG -> thieu PNG thi icon tren man hinh chinh bi trong
 *    (hoac lay anh chup trang), va mot so ban iOS cu khong cho vao che do standalone dung nghia.
 *  - Chrome/Android cung uu tien bam PNG 192x192 + 512x512 khi cai dat.
 *  - iOS KHONG ho tro icon trong suot -> phai DUC NEN (flatten) theo mau nen cua app.
 *
 * Icon sinh ra duoc commit san trong `public/` (chi chay lai script nay khi doi logo).
 * Can `sharp` - hien co san trong node_modules vi Next.js dung no de toi uu anh.
 */

const root = process.cwd();
const LOGO = path.join(root, "public", "logo.svg");

/** Mau nen duc cho icon: trung mau nen app + `background_color` trong manifest */
const BACKGROUND = "#070b16";

/** Icon can sinh: ten file -> kich thuoc (px) */
const TARGETS: Record<string, number> = {
  "apple-touch-icon.png": 180,
  "icon-192.png": 192,
  "icon-512.png": 512,
};

async function main(): Promise<void> {
  let sharp: (typeof import("sharp"))["default"];

  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error("Khong tim thay `sharp`. Chay `npm install` truoc khi sinh icon.");
    process.exitCode = 1;
    return;
  }

  for (const [file, size] of Object.entries(TARGETS)) {
    const output = path.join(root, "public", file);

    /* `density` cao de SVG duoc ve net (vector -> raster) truoc khi thu nho ve dung kich thuoc */
    const buffer = await sharp(LOGO, { density: 600 })
      .resize(size, size)
      .flatten({ background: BACKGROUND })
      .png({ compressionLevel: 9 })
      .toBuffer();

    writeFileSync(output, buffer);
    console.log(`OK  public/${file} (${size}x${size}, ${Math.round(buffer.length / 1024)} KB)`);
  }
}

void main();
