'use strict';

/**
 * Language coverage check.
 *
 *   node ./scripts/fixtures.js            report, exit non-zero on failures
 *   node ./scripts/fixtures.js --quiet    only show failures
 *
 * Resolves every scope stack in src/fixtures.yml against the built theme and
 * compares the colour the editor would paint against the token the fixture
 * expects. See scripts/scopes.js for what this does and does not prove.
 */

const { composeAll } = require('./compose');
const { readSource } = require('./yaml');
const { createResolver } = require('./resolve');
const { resolve } = require('./scopes');
const { contrastRatio } = require('./color');

function check() {
    const families = readSource('fixtures.yml');
    if (!Array.isArray(families))
        throw new Error('src/fixtures.yml must be a list of families');

    const results = [];

    // Reuse the same threshold the accessibility contract enforces, so the two
    // checks cannot drift apart.
    const contract = readSource('a11y.yml') || {};
    const minimumContrast = (contract.thresholds && contract.thresholds.text) || 4.5;

    for (const built of composeAll()) {
        const tokens = createResolver(readSource(built.entry.tokens)).table;
        const editorBackground = built.theme.colors['editor.background'];
        const themeResult = {
            name: built.entry.label,
            families: [],
            total: 0,
            failures: 0,
        };

        for (const family of families) {
            const rows = [];
            for (const testCase of family.cases || []) {
                const { stack, expect, as, style } = testCase;
                themeResult.total++;

                const expected = tokens[expect];
                if (!expected) {
                    themeResult.failures++;
                    rows.push({
                        ok: false,
                        as,
                        reason: `fixture names unknown token "${expect}"`,
                    });
                    continue;
                }

                const painted = resolve(stack, built.theme.tokenColors);

                if (!painted.foreground) {
                    themeResult.failures++;
                    rows.push({
                        ok: false,
                        as,
                        reason: 'no rule matches',
                        scope: stack[stack.length - 1],
                    });
                    continue;
                }

                if (painted.foreground.toUpperCase() !== expected.toUpperCase()) {
                    themeResult.failures++;
                    rows.push({
                        ok: false,
                        as,
                        reason: `painted ${painted.foreground}, expected ${expect} ${expected}`,
                        scope: stack[stack.length - 1],
                        via: painted.selector,
                    });
                    continue;
                }

                if (style && painted.fontStyle !== style) {
                    themeResult.failures++;
                    rows.push({
                        ok: false,
                        as,
                        reason: `fontStyle ${JSON.stringify(painted.fontStyle || null)}, expected ${JSON.stringify(style)}`,
                        scope: stack[stack.length - 1],
                        via: painted.selector,
                    });
                    continue;
                }

                // The colour is asserted again here, on the value the editor
                // would actually paint. verify.js checks the palette; this
                // checks what a real token in a real language ends up with,
                // which is the number a reader experiences.
                const ratio = contrastRatio(painted.foreground, editorBackground);
                if (ratio < minimumContrast) {
                    themeResult.failures++;
                    rows.push({
                        ok: false,
                        as,
                        reason: `renders at ${ratio.toFixed(2)}:1, below the ${minimumContrast}:1 minimum`,
                        scope: stack[stack.length - 1],
                        via: painted.selector,
                    });
                    continue;
                }

                rows.push({ ok: true, as, via: painted.selector, ratio });
            }
            themeResult.families.push({ family: family.family, rows });
        }

        results.push(themeResult);
    }

    return results;
}

module.exports = { check };

if (require.main === module) {
    const quiet = process.argv.includes('--quiet');

    let results;
    try {
        results = check();
    } catch (err) {
        process.stderr.write(`\nCoverage check could not run: ${err.message}\n`);
        process.exit(1);
    }

    let failures = 0;
    for (const theme of results) {
        failures += theme.failures;
        process.stdout.write(`\n${theme.name}\n`);

        for (const { family, rows } of theme.families) {
            const shown = quiet ? rows.filter((r) => !r.ok) : rows;
            if (shown.length === 0) continue;

            const bad = rows.filter((r) => !r.ok).length;
            process.stdout.write(
                `\n  ${family}  ${bad === 0 ? `${rows.length}/${rows.length}` : `${rows.length - bad}/${rows.length}`}\n`,
            );

            for (const row of shown) {
                if (row.ok) {
                    process.stdout.write(`    pass   ${row.as}\n`);
                } else {
                    process.stdout.write(`    FAIL   ${row.as} — ${row.reason}\n`);
                    if (row.scope)
                        process.stdout.write(`           scope: ${row.scope}\n`);
                    if (row.via)
                        process.stdout.write(`           matched by: "${row.via}"\n`);
                }
            }
        }

        process.stdout.write(
            `\n  ${theme.total - theme.failures}/${theme.total} scopes resolve as expected\n`,
        );
    }

    if (failures > 0) {
        process.stdout.write(`\n${failures} coverage failure(s).\n`);
        process.exit(1);
    }
}
