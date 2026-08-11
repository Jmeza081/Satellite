'use strict';

/**
 * Builds every theme in src/themes.yml into its output file.
 *
 *   node ./scripts/build.js
 */

const fs = require('fs');
const path = require('path');
const { composeAll } = require('./compose');

const ROOT = path.join(__dirname, '..');

function build() {
    const results = composeAll();
    const written = [];

    for (const { entry, theme } of results) {
        const target = path.join(ROOT, entry.output);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, JSON.stringify(theme, null, 4) + '\n');
        written.push({
            output: entry.output,
            colors: Object.keys(theme.colors).length,
            rules: theme.tokenColors.length,
        });
    }

    return written;
}

module.exports = { build };

if (require.main === module) {
    try {
        for (const item of build()) {
            process.stdout.write(
                `  ${item.output.padEnd(28)} ${String(item.colors).padStart(4)} colours  ` +
                    `${String(item.rules).padStart(3)} syntax rules\n`,
            );
        }
    } catch (err) {
        process.stderr.write(`\nBuild failed: ${err.message}\n`);
        process.exit(1);
    }
}
