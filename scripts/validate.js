'use strict';

/**
 * Validates the built themes against the VS Code colour-key reference.
 *
 *   node ./scripts/validate.js            report problems, exit non-zero on errors
 *   node ./scripts/validate.js --coverage also list unstyled key groups
 *
 * Replaces the previous lint script, which scraped the rendered documentation
 * page over the network on every run. That approach needed connectivity, broke
 * whenever the page markup changed, and produced hundreds of lines of noise
 * because it reported every unset key individually. The key list now lives in
 * data/vscode-color-keys.json and is refreshed deliberately via
 * scripts/update-color-keys.js.
 */

const { composeAll } = require('./compose');
const { readSource } = require('./yaml');

const REFERENCE = require('../data/vscode-color-keys.json');

const VALID_HEX = /^#(?:[0-9A-F]{6}|[0-9A-F]{8})$/;

// The only values VS Code documents. An empty string clears inherited styles.
const VALID_FONT_STYLES = new Set(['italic', 'bold', 'underline', 'strikethrough']);

// Values the theme has always used to mean "clear inherited styles". They are
// not documented, and whether VS Code treats them as a reset or simply ignores
// them is not specified. Swapping them for "" would be the documented spelling
// but would change rendering if they are currently being ignored, so they are
// reported and left alone until Phase 2 can confirm the behaviour in an
// Extension Development Host.
const UNDOCUMENTED_FONT_STYLES = new Set(['normal', 'regular']);

function classifyFontStyle(value) {
    const parts = String(value).split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'ok'; // "" is the documented reset
    if (parts.every((p) => VALID_FONT_STYLES.has(p))) return 'ok';
    if (parts.every((p) => VALID_FONT_STYLES.has(p) || UNDOCUMENTED_FONT_STYLES.has(p)))
        return 'undocumented';
    return 'invalid';
}

function validate({ coverage = false } = {}) {
    const errors = [];
    const warnings = [];
    const known = new Set(REFERENCE.keys);

    // ---- source-level checks that the composed output would hide ----
    const rawUi = readSource('ui.yml') || {};
    for (const [key, value] of Object.entries(rawUi)) {
        if (value === null || value === undefined || String(value).trim() === '') {
            errors.push(`ui.yml: "${key}" has no value`);
        }
    }

    const results = composeAll();

    for (const { entry, theme } of results) {
        const label = entry.output;

        // ---- workbench colours ----
        for (const [key, value] of Object.entries(theme.colors)) {
            if (!known.has(key)) {
                errors.push(
                    `${label}: unknown colour key "${key}" — not in the VS Code reference`,
                );
            }
            if (!VALID_HEX.test(value)) {
                errors.push(
                    `${label}: "${key}" resolved to ${JSON.stringify(value)}, which is not a valid hex colour`,
                );
            }
        }

        // ---- syntax rules ----
        theme.tokenColors.forEach((rule, index) => {
            const where = `${label}: syntax rule ${index}${rule.name ? ` (${rule.name})` : ''}`;

            if (!rule.scope || (Array.isArray(rule.scope) && rule.scope.length === 0)) {
                errors.push(`${where} has no scope`);
            }
            if (Array.isArray(rule.scope) && rule.scope.some((s) => s == null)) {
                errors.push(`${where} has an empty entry in its scope list`);
            }

            const settings = rule.settings || {};
            if (Object.keys(settings).length === 0) {
                errors.push(`${where} has no settings — it would have no effect`);
            }
            if (settings.foreground && !VALID_HEX.test(settings.foreground)) {
                errors.push(
                    `${where} foreground ${JSON.stringify(settings.foreground)} is not a valid hex colour`,
                );
            }
            if (settings.fontStyle !== undefined) {
                const verdict = classifyFontStyle(settings.fontStyle);
                if (verdict === 'invalid') {
                    errors.push(
                        `${where} has invalid fontStyle ${JSON.stringify(settings.fontStyle)}`,
                    );
                } else if (verdict === 'undocumented') {
                    warnings.push(
                        `${where} uses undocumented fontStyle ${JSON.stringify(settings.fontStyle)} — ` +
                            'the documented way to clear inherited styles is ""',
                    );
                }
            }
        });

        // ---- duplicate scope detection ----
        const seen = new Map();
        theme.tokenColors.forEach((rule, index) => {
            const scopes = Array.isArray(rule.scope) ? rule.scope : [rule.scope];
            for (const scope of scopes) {
                if (seen.has(scope)) {
                    warnings.push(
                        `${label}: scope "${scope}" is set by rule ${seen.get(scope)} and again by rule ${index} — the later rule wins`,
                    );
                } else {
                    seen.set(scope, index);
                }
            }
        });

        // ---- coverage, grouped by documentation section ----
        if (coverage) {
            const missing = new Map();
            for (const key of REFERENCE.keys) {
                if (key in theme.colors) continue;
                const section = REFERENCE.sections[key] || 'Other';
                if (!missing.has(section)) missing.set(section, []);
                missing.get(section).push(key);
            }
            const styled = Object.keys(theme.colors).length;
            const total = REFERENCE.keys.length;
            warnings.push(
                `${label}: styles ${styled} of ${total} documented keys (${Math.round((styled / total) * 100)}%)`,
            );
            for (const [section, keys] of [...missing.entries()].sort(
                (a, b) => b[1].length - a[1].length,
            )) {
                warnings.push(
                    `    ${String(keys.length).padStart(3)} unstyled in ${section}`,
                );
            }
        }
    }

    return { errors, warnings };
}

module.exports = { validate };

if (require.main === module) {
    const coverage = process.argv.includes('--coverage');
    let result;
    try {
        result = validate({ coverage });
    } catch (err) {
        process.stderr.write(`\nValidation could not run: ${err.message}\n`);
        process.exit(1);
    }

    for (const warning of result.warnings) process.stdout.write(`  warn   ${warning}\n`);
    for (const error of result.errors) process.stdout.write(`  ERROR  ${error}\n`);

    if (result.errors.length > 0) {
        process.stdout.write(`\n${result.errors.length} error(s).\n`);
        process.exit(1);
    }
    process.stdout.write(
        `  ok     ${REFERENCE.count} reference keys checked, no errors` +
            (result.warnings.length ? ` (${result.warnings.length} warnings)\n` : '\n'),
    );
}
