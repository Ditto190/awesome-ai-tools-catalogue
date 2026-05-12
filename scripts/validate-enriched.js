/**
 * validate-enriched.js
 *
 * Cross-references data/slugs.json against public/data/enriched-tools.json
 * and reports which tool pages are missing enriched data.
 *
 * Usage:
 *   bun run scripts/validate-enriched.js
 *   node scripts/validate-enriched.js
 *
 * Exit codes:
 *   0  — all tools have enriched data
 *   1  — one or more tools are missing enriched data
 */

import { getEnrichmentStatus } from './report-enrichment-status.js';

const status = getEnrichmentStatus();
const missing = status.missing;
const presentCount = status.enriched;
const total = status.total;

// ── Report ────────────────────────────────────────────────────────────────────
console.log(`\n✅ Enriched:  ${presentCount} / ${total} tools`);
console.log(`❌ Missing:   ${missing.length} / ${total} tools\n`);

if (missing.length > 0) {
  console.log('Tools missing enriched data:');
  console.log('─'.repeat(72));
  const colW = [30, 28, 14];
  console.log(
    'Slug'.padEnd(colW[0]) +
    'Tool Name'.padEnd(colW[1]) +
    'Company'
  );
  console.log('─'.repeat(72));
  for (const t of missing) {
    console.log(
      t.slug.padEnd(colW[0]) +
      (t.name ?? '').padEnd(colW[1]) +
      (t.company ?? '')
    );
  }
  console.log('─'.repeat(72));
  console.log(`\n💡 Tip: enriched-tools.json uses the slug as the primary key.`);
  console.log(`   Check that each missing tool has a matching "slug" field in`);
  console.log(`   public/data/enriched-tools.json.\n`);
  process.exit(1);
} else {
  console.log('🎉 All tool pages have enriched data.\n');
  process.exit(0);
}
