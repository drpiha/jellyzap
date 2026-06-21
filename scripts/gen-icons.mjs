#!/usr/bin/env node
// Rasterizes the brand SVGs into the PNG icons + OG image the site references.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const pub = fileURLToPath(new URL('../apps/web/public', import.meta.url));
const iconSvg = join(pub, 'icons', 'icon.svg');
const ogSvg = join(pub, 'og', 'default.svg');

const jobs = [
  [iconSvg, 192, 192, join(pub, 'icons', 'icon-192.png')],
  [iconSvg, 512, 512, join(pub, 'icons', 'icon-512.png')],
  [iconSvg, 512, 512, join(pub, 'icons', 'maskable-512.png')],
  [ogSvg, 1200, 630, join(pub, 'og', 'default.png')],
];

for (const [src, w, h, out] of jobs) {
  await sharp(src, { density: 384 }).resize(w, h).png().toFile(out);
  console.log('✓', out.replace(pub, 'public'));
}
console.log('Icons generated.');
