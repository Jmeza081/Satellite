'use strict';

/**
 * Builds a .vsix — the single file to hand to someone who wants to try the
 * theme without cloning the repository or waiting for a Marketplace listing.
 *
 *   node ./scripts/package.js
 *
 * They install it with:
 *
 *   code --install-extension theme-satellite-<version>.vsix
 *
 * or from inside VS Code: Extensions view -> ... menu -> "Install from VSIX...".
 *
 * This wraps vsce rather than calling it from an npm script because vsce does
 * not create the output directory, and `mkdir -p` is not portable to Windows.
 * Going through the Node API also avoids the .bin/.cmd shim differences.
 *
 * Packaging runs `vscode:prepublish` first, so build, validate, verify and
 * fixtures all have to pass before an artefact exists. A broken theme cannot
 * be packaged.
 */

const fs = require('fs');
const path = require('path');
const { createVSIX } = require('@vscode/vsce');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'bin');
const manifest = require('../package.json');

const target = path.join(OUT_DIR, `${manifest.name}-${manifest.version}.vsix`);

fs.mkdirSync(OUT_DIR, { recursive: true });

createVSIX({
    cwd: ROOT,
    packagePath: target,
    // The extension ships no runtime dependencies — everything under
    // devDependencies is build tooling and is excluded by .vscodeignore.
    dependencies: false,
})
    .then(() => {
        const { size } = fs.statSync(target);
        process.stdout.write(
            `\n  ${path.relative(ROOT, target)}  ${(size / 1024).toFixed(1)} KB\n\n` +
                `  Install:  code --install-extension ${path.relative(ROOT, target)}\n` +
                `  Remove:   code --uninstall-extension ${manifest.name}\n\n`,
        );
    })
    .catch((err) => {
        process.stderr.write(`\nPackaging failed: ${err.message}\n`);
        process.exit(1);
    });
