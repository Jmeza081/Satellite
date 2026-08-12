'use strict';

/**
 * Accessibility verification.
 *
 *   node ./scripts/verify.js            report, always exit 0
 *   node ./scripts/verify.js --strict   exit non-zero if anything fails
 *   node ./scripts/verify.js --quiet    only show failures
 *
 * Checks the contract in src/a11y.yml against the built themes:
 *
 *   · every syntax token colour, against the editor background
 *   · every declared UI foreground/background pair
 *   · every declared adjacency pair, under three colour-vision simulations
 *
 * Runs in report mode by default because the current palette does not yet pass —
 * the failures below are the Phase 2 worklist. It becomes a build gate (--strict
 * in the `build` script) once the re-grade lands.
 */

const { composeAll } = require('./compose');
const { readSource } = require('./yaml');
const { createResolver } = require('./resolve');
const { contrastRatio, apcaContrast, deltaEUnder, CVD_TYPES } = require('./color');

const PASS = 'pass';
const FAIL = 'FAIL';

function pad(value, width) {
    return String(value).padStart(width);
}

function checkContrast(fg, bg, threshold) {
    const ratio = contrastRatio(fg, bg);
    return {
        ratio,
        apca: apcaContrast(fg, bg),
        ok: ratio >= threshold,
    };
}

/** Resolves an a11y.yml reference: a literal hex, or a colour key in the theme. */
function resolveRef(ref, colors) {
    if (typeof ref === 'string' && ref.startsWith('#')) return ref;
    if (ref in colors) return colors[ref];
    return null;
}

function verifyTheme({ entry, theme }, contract, tokenResolver) {
    // Per-theme overrides let the high-contrast variants be held to a higher
    // bar than the standard pair, using the same declared pairs. Without this
    // an "HC" theme would only ever be asserted to meet plain AA, which would
    // make the label meaningless.
    const override = (contract.overrides || {})[entry.id] || {};
    const thresholds = { ...contract.thresholds, ...(override.thresholds || {}) };
    const { pairs = [], adjacency = [] } = contract;
    // `exempt: false` in an override withdraws the decorative exemptions, so
    // indent guides and rulers have to meet the non-text threshold like
    // everything else.
    const exemptionsApply = override.exempt !== false;
    const exempt = exemptionsApply ? contract.exempt || {} : {};
    const enforced = exemptionsApply ? {} : contract.exempt || {};
    const colors = theme.colors;
    const results = {
        name: entry.label,
        output: entry.output,
        sections: [],
        failures: 0,
        checks: 0,
    };

    const editorBg = colors['editor.background'];
    if (!editorBg)
        throw new Error(
            `${entry.output}: editor.background is not set — cannot verify contrast`,
        );

    // ---------------------------------------------------------------- syntax
    const syntaxRows = [];
    const seen = new Map();
    for (const rule of theme.tokenColors) {
        const fg = rule.settings && rule.settings.foreground;
        if (!fg) continue;
        if (!seen.has(fg)) seen.set(fg, []);
        seen.get(fg).push(
            rule.name || (Array.isArray(rule.scope) ? rule.scope[0] : rule.scope),
        );
    }
    for (const [fg, users] of seen) {
        const { ratio, apca, ok } = checkContrast(fg, editorBg, thresholds.text);
        if (!ok) results.failures++;
        results.checks++;
        syntaxRows.push({
            ok,
            label: users[0] + (users.length > 1 ? ` (+${users.length - 1} more)` : ''),
            colour: fg,
            ratio,
            apca,
            need: thresholds.text,
        });
    }
    syntaxRows.sort((a, b) => a.ratio - b.ratio);
    results.sections.push({
        title: 'Syntax token colours vs editor background',
        rows: syntaxRows,
    });

    // -------------------------------------------------------------------- UI
    const uiRows = [];
    for (const pair of pairs) {
        const fg = resolveRef(pair.fg, colors);
        const bg = resolveRef(pair.bg, colors);

        if (fg === null || bg === null) {
            uiRows.push({
                skip: true,
                label: pair.as,
                colour: fg === null ? pair.fg : pair.bg,
                note: 'not set by the theme',
            });
            continue;
        }

        const threshold = thresholds[pair.level] ?? thresholds.text;
        const { ratio, apca, ok } = checkContrast(fg, bg, threshold);
        if (!ok) results.failures++;
        results.checks++;
        uiRows.push({ ok, label: pair.as, colour: fg, ratio, apca, need: threshold });
    }
    // Keys that are exempt by default but enforced for high-contrast variants.
    for (const key of Object.keys(enforced)) {
        const value = colors[key];
        if (!value) continue;
        const { ratio, apca, ok } = checkContrast(value, editorBg, thresholds.nonText);
        if (!ok) results.failures++;
        results.checks++;
        uiRows.push({
            ok,
            label: `${key} (exemption withdrawn for high contrast)`,
            colour: value,
            ratio,
            apca,
            need: thresholds.nonText,
        });
    }

    uiRows.sort((a, b) => (a.skip ? 1 : b.skip ? -1 : a.ratio - b.ratio));
    results.sections.push({ title: 'UI foreground / background pairs', rows: uiRows });

    // -------------------------------------------------------------- adjacency
    const adjRows = [];
    for (const item of adjacency) {
        const { a: aRef, b: bRef, why: note } = item;
        const a = tokenResolver.table[aRef];
        const b = tokenResolver.table[bRef];
        if (!a || !b) {
            adjRows.push({
                skip: true,
                label: `${aRef} / ${bRef}`,
                note: 'unknown token',
            });
            continue;
        }

        const perType = CVD_TYPES.map((type) => ({
            type,
            delta: deltaEUnder(a, b, type),
        }));
        const worst = perType.reduce((lo, x) => (x.delta < lo.delta ? x : lo));
        const ok = worst.delta >= thresholds.minDeltaE;
        if (!ok) results.failures++;
        results.checks++;
        adjRows.push({
            ok,
            label: `${aRef} / ${bRef}`,
            note,
            perType,
            worst,
            need: thresholds.minDeltaE,
        });
    }
    adjRows.sort((a, b) => (a.skip ? 1 : b.skip ? -1 : a.worst.delta - b.worst.delta));
    results.sections.push({
        title: 'Adjacency under colour-vision simulation',
        rows: adjRows,
        adjacency: true,
    });

    // ------------------------------------------------------------- exemptions
    results.exempt = Object.entries(exempt).map(([key, reason]) => {
        const value = colors[key];
        return {
            key,
            reason,
            ratio: value ? contrastRatio(value, editorBg) : null,
        };
    });

    return results;
}

