'use strict';

/**
 * Unit tests for the colour engine and resolver.
 *
 *   node ./scripts/test.js
 *
 * The verification gate is only as trustworthy as the maths underneath it, so
 * the contrast, OKLCH and colour-vision functions are pinned against values
 * computed independently during the audit.
 */

const assert = require('assert');
const color = require('./color');
const { createResolver, applyAlphaByte } = require('./resolve');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const close = (actual, expected, tolerance, what) =>
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `${what}: expected ~${expected}, got ${actual}`,
    );

// ---------------------------------------------------------------------------
// Hex parsing
// ---------------------------------------------------------------------------

test('parses 3, 6 and 8 digit hex', () => {
    assert.strictEqual(color.formatHex(color.parseHex('#ABC')), '#AABBCC');
    assert.strictEqual(color.formatHex(color.parseHex('#1a262e')), '#1A262E');
    assert.strictEqual(color.formatHex(color.parseHex('#1A262E80')), '#1A262E80');
});

test('rejects malformed hex', () => {
    assert.throws(() => color.parseHex('#12345'), /Invalid hex/);
    assert.throws(() => color.parseHex('#GGGGGG'), /Invalid hex/);
    assert.throws(() => color.parseHex(42), TypeError);
});

// ---------------------------------------------------------------------------
// OKLCH
// ---------------------------------------------------------------------------

test('OKLCH round-trips the theme background exactly', () => {
    const { L, C, H } = color.toOklch('#1A262E');
    close(L, 0.2611, 0.0002, 'lightness');
    close(H, 237.93, 0.05, 'hue');
    assert.strictEqual(color.oklch(0.2611, 0.0225, 237.93), '#1A262E');
});

test('OKLCH gamut-maps rather than clipping channels', () => {
    // Chroma 0.4 at this lightness is far outside sRGB; the result must still be
    // a valid colour of roughly the requested lightness and hue.
    const mapped = color.oklch(0.85, 0.4, 158);
    const back = color.toOklch(mapped);
    close(back.L, 0.85, 0.02, 'gamut-mapped lightness');
    close(back.H, 158, 3, 'gamut-mapped hue');
});

// ---------------------------------------------------------------------------
// Contrast
// ---------------------------------------------------------------------------

test('WCAG ratios match the audit figures', () => {
    close(color.contrastRatio('#4C6269', '#1A262E'), 2.39, 0.01, 'comments');
    close(color.contrastRatio('#FFFFFF', '#0A9796'), 3.57, 0.01, 'white on accent');
    close(color.contrastRatio('#21222C', '#121D23'), 1.08, 0.01, 'ansi black');
    close(color.contrastRatio('#FFFFFF', '#000000'), 21, 0.01, 'black on white');
});

test('WCAG is symmetric and bounded', () => {
    close(
        color.contrastRatio('#1A262E', '#61E9A5'),
        color.contrastRatio('#61E9A5', '#1A262E'),
        1e-9,
        'symmetry',
    );
    close(color.contrastRatio('#123456', '#123456'), 1, 1e-9, 'identical colours');
});

test('APCA matches the audit figures', () => {
    close(color.apcaContrast('#4C6269', '#1A262E'), -17.05, 0.1, 'comments');
    close(color.apcaContrast('#FFFFFF', '#0A9796'), -68.2, 0.2, 'white on accent');
});

test('translucent foregrounds are composited before measuring', () => {
    // A 50%-alpha white over the editor ground must measure as the blended
    // colour, not as pure white.
    const blended = color.composite('#FFFFFF80', '#1A262E');
    close(
        color.contrastRatio('#FFFFFF80', '#1A262E'),
        color.contrastRatio(blended, '#1A262E'),
        1e-9,
        'alpha compositing',
    );
    assert.ok(
        color.contrastRatio('#FFFFFF80', '#1A262E') <
            color.contrastRatio('#FFFFFF', '#1A262E'),
    );
});

// ---------------------------------------------------------------------------
// Colour vision
// ---------------------------------------------------------------------------

test('CVD simulation reproduces the collisions found in the audit', () => {
    // Variables and constants are perceptually identical under tritanopia.
    close(
        color.deltaEUnder('#FF7F78', '#FF833D', 'tritanopia'),
        1.06,
        0.2,
        'auburn/orange tritan',
    );
    // Functions and tags collapse under deuteranopia.
    close(
        color.deltaEUnder('#01C3CC', '#BE76CA', 'deuteranopia'),
        13.3,
        0.2,
        'cyan/purple deutan',
    );
    // The same pairs are clearly distinct to unaffected vision.
    assert.ok(color.deltaE('#FF7F78', '#FF833D') > 25);
    assert.ok(color.deltaE('#01C3CC', '#BE76CA') > 70);
});

test('CVD simulation leaves greys alone', () => {
    for (const type of color.CVD_TYPES) {
        assert.strictEqual(
            color.simulate('#808080', type),
            '#808080',
            `${type} shifted a neutral grey`,
        );
    }
});

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

test('resolves token references, oklch() and alpha()', () => {
    const r = createResolver({
        surface: { base: 'oklch(0.2611 0.0225 237.93)' },
        text: { default: '#FFFFFF', muted: 'alpha(text.default, 75)' },
        alias: { ground: 'surface.base' },
    });

    assert.strictEqual(r.table['surface.base'], '#1A262E');
    assert.strictEqual(r.table['text.muted'], '#FFFFFF75');
    assert.strictEqual(r.table['alias.ground'], '#1A262E');
    assert.strictEqual(r.resolve('surface.base', 'test'), '#1A262E');
    assert.strictEqual(r.resolve('alpha(surface.base, A6)', 'test'), '#1A262EA6');
});

test('alpha byte is hex, matching the original !alpha tag', () => {
    // The old YAML tag concatenated strings, so 75 meant 0x75 (~46%), not 75%.
    assert.strictEqual(applyAlphaByte('#FFFFFF', '75'), '#FFFFFF75');
    assert.strictEqual(applyAlphaByte('#0A9796', '50'), '#0A979650');
});

test('rejects unknown tokens, cycles and stray literals', () => {
    assert.throws(() => createResolver({ a: { b: 'nope.missing' } }), /unknown token/);
    assert.throws(
        () => createResolver({ a: { b: 'a.c' }, x: { y: '#FFF' } }),
        /unknown token/,
    );
    assert.throws(() => createResolver({ a: { b: 'a.c', c: 'a.b' } }), /circular/);

    const r = createResolver({ text: { default: '#FFFFFF' } });
    assert.throws(() => r.resolve('#FF0000', 'ui.yml → some.key'), /literal hex/);
    assert.throws(() => r.resolve('', 'ui.yml → some.key'), /cannot parse/);
});

// ---------------------------------------------------------------------------

let failed = 0;
for (const { name, fn } of tests) {
    try {
        fn();
        process.stdout.write(`  ok     ${name}\n`);
    } catch (err) {
        failed++;
        process.stdout.write(`  FAIL   ${name}\n         ${err.message}\n`);
    }
}

process.stdout.write(`\n  ${tests.length - failed}/${tests.length} passed\n`);
process.exit(failed > 0 ? 1 : 0);
