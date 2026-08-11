'use strict';

/**
 * Rebuilds the theme whenever anything in src/ changes.
 *
 *   node ./scripts/dev.js
 *
 * Open the repository in an Extension Development Host (F5) and the reloaded
 * theme picks up each rebuild.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const DEBOUNCE_MS = 40;

let timer = null;

function rebuild() {
    // Re-require on every rebuild so edits to the scripts themselves are picked
    // up without restarting the watcher.
    for (const key of Object.keys(require.cache)) {
        if (key.startsWith(path.join(__dirname, path.sep))) delete require.cache[key];
    }

    const started = Date.now();
    try {
        const { build } = require('./build');
        const written = build();
        const summary = written
            .map((w) => `${w.colors} colours, ${w.rules} rules`)
            .join('; ');
        process.stdout.write(`  rebuilt in ${Date.now() - started}ms — ${summary}\n`);
    } catch (err) {
        process.stdout.write(`  build failed: ${err.message}\n`);
    }
}

process.stdout.write(
    `Watching ${path.relative(process.cwd(), SRC_DIR)} for changes. Ctrl-C to stop.\n`,
);
rebuild();

fs.watch(SRC_DIR, { recursive: true }, (_event, filename) => {
    if (!filename || !/\.ya?ml$/.test(filename)) return;
    clearTimeout(timer);
    timer = setTimeout(rebuild, DEBOUNCE_MS);
});
