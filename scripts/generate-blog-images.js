/**
 * generate-blog-images.js
 *
 * Renders an Apple- and Google-level professional 3D abstract glassmorphic
 * featured image for every blog article.
 *
 * Design Language (Minimalist, Sleek, Ultra-Premium):
 * - Ample negative space with a dark, velvety background (#03050a to #0a0e18)
 * - Single hero focal point: clean floating frosted glass cards, sleek glass blocks, or floating orbs
 * - Refined glassmorphism: 1px specular edge bevels, subtle top sheen, realistic elevation shadow
 * - Soft ambient background illumination & smooth 3D energy light refractions
 * - Color palette: electric lime green (#00ff88), neon green (#22c55e), deep purple (#7c3aed),
 *   bright cyan blue (#22d3ee), subtle glowing yellow hints (#fbbf24)
 * - Strictly NO clutter, NO floating shape soup, NO text, NO logos, NO human figures or faces
 * - Procedurally generated & unique per post slug
 *
 * Usage:
 *   node scripts/generate-blog-images.js                    # generate missing
 *   node scripts/generate-blog-images.js --force            # regenerate all
 *   node scripts/generate-blog-images.js --slug=<slug>      # generate single slug
 */

import { readdirSync, existsSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

const WIDTH = 1600;
const HEIGHT = 686;
const CONTENT_DIR = join(process.cwd(), 'src', 'content', 'blog');
const OUT_DIR = join(process.cwd(), 'public', 'images', 'blog');
const FORCE = process.argv.includes('--force');

const SLUG_ARG = process.argv.find((arg) => arg.startsWith('--slug='));
const TARGET_SLUG = SLUG_ARG ? SLUG_ARG.split('=')[1] : null;

// Palette definitions
const ELECTRIC_LIME = '#00ff88';
const NEON_GREEN = '#22c55e';
const DEEP_PURPLE = '#7c3aed';
const BRIGHT_PURPLE = '#a855f7';
const CYAN_BLUE = '#22d3ee';
const BRIGHT_CYAN = '#06b6d4';
const GLOW_YELLOW = '#fbbf24';

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

// ---------- SVG Engine ----------

let idCounter = 0;
function uniqueId(prefix = 'id') {
    return `${prefix}_${idCounter++}`;
}

function buildDefs() {
    return `
  <defs>
    <!-- Dark Velvety Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#020307"/>
      <stop offset="50%" stop-color="#070a14"/>
      <stop offset="100%" stop-color="#030409"/>
    </linearGradient>

    <!-- Glass Reflection Sheen -->
    <linearGradient id="glassSheen" x1="0%" y1="0%" x2="30%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="20%" stop-color="#ffffff" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.00"/>
    </linearGradient>

    <!-- Broad Ambient Glow Filter -->
    <filter id="ambientLight" x="-200%" y="-200%" width="500%" height="500%">
      <feGaussianBlur stdDeviation="130"/>
    </filter>

    <!-- Soft Energy Glow Filter -->
    <filter id="softGlow" x="-200%" y="-200%" width="500%" height="500%">
      <feGaussianBlur stdDeviation="24" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Deep Floating Elevation Shadow -->
    <filter id="floatShadow" x="-100%" y="-100%" width="300%" height="300%">
      <feDropShadow dx="0" dy="32" stdDeviation="36" flood-color="#000000" flood-opacity="0.80"/>
    </filter>
  </defs>`;
}

// Subtle Background Lighting
function backgroundLighting(rand, primaryColor, secondaryColor) {
    let out = '';
    // Deep primary ambient aura
    out += `<circle cx="${range(rand, 300, 700).toFixed(1)}" cy="${range(rand, 150, 350).toFixed(1)}" r="${range(rand, 400, 580).toFixed(1)}" fill="${primaryColor}" filter="url(#ambientLight)" opacity="${range(rand, 0.35, 0.48).toFixed(2)}"/>`;
    // Deep secondary ambient aura
    out += `<circle cx="${range(rand, 900, 1300).toFixed(1)}" cy="${range(rand, 300, 520).toFixed(1)}" r="${range(rand, 350, 520).toFixed(1)}" fill="${secondaryColor}" filter="url(#ambientLight)" opacity="${range(rand, 0.30, 0.45).toFixed(2)}"/>`;
    // Subtle yellow highlight hint
    if (rand() > 0.4) {
        out += `<circle cx="${range(rand, 700, 1200).toFixed(1)}" cy="${range(rand, 100, 250).toFixed(1)}" r="${range(rand, 150, 260).toFixed(1)}" fill="${GLOW_YELLOW}" filter="url(#ambientLight)" opacity="0.18"/>`;
    }

    // Ultra-subtle background guide lines
    const gridOpacity = '0.03';
    let lines = '';
    for (let x = 0; x <= WIDTH; x += 120) {
        lines += `<line x1="${x}" y1="0" x2="${x}" y2="${HEIGHT}" stroke="#22d3ee" stroke-opacity="${gridOpacity}" stroke-width="1"/>`;
    }
    for (let y = 0; y <= HEIGHT; y += 120) {
        lines += `<line x1="0" y1="${y}" x2="${WIDTH}" y2="${y}" stroke="#a855f7" stroke-opacity="${gridOpacity}" stroke-width="1"/>`;
    }
    out += `<g>${lines}</g>`;
    return out;
}

// Single Premium Frosted Glass Card
function renderHeroGlassCard(x, y, w, h, rotDeg, primaryColor, secondaryColor, rand) {
    const rx = range(rand, 24, 36).toFixed(1);
    const borderGradId = uniqueId('bCard');
    const fillGradId = uniqueId('fCard');
    const cx = x + w / 2;
    const cy = y + h / 2;

    return `
    <g transform="rotate(${rotDeg.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})" filter="url(#floatShadow)">
      <defs>
        <linearGradient id="${fillGradId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.08"/>
          <stop offset="50%" stop-color="${primaryColor}" stop-opacity="0.05"/>
          <stop offset="100%" stop-color="${secondaryColor}" stop-opacity="0.03"/>
        </linearGradient>

        <linearGradient id="${borderGradId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.75"/>
          <stop offset="40%" stop-color="${primaryColor}" stop-opacity="0.40"/>
          <stop offset="80%" stop-color="${secondaryColor}" stop-opacity="0.30"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.15"/>
        </linearGradient>
      </defs>

      <!-- Glass Base Slab -->
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="url(#${fillGradId})" stroke="url(#${borderGradId})" stroke-width="1.5"/>

      <!-- Reflection Sheen -->
      <rect x="${x}" y="${y}" width="${w}" height="${(h * 0.45).toFixed(1)}" rx="${rx}" fill="url(#glassSheen)"/>

      <!-- Internal Refraction Edge Accent -->
      <line x1="${x + 20}" y1="${y + 1.5}" x2="${x + w - 40}" y2="${y + 1.5}" stroke="#ffffff" stroke-opacity="0.60" stroke-width="1"/>
    </g>`;
}

// Single Sleek 3D Light Wave Beam
function renderLightBeam(primaryColor, secondaryColor, rand) {
    const startX = range(rand, -100, 100);
    const startY = range(rand, HEIGHT * 0.25, HEIGHT * 0.75);
    const cp1x = range(rand, WIDTH * 0.3, WIDTH * 0.48);
    const cp1y = range(rand, -80, HEIGHT + 80);
    const cp2x = range(rand, WIDTH * 0.52, WIDTH * 0.7);
    const cp2y = range(rand, -80, HEIGHT + 80);
    const endX = range(rand, WIDTH * 0.85, WIDTH + 100);
    const endY = range(rand, HEIGHT * 0.25, HEIGHT * 0.75);

    const pathD = `M ${startX.toFixed(1)} ${startY.toFixed(1)} C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${endX.toFixed(1)} ${endY.toFixed(1)}`;

    let out = '';
    // Ambient light aura
    out += `<path d="${pathD}" fill="none" stroke="${primaryColor}" stroke-width="16" stroke-opacity="0.20" filter="url(#ambientLight)"/>`;
    // Soft outer beam
    out += `<path d="${pathD}" fill="none" stroke="${primaryColor}" stroke-width="5" stroke-opacity="0.65" filter="url(#softGlow)"/>`;
    // Crisp core
    out += `<path d="${pathD}" fill="none" stroke="#ffffff" stroke-width="2" stroke-opacity="0.95"/>`;

    // 1 or 2 subtle glowing focal light nodes
    const nx = (startX + endX) / 2 + range(rand, -100, 100);
    const ny = (startY + endY) / 2 + range(rand, -50, 50);
    out += `<circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="10" fill="${secondaryColor}" filter="url(#softGlow)" opacity="0.85"/>`;
    out += `<circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="3" fill="#ffffff"/>`;

    return out;
}

// Single 3D Glass Cube Focal Element
function render3DCubeHero(cx, cy, size, primaryColor, secondaryColor) {
    const w = size;
    const h = size * 0.58;
    const depth = size * 0.85;

    const top = [cx, cy - h];
    const right = [cx + w, cy];
    const bottom = [cx, cy + h];
    const left = [cx - w, cy];

    const bottomDown = [bottom[0], bottom[1] + depth];
    const leftDown = [left[0], left[1] + depth];
    const rightDown = [right[0], right[1] + depth];

    const topPath = `M ${top[0]} ${top[1]} L ${right[0]} ${right[1]} L ${bottom[0]} ${bottom[1]} L ${left[0]} ${left[1]} Z`;
    const leftPath = `M ${left[0]} ${left[1]} L ${bottom[0]} ${bottom[1]} L ${bottomDown[0]} ${bottomDown[1]} L ${leftDown[0]} ${leftDown[1]} Z`;
    const rightPath = `M ${bottom[0]} ${bottom[1]} L ${right[0]} ${right[1]} L ${rightDown[0]} ${rightDown[1]} L ${bottomDown[0]} ${bottomDown[1]} Z`;

    const topGradId = uniqueId('cTop');
    const leftGradId = uniqueId('cLeft');
    const rightGradId = uniqueId('cRight');

    return `
    <g filter="url(#floatShadow)">
      <defs>
        <linearGradient id="${topGradId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="${primaryColor}" stop-opacity="0.18"/>
        </linearGradient>
        <linearGradient id="${leftGradId}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${secondaryColor}" stop-opacity="0.30"/>
          <stop offset="100%" stop-color="#030409" stop-opacity="0.70"/>
        </linearGradient>
        <linearGradient id="${rightGradId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${primaryColor}" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="${secondaryColor}" stop-opacity="0.15"/>
        </linearGradient>
      </defs>

      <!-- Faces -->
      <path d="${leftPath}" fill="url(#${leftGradId})" stroke="#ffffff" stroke-opacity="0.25" stroke-width="1.2"/>
      <path d="${rightPath}" fill="url(#${rightGradId})" stroke="#ffffff" stroke-opacity="0.30" stroke-width="1.2"/>
      <path d="${topPath}" fill="url(#${topGradId})" stroke="#ffffff" stroke-opacity="0.75" stroke-width="1.5"/>

      <!-- Glowing Core -->
      <circle cx="${cx.toFixed(1)}" cy="${(cy + depth * 0.40).toFixed(1)}" r="${(size * 0.26).toFixed(1)}" fill="${primaryColor}" filter="url(#softGlow)" opacity="0.85"/>
      <circle cx="${cx.toFixed(1)}" cy="${(cy + depth * 0.40).toFixed(1)}" r="${(size * 0.10).toFixed(1)}" fill="#ffffff"/>

      <!-- Corner Highlight -->
      <circle cx="${top[0].toFixed(1)}" cy="${top[1].toFixed(1)}" r="3" fill="#ffffff" filter="url(#softGlow)"/>
    </g>`;
}

// Template 1: Minimalist Floating Hero Glass Card + Soft Light Beam
function templateHeroCard(rand, primaryColor, secondaryColor) {
    let out = backgroundLighting(rand, primaryColor, secondaryColor);
    out += renderLightBeam(primaryColor, secondaryColor, rand);

    const w = range(rand, 650, 850);
    const h = range(rand, 360, 440);
    const x = (WIDTH - w) / 2 + range(rand, -40, 40);
    const y = (HEIGHT - h) / 2 + range(rand, -20, 20);
    const rot = range(rand, -6, 6);

    out += renderHeroGlassCard(x, y, w, h, rot, primaryColor, secondaryColor, rand);
    return out;
}

// Template 2: Dual Overlapping Floating Glass Slabs (Apple-style layered depth)
function templateDualGlass(rand, primaryColor, secondaryColor) {
    let out = backgroundLighting(rand, primaryColor, secondaryColor);

    // Back card
    const w1 = range(rand, 550, 700);
    const h1 = range(rand, 320, 400);
    const x1 = WIDTH * 0.15 + range(rand, -30, 30);
    const y1 = HEIGHT * 0.18 + range(rand, -20, 20);
    out += renderHeroGlassCard(x1, y1, w1, h1, range(rand, -10, -4), secondaryColor, primaryColor, rand);

    // Front card
    const w2 = range(rand, 550, 700);
    const h2 = range(rand, 320, 400);
    const x2 = WIDTH * 0.35 + range(rand, -30, 30);
    const y2 = HEIGHT * 0.28 + range(rand, -20, 20);
    out += renderHeroGlassCard(x2, y2, w2, h2, range(rand, 4, 10), primaryColor, secondaryColor, rand);

    return out;
}

// Template 3: Hero Glass Cube + Ambient Orbit Ring
function templateCubeOrb(rand, primaryColor, secondaryColor) {
    let out = backgroundLighting(rand, primaryColor, secondaryColor);

    const cx = WIDTH * 0.5 + range(rand, -60, 60);
    const cy = HEIGHT * 0.45 + range(rand, -30, 30);

    // Minimal Orbital Ring
    out += `
    <g transform="rotate(${range(rand, -25, 25).toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})" filter="url(#softGlow)">
      <ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="320" ry="140" fill="none" stroke="${primaryColor}" stroke-width="2.5" stroke-opacity="0.60"/>
      <ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="240" ry="100" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="0.40"/>
    </g>`;

    out += render3DCubeHero(cx, cy, range(rand, 110, 150), primaryColor, secondaryColor);
    return out;
}

// Composition Generator per Article
function buildSvg(slug) {
    const rand = mulberry32(hashSlug(slug));
    idCounter = 0;

    // Pick 2 harmonious accent colors matching prompt constraints
    const primaryColor = pick(rand, [ELECTRIC_LIME, CYAN_BLUE, BRIGHT_PURPLE]);
    let secondaryColor = pick(rand, [NEON_GREEN, BRIGHT_CYAN, DEEP_PURPLE, GLOW_YELLOW]);
    if (secondaryColor === primaryColor) secondaryColor = BRIGHT_PURPLE;

    // Select 1 minimalist template (Card, Dual Slabs, or Cube/Orb)
    const tmplIndex = int(rand, 0, 2);
    let content = '';

    if (tmplIndex === 0) {
        content = templateHeroCard(rand, primaryColor, secondaryColor);
    } else if (tmplIndex === 1) {
        content = templateDualGlass(rand, primaryColor, secondaryColor);
    } else {
        content = templateCubeOrb(rand, primaryColor, secondaryColor);
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
${buildDefs()}
<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bgGrad)"/>
${content}
</svg>`;
}

// Hero Banner Generator
const HERO_HEIGHT = 533;

function buildHeroSvg() {
    const rand = mulberry32(999);
    idCounter = 0;

    const primaryColor = ELECTRIC_LIME;
    const secondaryColor = BRIGHT_PURPLE;

    let content = backgroundLighting(rand, primaryColor, secondaryColor);
    content += renderLightBeam(primaryColor, secondaryColor, rand);

    // Ultra-clean central glass panel
    content += renderHeroGlassCard(380, 75, 840, 380, 0, primaryColor, secondaryColor, rand);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HERO_HEIGHT}" viewBox="0 0 ${WIDTH} ${HERO_HEIGHT}">
${buildDefs()}
<rect width="${WIDTH}" height="${HERO_HEIGHT}" fill="url(#bgGrad)"/>
${content}
</svg>`;
}

// ---------- Main Execution ----------

async function main() {
    let slugs = readdirSync(CONTENT_DIR)
        .filter((f) => f.endsWith('.mdx'))
        .map((f) => f.replace(/\.mdx$/, ''));

    if (TARGET_SLUG) {
        if (!slugs.includes(TARGET_SLUG)) {
            console.error(`Target slug "${TARGET_SLUG}" not found in ${CONTENT_DIR}`);
            process.exit(1);
        }
        slugs = [TARGET_SLUG];
    }

    mkdirSync(OUT_DIR, { recursive: true });

    let generated = 0;
    let skipped = 0;

    for (const slug of slugs) {
        const outWebpPath = join(OUT_DIR, `${slug}.webp`);

        if (existsSync(outWebpPath) && !FORCE && !TARGET_SLUG) {
            skipped++;
            continue;
        }

        const svg = Buffer.from(buildSvg(slug));

        // High quality WebP (quality: 92, effort: 6) -> ~100-160KB
        await sharp(svg, { density: 150 })
            .webp({ quality: 92, effort: 6 })
            .toFile(outWebpPath);

        const webpSize = (statSync(outWebpPath).size / 1024).toFixed(1);

        generated++;
        console.log(`Generated ${slug}: WebP=${webpSize}KB`);
    }

    if (!TARGET_SLUG) {
        // Blog index hero banner
        const heroWebpPath = join(OUT_DIR, 'blog-hero.webp');

        if (!existsSync(heroWebpPath) || FORCE) {
            const heroSvg = Buffer.from(buildHeroSvg());
            await sharp(heroSvg, { density: 150 })
                .webp({ quality: 92, effort: 6 })
                .toFile(heroWebpPath);

            const heroWebpSize = (statSync(heroWebpPath).size / 1024).toFixed(1);

            generated++;
            console.log(`Generated blog-hero: WebP=${heroWebpSize}KB`);
        } else {
            skipped++;
        }
    }

    console.log(`Blog images process completed: ${generated} generated, ${skipped} skipped.`);
}

main().catch((err) => {
    console.error('Blog image generation failed:', err);
    process.exit(1);
});
