/**
 * Generates PWA PNG icons from the SVG source files.
 * Run with: node scripts/generate-icons.mjs
 *
 * Requires: npm install -D sharp (one-time dev dependency)
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../public');

const SIZES = [96, 192, 384, 512];

async function main() {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error('sharp not installed. Run: npm install -D sharp');
    process.exit(1);
  }

  const svgBuffer = readFileSync(resolve(publicDir, 'icon.svg'));
  const maskableSvgBuffer = readFileSync(resolve(publicDir, 'icon-maskable.svg'));

  for (const size of SIZES) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(resolve(publicDir, `icon-${size}.png`));
    console.log(`Generated icon-${size}.png`);

    if (size === 192 || size === 512) {
      await sharp(maskableSvgBuffer)
        .resize(size, size)
        .png()
        .toFile(resolve(publicDir, `icon-${size}-maskable.png`));
      console.log(`Generated icon-${size}-maskable.png`);
    }
  }

  console.log('All icons generated successfully.');
}

main().catch(console.error);