function verify() {
    const contract = readSource('a11y.yml');
    if (!contract) throw new Error('src/a11y.yml is missing');

    return composeAll().map((built) => {
        const tokens = readSource(built.entry.tokens);
        return verifyTheme(built, contract, createResolver(tokens));
    });
}

module.exports = { verify };

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function report(results, { quiet }) {
    for (const theme of results) {
        process.stdout.write(`\n${theme.name}  —  ${theme.output}\n`);

        for (const section of theme.sections) {
            const rows = quiet
                ? section.rows.filter((r) => !r.ok && !r.skip)
                : section.rows;
            if (rows.length === 0) continue;

            process.stdout.write(`\n  ${section.title}\n`);

            for (const row of rows) {
                if (row.skip) {
                    process.stdout.write(`    skip   ${row.label}  —  ${row.note}\n`);
                    continue;
                }

                if (section.adjacency) {
                    const detail = row.perType
                        .map((p) => `${p.type.slice(0, 6)} ${pad(p.delta.toFixed(0), 3)}`)
                        .join('  ');
                    process.stdout.write(
                        `    ${row.ok ? PASS : FAIL}   ${detail}   ${row.label}\n` +
                            `           ${row.note}\n`,
                    );
                } else {
                    process.stdout.write(
                        `    ${row.ok ? PASS : FAIL}   ${pad(row.ratio.toFixed(2), 5)}:1  ` +
                            `Lc ${pad(row.apca.toFixed(0), 4)}   ${row.colour}  ${row.label}\n`,
                    );
                }
            }
        }

        if (!quiet && theme.exempt.length) {
            process.stdout.write('\n  Decorative exemptions (not checked)\n');
            for (const item of theme.exempt) {
                const ratio =
                    item.ratio === null ? ' n/a ' : pad(item.ratio.toFixed(2), 5);
                process.stdout.write(
                    `    exempt ${ratio}:1  ${item.key}\n           ${item.reason}\n`,
                );
            }
        }

        const verdict =
            theme.failures === 0
                ? 'all checks passed'
                : `${theme.failures} of ${theme.checks} checks failed`;
        process.stdout.write(`\n  ${verdict}\n`);
    }
}

if (require.main === module) {
    const strict = process.argv.includes('--strict');
    const quiet = process.argv.includes('--quiet');

    let results;
    try {
        results = verify();
    } catch (err) {
        process.stderr.write(`\nVerification could not run: ${err.message}\n`);
        process.exit(1);
    }

    report(results, { quiet });

    const failures = results.reduce((sum, t) => sum + t.failures, 0);
    if (failures > 0) {
        if (strict) {
            process.stdout.write(`\n${failures} accessibility check(s) failed.\n`);
            process.exit(1);
        }
        process.stdout.write(
            `\n${failures} accessibility check(s) failed — reporting only. ` +
                'These are the Phase 2 worklist; run with --strict to enforce.\n',
        );
    }
}
