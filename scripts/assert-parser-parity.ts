/**
 * Parser parity assertion — fails the build if the two README parsers drift.
 *
 * The site renders from src/lib/tools.ts (Astro, build-time) while the client
 * fallback and scripts/generate-og-images.js use js/parser.js. If slug or
 * category logic diverges, tool pages 404 and OG images mismatch silently.
 *
 * Run with Bun (needs TS import): bun scripts/assert-parser-parity.ts
 * Exit codes: 0 — parity, 1 — drift detected
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { getAllTools } from '../src/lib/tools';
// @ts-expect-error — plain JS module, no type declarations
import { parseMarkdown } from '../js/parser.js';

const ROOT = process.cwd();
const md = readFileSync(join(ROOT, 'README.md'), 'utf-8');

const tsTools = getAllTools().map(t => ({ slug: t.slug, category: t.category }));
const jsTools = (parseMarkdown(md) as any[]).map(t => ({ slug: t.slug, category: t.category }));

const mismatches: string[] = [];

if (tsTools.length !== jsTools.length) {
    mismatches.push(`count: tools.ts=${tsTools.length} parser.js=${jsTools.length}`);
}

const jsBySlug = new Map(jsTools.map(t => [t.slug, t]));
for (const t of tsTools) {
    const j = jsBySlug.get(t.slug);
    if (!j) {
        mismatches.push(`slug missing in parser.js: ${t.slug}`);
    } else if (j.category !== t.category) {
        mismatches.push(`category mismatch for ${t.slug}: "${t.category}" vs "${j.category}"`);
    }
}

if (mismatches.length > 0) {
    console.error('Parser drift detected between src/lib/tools.ts and js/parser.js:');
    for (const m of mismatches.slice(0, 20)) console.error(`  - ${m}`);
    if (mismatches.length > 20) console.error(`  … and ${mismatches.length - 20} more`);
    process.exit(1);
}

console.log(`Parser parity OK (${tsTools.length} tools, slugs + categories match).`);
