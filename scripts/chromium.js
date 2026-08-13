'use strict';

/**
 * Locating the headless browser used to rasterise artwork.
 *
 * Shared by scripts/assets.js, which turns the brand SVGs into the PNGs the
 * Marketplace needs, and scripts/screenshots.js, which captures the editor
 * mock-ups in the README. Rendering goes through a browser rather than an image
 * library so the output matches what everyone reviewing the artwork will see.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/** @returns {string|null} path to a chromium binary, or null if none is found */
function findChromium() {
    const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers'].filter(
        Boolean,
    );
    for (const root of roots) {
        if (!fs.existsSync(root)) continue;
        const dirs = fs
            .readdirSync(root)
            .sort(
                (a, b) =>
                    (b.includes('headless') ? 1 : 0) - (a.includes('headless') ? 1 : 0),
            );
        for (const dir of dirs) {
            for (const rel of [
                // headless_shell first: smaller, and purpose-built for this
                'chrome-linux/headless_shell',
                'chrome-linux/chrome',
                'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
            ]) {
                const candidate = path.join(root, dir, rel);
                if (fs.existsSync(candidate)) return candidate;
            }
        }
    }
    for (const name of ['chromium', 'chromium-browser', 'google-chrome']) {
        try {
            return execFileSync('which', [name], { encoding: 'utf8' }).trim();
        } catch {
            /* keep looking */
        }
    }
    return null;
}

/**
 * Screenshots a local page at exact pixel dimensions.
 *
 * @param {string} chromium binary path from findChromium()
 * @param {string} pageFile absolute path to the HTML file to render
 * @param {string} out absolute path of the PNG to write
 */
function shoot(chromium, pageFile, out, width, height) {
    execFileSync(
        chromium,
        [
            '--headless',
            '--no-sandbox', // the build container runs as root
            '--disable-gpu',
            '--hide-scrollbars',
            '--force-device-scale-factor=1',
            `--window-size=${width},${height}`,
            `--screenshot=${out}`,
            'file://' + pageFile,
        ],
        { stdio: 'pipe' },
    );
    return { out, width, height, bytes: fs.statSync(out).size };
}

/** Prints the standard message and exits when no browser is available. */
function requireChromium() {
    const chromium = findChromium();
    if (!chromium) {
        process.stderr.write(
            'No Chromium found. Set PLAYWRIGHT_BROWSERS_PATH or install chromium, ' +
                'then re-run. The committed PNGs are still valid.\n',
        );
        process.exit(1);
    }
    return chromium;
}

module.exports = { findChromium, requireChromium, shoot };
