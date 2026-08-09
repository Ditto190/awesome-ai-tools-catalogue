/**
 * Build-time OG image generator.
 *
 * Renders a 1200x630 PNG per tool (public/images/og/<slug>.png) so every
 * tool detail page can set a unique og:image — better social/chat CTR than
 * the shared generic card. Also regenerates only when missing or stale
 * (content hash), so rebuilds stay fast.
 *
 * Usage: node scripts/generate-og-images.js
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import satori from 'satori';
import sharp from 'sharp';

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, 'public', 'images', 'og');
const FONT_DIR = join(ROOT, 'assets', 'fonts');

const fonts = [
    { name: 'Inter', data: readFileSync(join(FONT_DIR, 'Inter-Regular.woff')), weight: 400, style: 'normal' },
    { name: 'Inter', data: readFileSync(join(FONT_DIR, 'Inter-SemiBold.woff')), weight: 600, style: 'normal' },
    { name: 'Inter', data: readFileSync(join(FONT_DIR, 'Inter-Bold.woff')), weight: 700, style: 'normal' },
];

const logoSvg = readFileSync(join(ROOT, 'public', 'images', 'dosa-ai-logo.svg'), 'utf-8');
const logoDataUri = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString('base64')}`;

function truncate(str, max) {
    const s = String(str ?? '').replace(/\s+/g, ' ').trim();
    return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
}

function hash(str) {
    return createHash('sha1').update(str).digest('hex').slice(0, 10);
}

async function renderPng(tool) {
    const name = tool.enriched?.name ?? tool.name;
    const company = tool.enriched?.company ?? tool.company;
    const desc = truncate(tool.enriched?.description ?? tool.notes, 130);

    const tree = {
        type: 'div',
        props: {
            style: {
                width: '1200px', height: '630px', display: 'flex', flexDirection: 'column',
                justifyContent: 'space-between', padding: '72px',
                background: 'linear-gradient(135deg, #050505 0%, #0d0b14 55%, #071114 100%)',
                fontFamily: 'Inter', color: '#fff',
            },
            children: [
                {
                    type: 'div',
                    props: {
                        style: { display: 'flex', flexDirection: 'column', gap: '20px' },
                        children: [
                            {
                                type: 'div',
                                props: {
                                    style: { display: 'flex', alignItems: 'center', gap: '16px' },
                                    children: [
                                        { type: 'img', props: { src: logoDataUri, width: 40, height: 40, style: { borderRadius: '10px' } } },
                                        { type: 'div', props: { style: { fontSize: '22px', fontWeight: 600, color: '#a3a3a3' }, children: 'ai.dosa.dev' } },
                                        {
                                            type: 'div',
                                            props: {
                                                style: {
                                                    marginLeft: 'auto', fontSize: '18px', fontWeight: 600, color: '#c4b5fd',
                                                    border: '1px solid #3b3550', borderRadius: '999px', padding: '6px 18px',
                                                },
                                                children: tool.categoryShort,
                                            },
                                        },
                                    ],
                                },
                            },
                            { type: 'div', props: { style: { fontSize: '64px', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }, children: truncate(name, 40) } },
                            { type: 'div', props: { style: { fontSize: '26px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.08em' }, children: truncate(company, 40) } },
                            { type: 'div', props: { style: { fontSize: '24px', fontWeight: 400, color: '#a3a3a3', lineHeight: 1.5, marginTop: '8px' }, children: desc } },
                        ],
                    },
                },
                {
                    type: 'div',
                    props: {
                        style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
                        children: [
                            { type: 'div', props: { style: { fontSize: '20px', color: '#525252' }, children: 'Curated AI coding tools — pricing, features, verdicts' } },
                            { type: 'div', props: { style: { fontSize: '20px', fontWeight: 600, color: '#67e8f9' }, children: `ai.dosa.dev/tools/${tool.slug}` } },
                        ],
                    },
                },
            ],
        },
    };

    const svg = await satori(tree, { width: 1200, height: 630, fonts });
    return sharp(Buffer.from(svg)).png({ quality: 85 }).toBuffer();
}

async function main() {
    // Load tools via the same README parser the site uses (keeps slugs in sync)
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf-8');
    const { parseMarkdown, getShortCategory } = await import('../js/parser.js');
    let tools = parseMarkdown(readme).map(t => ({ ...t, categoryShort: getShortCategory(t.category) }));

    let enrichedMap = new Map();
    try {
        const enriched = JSON.parse(readFileSync(join(ROOT, 'public', 'data', 'enriched-tools.json'), 'utf-8'));
        enrichedMap = new Map(enriched.map(t => [t.slug, t]));
    } catch { /* enrichment optional */ }

    tools = tools.map(t => ({ ...t, enriched: enrichedMap.get(t.slug) ?? null }));

    mkdirSync(OUT_DIR, { recursive: true });

    let written = 0, skipped = 0;
    for (const tool of tools) {
        const contentKey = hash(JSON.stringify([tool.name, tool.company, tool.notes, tool.enriched?.description, tool.enriched?.name, tool.enriched?.company, tool.categoryShort]));
        const outPath = join(OUT_DIR, `${tool.slug}.png`);
        const hashPath = join(OUT_DIR, `${tool.slug}.hash`);

        if (existsSync(outPath) && existsSync(hashPath) && readFileSync(hashPath, 'utf-8') === contentKey) {
            skipped++;
            continue;
        }

        const png = await renderPng(tool);
        writeFileSync(outPath, png);
        writeFileSync(hashPath, contentKey);
        written++;
    }

    console.log(`OG images: ${written} generated, ${skipped} up-to-date (${tools.length} total)`);
}

main().catch(err => { console.error('OG image generation failed:', err); process.exit(1); });
