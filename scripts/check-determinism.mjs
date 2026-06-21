#!/usr/bin/env node
// Enforces game determinism + loop ownership:
//  - games must use ctx.rng() (seedable), never Math.random()
//  - games must never drive their own animation frame; the SDK host owns the loop
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const gamesDir = fileURLToPath(new URL('../packages/games', import.meta.url));

const rules = [
  { re: /Math\.random\s*\(/, msg: 'Math.random() is forbidden in games — use ctx.rng().' },
  {
    re: /requestAnimationFrame\s*\(/,
    msg: 'requestAnimationFrame() is forbidden in games — the SDK host owns the loop.',
  },
  {
    re: /cancelAnimationFrame\s*\(/,
    msg: 'cancelAnimationFrame() is forbidden in games — the SDK host owns the loop.',
  },
];

function walk(dir) {
  let files = [];
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) files = files.concat(walk(full));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.ts$/.test(entry)) files.push(full);
  }
  return files;
}

// Blank out comments (preserving newlines for accurate line numbers) so that
// mentioning a forbidden API in a doc comment is not flagged.
function blankComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '');
}

const violations = [];
for (const file of walk(gamesDir)) {
  const lines = blankComments(readFileSync(file, 'utf8')).split('\n');
  lines.forEach((line, i) => {
    for (const rule of rules) {
      if (rule.re.test(line)) {
        violations.push(`${file}:${i + 1}  ${rule.msg}\n    ${line.trim()}`);
      }
    }
  });
}

if (violations.length > 0) {
  console.error('✗ Determinism check failed:\n');
  console.error(violations.join('\n\n'));
  console.error(`\n${violations.length} violation(s) found.`);
  process.exit(1);
}
console.log('✓ Determinism check passed (no Math.random / raf in games).');
