'use strict';

/**
 * YAML loading.
 *
 * The previous version registered a custom `!alpha` tag through
 * `Schema.create()`, which was removed in js-yaml 4. Alpha is now part of the
 * colour expression language in resolve.js instead, so the theme sources parse
 * as plain YAML with no custom schema — which also means editors, linters and
 * the YAML language server can read them without knowing anything about
 * Satellite.
 */

const fs = require('fs');
const path = require('path');
const { load } = require('js-yaml');

const SRC_DIR = path.join(__dirname, '..', 'src');

/** Reads and parses a YAML file, reporting the filename on a parse error. */
function readYAML(filePath) {
    let text;
    try {
        text = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
        throw new Error(
            `Cannot read ${path.relative(process.cwd(), filePath)}: ${err.message}`,
        );
    }

    try {
        const parsed = load(text, { filename: filePath });
        return parsed === undefined ? null : parsed;
    } catch (err) {
        throw new Error(
            `Cannot parse ${path.relative(process.cwd(), filePath)}: ${err.message}`,
        );
    }
}

/** Reads a YAML file from src/ by name. */
function readSource(name) {
    return readYAML(path.join(SRC_DIR, name));
}

module.exports = { readYAML, readSource, SRC_DIR };
