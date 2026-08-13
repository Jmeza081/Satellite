'use strict';

/**
 * Rasterises the SVG sources in assets/ to the PNGs the Marketplace needs.
 *
 *   node ./scripts/assets.js
 *
 * The Marketplace accepts PNG only, so the SVG is the source of truth and the
 * PNGs are generated. Rendering goes through the headless Chromium that ships
 * with this environment rather than an image library, so the output matches
 * what a browser draws — which is what everyone reviewing the mark will see.
 */

const fs = require('fs');
const path = require('path');
const { requireChromium, shoot } = require('./chromium');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');

// name -> list of widths to emit
const TARGETS = {
    'icon.svg': [128, 256],
    'icon-light.svg': [128],
    'banner.svg': [1280],
    'banner-light.svg': [1280],
};

function aspect(svgPath) {
    const source = fs.readFileSync(svgPath, 'utf8');
    const box = source.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    if (!box) throw new Error(`${path.basename(svgPath)} has no viewBox`);
    return { w: Number(box[1]), h: Number(box[2]) };
}

function render(chromium, svgPath, width) {
    const { w, h } = aspect(svgPath);
    const height = Math.round((width * h) / w);
    const out = path.join(
        ASSETS,
        path.basename(svgPath, '.svg') + (w === h ? `-${width}` : '') + '.png',
    );

    // A wrapper page pins the SVG to exact pixel dimensions with no margin, so
    // the screenshot is the artwork and nothing else.
    const page = path.join(ASSETS, '.render.html');
    fs.writeFileSync(
        page,
        `<!doctype html><meta charset="utf-8">` +
            `<style>html,body{margin:0;padding:0;background:transparent}` +
            `img{display:block;width:${width}px;height:${height}px}</style>` +
            `<img src="${path.basename(svgPath)}">`,
    );

    const result = shoot(chromium, page, out, width, height);

    fs.unlinkSync(page);
    return result;
}

const chromium = requireChromium();

for (const [name, widths] of Object.entries(TARGETS)) {
    const svgPath = path.join(ASSETS, name);
    if (!fs.existsSync(svgPath)) {
        process.stdout.write(`  skip   ${name} (not present)\n`);
        continue;
    }
    for (const width of widths) {
        const r = render(chromium, svgPath, width);
        process.stdout.write(
            `  ok     ${path.relative(ROOT, r.out).padEnd(30)} ${r.width}×${r.height}  ${(r.bytes / 1024).toFixed(1)} KB\n`,
        );
    }
}
