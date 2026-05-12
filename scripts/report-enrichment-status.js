/**
 * Reports enrichment coverage for the current slug catalog.
 *
 * Usage:
 *   node scripts/report-enrichment-status.js
 *   node scripts/report-enrichment-status.js --markdown
 *   node scripts/report-enrichment-status.js --json
 *
 * Exit codes:
 *   0 — report generated successfully
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

export function getEnrichmentStatus() {
  const slugs = loadJson(join(ROOT, 'data', 'slugs.json'));
  const enriched = loadJson(join(ROOT, 'public', 'data', 'enriched-tools.json'));

  const enrichedMap = new Map(enriched.map((entry) => [entry.slug, entry]));
  const missing = [];
  const present = [];

  for (const tool of slugs) {
    if (enrichedMap.has(tool.slug)) {
      present.push(tool.slug);
    } else {
      missing.push(tool);
    }
  }

  return {
    total: slugs.length,
    enriched: present.length,
    missingCount: missing.length,
    missing,
  };
}

function asText(status) {
  const lines = [
    `Enriched: ${status.enriched} / ${status.total}`,
    `Missing:  ${status.missingCount} / ${status.total}`,
  ];

  if (status.missing.length) {
    lines.push('', 'Missing slugs:');
    for (const tool of status.missing) {
      lines.push(`- ${tool.slug} | ${tool.name} | ${tool.company}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function asMarkdown(status) {
  const lines = [
    '## Enrichment Status',
    '',
    `- Enriched: **${status.enriched} / ${status.total}**`,
    `- Missing: **${status.missingCount} / ${status.total}**`,
  ];

  if (status.missing.length) {
    lines.push(
      '',
      '| Slug | Tool | Company |',
      '|------|------|---------|',
      ...status.missing.map((tool) => `| \`${tool.slug}\` | ${tool.name} | ${tool.company} |`),
      '',
      'This check compares `data/slugs.json` against `public/data/enriched-tools.json` in the repo.'
    );
  } else {
    lines.push('', 'All catalog slugs have matching enriched entries in the repo copy.');
  }

  return `${lines.join('\n')}\n`;
}

if (import.meta.main) {
  const status = getEnrichmentStatus();
  const format = process.argv.includes('--json')
    ? 'json'
    : process.argv.includes('--markdown')
      ? 'markdown'
      : 'text';

  if (format === 'json') {
    console.log(JSON.stringify(status, null, 2));
  } else if (format === 'markdown') {
    console.log(asMarkdown(status));
  } else {
    console.log(asText(status));
  }
}
