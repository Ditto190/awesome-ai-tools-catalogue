/**
 * generate-blog-images.js
 *
 * Renders a unique glassmorphism featured image for every blog article.
 * Style contract (see global rules): glassmorphism only; accent colors are
 * electric green / purple / blue / golden yellow; no humans; no text;
 * geometric + abstract shapes only; unique composition per article.
 *
 * Each image is procedurally generated from a seed derived from the article
 * slug, so output is reproducible but guaranteed distinct per post.
 *
 * Usage:
 *   node scripts/generate-blog-images.js          # generate missing images
 *   node scripts/generate-blog-images.js --force  # regenerate all
 *
 * Output: public/images/blog/<slug>.png (1600x686, matching the 21:9 card)
 */

import { readdirSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

const WIDTH = 1600;
const HEIGHT = 686;
const CONTENT_DIR = join(process.cwd(), 'src', 'content', 'blog');
const OUT_DIR = join(process.cwd(), 'public', 'images', 'blog');
const FORCE = process.argv.includes('--force');

// Accent families — electric green, purple, blue, golden yellow
const PALETTES = [
    ['#00ff88', '#34d399', '#059669'], // electric green
    ['#a78bfa', '#8b5cf6', '#c4b5fd'], // purple
    ['#22d3ee', '#3b82f6', '#60a5fa'], // blue
    ['#f0d08f', '#fbbf24', '#f59e0b'], // golden yellow
];

// ---------- seeded PRNG ----------

function hashSlug(slug) {
    let h = 2166136261;
    for (let i = 0; i < slug.length; i++) {
        h ^= slug.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function mulberry32(seed) {
    return () => {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
const range = (rand, min, max) => min + rand() * (max - min);
const int = (rand, min, max) => Math.floor(range(rand, min, max + 1));

// ---------- SVG building blocks ----------

function defs(colors) {
    const [primary, secondary] = colors;
    return `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b0d12"/>
      <stop offset="1" stop-color="#101420"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="lift" cx="0.5" cy="0.42" r="0.75">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="70"/></filter>
    <filter id="softer" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="110"/></filter>
    <filter id="frost" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16"/>
      <feComponentTransfer>
        <feFuncR type="linear" slope="1.3" intercept="0.04"/>
        <feFuncG type="linear" slope="1.3" intercept="0.04"/>
        <feFuncB type="linear" slope="1.3" intercept="0.04"/>
      </feComponentTransfer>
    </filter>`;
}

// Saturated color blobs rendered into a group with id="bgfx" so glass
// panels can re-use it (clipped + frosted) for a true glassmorphism look.
function blobField(rand, colors) {
    const [primary, secondary] = colors;
    let out = '';
    const blobs = int(rand, 4, 6);
    for (let i = 0; i < blobs; i++) {
        const r = range(rand, 170, 400);
        const cx = range(rand, -r * 0.2, WIDTH + r * 0.2);
        const cy = range(rand, -r * 0.2, HEIGHT + r * 0.2);
        const color = rand() > 0.45 ? pick(rand, primary) : pick(rand, secondary);
        const filter = rand() > 0.4 ? 'soft' : 'softer';
        out += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" filter="url(#${filter})" opacity="${range(rand, 0.45, 0.7).toFixed(2)}"/>`;
    }
    return out;
}

function dotGrid(rand, color) {
    const gap = pick(rand, [42, 54, 66]);
    const r = range(rand, 1.2, 2.2).toFixed(1);
    const opacity = range(rand, 0.06, 0.14).toFixed(2);
    let dots = '';
    for (let x = gap / 2; x < WIDTH; x += gap) {
        for (let y = gap / 2; y < HEIGHT; y += gap) {
            dots += `<circle cx="${x}" cy="${y}" r="${r}"/>`;
        }
    }
    return `<g fill="${color}" opacity="${opacity}">${dots}</g>`;
}

let clipCounter = 0;

function glassPanel(x, y, w, h, rot, rand) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = range(rand, 18, 34).toFixed(1);
    const id = `pclip${clipCounter++}`;
    // Frosted glass: re-render the blob field clipped to the panel, blurred
    // and brightened, then a white wash + stroke + top sheen on top.
    return `
    <clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/></clipPath>
    <g transform="rotate(${rot.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})">
      <g clip-path="url(#${id})"><use href="#bgfx" xlink:href="#bgfx" filter="url(#frost)"/></g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="#ffffff" fill-opacity="0.09" stroke="#ffffff" stroke-opacity="0.28" stroke-width="1.5"/>
      <rect x="${(x + 1.5).toFixed(1)}" y="${(y + 1.5).toFixed(1)}" width="${(w - 3).toFixed(1)}" height="${(h * 0.45).toFixed(1)}" rx="${rx}" fill="url(#sheen)"/>
    </g>`;
}

function glassDisc(cx, cy, r, rand) {
    const id = `pclip${clipCounter++}`;
    return `
    <clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
    <g clip-path="url(#${id})"><use href="#bgfx" xlink:href="#bgfx" filter="url(#frost)"/></g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" fill-opacity="0.09" stroke="#ffffff" stroke-opacity="0.3" stroke-width="1.5"/>`;
}

function ringSet(rand, color, cx, cy, baseR) {
    const count = int(rand, 3, 6);
    let out = '';
    for (let i = 0; i < count; i++) {
        const r = baseR + i * range(rand, 26, 52);
        if (r > WIDTH * 0.75) break;
        out += `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="none" stroke="${color}" stroke-opacity="${range(rand, 0.12, 0.35).toFixed(2)}" stroke-width="${range(rand, 1, 2.4).toFixed(1)}" stroke-dasharray="${rand() > 0.6 ? `${int(rand, 4, 14)} ${int(rand, 6, 18)}` : 'none'}"/>`;
    }
    return out;
}

function waveBand(rand, color) {
    const y0 = range(rand, HEIGHT * 0.2, HEIGHT * 0.6);
    const amp = range(rand, 40, 130);
    const freq = range(rand, 1.2, 2.4);
    let d = `M -50 ${y0.toFixed(1)}`;
    for (let x = 0; x <= WIDTH + 100; x += 40) {
        const y = y0 + Math.sin((x / WIDTH) * Math.PI * 2 * freq) * amp;
        d += ` L ${x} ${y.toFixed(1)}`;
    }
    return `<path d="${d}" fill="none" stroke="${color}" stroke-opacity="${range(rand, 0.25, 0.5).toFixed(2)}" stroke-width="${range(rand, 1.5, 3).toFixed(1)}"/>`;
}

function hexPath(cx, cy, r) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
    }
    return `M ${pts.join(' L ')} Z`;
}

function hexField(rand, color) {
    const r = pick(rand, [46, 60, 74]);
    const dx = r * 1.74;
    const dy = r * 1.5;
    let out = '';
    let row = 0;
    for (let y = -r; y < HEIGHT + r; y += dy, row++) {
        for (let x = -r + (row % 2 ? dx / 2 : 0); x < WIDTH + r; x += dx) {
            if (rand() > 0.72) continue;
            out += `<path d="${hexPath(x, y, r)}" fill="none" stroke="${color}" stroke-opacity="${range(rand, 0.05, 0.16).toFixed(2)}" stroke-width="1.2"/>`;
        }
    }
    return out;
}

// ---------- composition templates ----------

function tmplPanels(rand, colors) {
    const [primary, secondary] = colors;
    let out = dotGrid(rand, primary[1]);
    const n = int(rand, 3, 5);
    for (let i = 0; i < n; i++) {
        const w = range(rand, 260, 560);
        const h = range(rand, 200, 460);
        out += glassPanel(range(rand, -40, WIDTH - w + 40), range(rand, -30, HEIGHT - h + 30), w, h, range(rand, -14, 14), rand);
    }
    out += ringSet(rand, secondary[0], range(rand, WIDTH * 0.55, WIDTH * 0.95), range(rand, HEIGHT * 0.2, HEIGHT * 0.8), range(rand, 60, 110));
    return out;
}

function tmplRings(rand, colors) {
    const [primary, secondary] = colors;
    const cx = range(rand, WIDTH * 0.3, WIDTH * 0.7);
    const cy = range(rand, HEIGHT * 0.3, HEIGHT * 0.7);
    let out = ringSet(rand, primary[0], cx, cy, range(rand, 50, 100));
    out += ringSet(rand, secondary[1], cx + range(rand, -160, 160), cy + range(rand, -100, 100), range(rand, 30, 70));
    out += glassDisc(cx, cy, range(rand, 90, 150).toFixed(1), rand);
    out += glassPanel(range(rand, WIDTH * 0.55, WIDTH * 0.8), range(rand, HEIGHT * 0.1, HEIGHT * 0.4), range(rand, 220, 340), range(rand, 180, 300), range(rand, -10, 10), rand);
    return out;
}

function tmplWaves(rand, colors) {
    const [primary, secondary] = colors;
    let out = '';
    const n = int(rand, 4, 7);
    for (let i = 0; i < n; i++) {
        out += waveBand(rand, i % 2 ? primary[0] : secondary[0]);
    }
    const w = range(rand, WIDTH * 0.55, WIDTH * 0.8);
    out += glassPanel((WIDTH - w) / 2 + range(rand, -80, 80), range(rand, HEIGHT * 0.3, HEIGHT * 0.45), w, range(rand, 130, 200), range(rand, -4, 4), rand);
    return out;
}

function tmplGrid(rand, colors) {
    const [primary, secondary] = colors;
    let out = dotGrid(rand, primary[0]);
    out += glassPanel(range(rand, 60, WIDTH * 0.35), range(rand, HEIGHT * 0.15, HEIGHT * 0.4), range(rand, 380, 620), range(rand, 260, 380), range(rand, -8, 8), rand);
    out += glassPanel(range(rand, WIDTH * 0.5, WIDTH * 0.7), range(rand, HEIGHT * 0.25, HEIGHT * 0.5), range(rand, 260, 420), range(rand, 200, 320), range(rand, -8, 8), rand);
    const n = int(rand, 3, 6);
    for (let i = 0; i < n; i++) {
        const r = range(rand, 10, 34);
        out += `<circle cx="${range(rand, 0, WIDTH).toFixed(1)}" cy="${range(rand, 0, HEIGHT).toFixed(1)}" r="${r.toFixed(1)}" fill="${i % 2 ? primary[0] : secondary[0]}" fill-opacity="${range(rand, 0.5, 0.9).toFixed(2)}"/>`;
    }
    return out;
}

function tmplOrbits(rand, colors) {
    const [primary, secondary] = colors;
    const cx = range(rand, WIDTH * 0.35, WIDTH * 0.65);
    const cy = HEIGHT / 2 + range(rand, -60, 60);
    let out = ringSet(rand, primary[1], cx, cy, range(rand, 80, 130));
    out += glassDisc(cx, cy, range(rand, 55, 85).toFixed(1), rand);
    const sats = int(rand, 4, 7);
    for (let i = 0; i < sats; i++) {
        const angle = rand() * Math.PI * 2;
        const dist = range(rand, 150, 320);
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist * 0.55;
        if (rand() > 0.5) {
            out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${range(rand, 8, 22).toFixed(1)}" fill="${i % 2 ? primary[0] : secondary[0]}" fill-opacity="0.85"/>`;
        } else {
            const s = range(rand, 26, 60);
            out += glassPanel(x - s / 2, y - s / 2, s, s, range(rand, -20, 20), rand);
        }
    }
    return out;
}

function tmplHex(rand, colors) {
    const [primary, secondary] = colors;
    let out = hexField(rand, primary[1]);
    const hx = range(rand, WIDTH * 0.3, WIDTH * 0.7);
    const hy = range(rand, HEIGHT * 0.3, HEIGHT * 0.65);
    const hr = range(rand, 110, 170);
    out += `<path d="${hexPath(hx, hy, hr)}" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.25" stroke-width="1.5"/>`;
    out += `<path d="${hexPath(hx, hy, hr * 0.66)}" fill="none" stroke="${secondary[0]}" stroke-opacity="0.45" stroke-width="2"/>`;
    out += glassPanel(range(rand, WIDTH * 0.6, WIDTH * 0.82), range(rand, HEIGHT * 0.1, HEIGHT * 0.35), range(rand, 220, 340), range(rand, 180, 260), range(rand, -10, 10), rand);
    return out;
}

const TEMPLATES = [tmplPanels, tmplRings, tmplWaves, tmplGrid, tmplOrbits, tmplHex];

// ---------- blog index hero (accent gradient + wordmark) ----------

const HERO_HEIGHT = 533; // 3:1 banner

function buildHeroSvg() {
    // Smooth blend across the four accent families
    const stops = [
        ['#22d3ee', 0.0],   // blue
        ['#a78bfa', 0.35],  // purple
        ['#00ff88', 0.7],   // electric green
        ['#f0d08f', 1.0],   // golden yellow
    ];
    const stopsSvg = stops
        .map(([color, offset]) => `<stop offset="${offset}" stop-color="${color}"/>`)
        .join('');

    const blobs = [
        { cx: WIDTH * 0.15, cy: HERO_HEIGHT * 0.2, r: 260, fill: '#22d3ee' },
        { cx: WIDTH * 0.5, cy: HERO_HEIGHT * 0.9, r: 300, fill: '#a78bfa' },
        { cx: WIDTH * 0.85, cy: HERO_HEIGHT * 0.15, r: 240, fill: '#00ff88' },
        { cx: WIDTH * 0.75, cy: HERO_HEIGHT * 1.05, r: 260, fill: '#f0d08f' },
    ]
        .map(
            (b) =>
                `<circle cx="${b.cx}" cy="${b.cy}" r="${b.r}" fill="${b.fill}" filter="url(#heroBlur)" opacity="0.55"/>`
        )
        .join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HERO_HEIGHT}" viewBox="0 0 ${WIDTH} ${HERO_HEIGHT}">
  <defs>
    <linearGradient id="heroGrad" x1="0" y1="0" x2="1" y2="1">${stopsSvg}</linearGradient>
    <linearGradient id="heroShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000000" stop-opacity="0.25"/>
      <stop offset="0.5" stop-color="#000000" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.6"/>
    </linearGradient>
    <filter id="heroBlur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="90"/></filter>
  </defs>
  <rect width="${WIDTH}" height="${HERO_HEIGHT}" fill="url(#heroGrad)"/>
  ${blobs}
  <rect width="${WIDTH}" height="${HERO_HEIGHT}" fill="url(#heroShade)"/>
  <text x="${WIDTH / 2}" y="${HERO_HEIGHT / 2 - 18}" text-anchor="middle" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="112" font-weight="700" fill="#ffffff" letter-spacing="2">Blog</text>
  <text x="${WIDTH / 2}" y="${HERO_HEIGHT / 2 + 48}" text-anchor="middle" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="34" font-weight="400" fill="#ffffff" fill-opacity="0.85">Insights, updates, and comparisons on the best AI coding tools.</text>
</svg>`;
}

// ---------- main ----------

function buildSvg(slug) {
    const rand = mulberry32(hashSlug(slug));
    // Primary + secondary accent families, always distinct
    const primaryIdx = Math.floor(rand() * PALETTES.length);
    let secondaryIdx = Math.floor(rand() * PALETTES.length);
    if (secondaryIdx === primaryIdx) secondaryIdx = (secondaryIdx + 1) % PALETTES.length;
    const colors = [PALETTES[primaryIdx], PALETTES[secondaryIdx]];

    const template = pick(rand, TEMPLATES);

    // The blob field lives in <defs> (not rendered directly) and is painted
    // once via <use> over the dark base — glass panels reference #bgfx
    // (clipped + frosted) for the backdrop-blur illusion.
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
${defs(colors)}
  <g id="bgfx">${blobField(rand, colors)}</g>
</defs>
<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
<use href="#bgfx" xlink:href="#bgfx"/>
<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#lift)"/>
${template(rand, colors)}
</svg>`;
}

async function main() {
    const slugs = readdirSync(CONTENT_DIR)
        .filter((f) => f.endsWith('.mdx'))
        .map((f) => f.replace(/\.mdx$/, ''));

    mkdirSync(OUT_DIR, { recursive: true });

    let generated = 0;
    let skipped = 0;
    for (const slug of slugs) {
        const outPath = join(OUT_DIR, `${slug}.png`);
        if (existsSync(outPath) && !FORCE) {
            skipped++;
            continue;
        }
        const svg = Buffer.from(buildSvg(slug));
        await sharp(svg, { density: 150 }).png({ quality: 90 }).toFile(outPath);
        generated++;
        console.log(`generated ${slug}.png`);
    }

    // Blog index hero banner
    const heroPath = join(OUT_DIR, 'blog-hero.png');
    if (!existsSync(heroPath) || FORCE) {
        await sharp(Buffer.from(buildHeroSvg()), { density: 150 }).png({ quality: 90 }).toFile(heroPath);
        generated++;
        console.log('generated blog-hero.png');
    } else {
        skipped++;
    }

    console.log(`Blog images: ${generated} generated, ${skipped} up-to-date (${slugs.length + 1} total)`);
}

main().catch((err) => {
    console.error('Blog image generation failed:', err);
    process.exit(1);
});
