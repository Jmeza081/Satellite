'use strict';

/**
 * Satellite colour engine.
 *
 * Everything the build and the verification gate need to reason about colour:
 * OKLCH authoring, sRGB output, the two contrast models, colour-vision
 * simulation, and perceptual difference.
 *
 * Colours are authored in OKLCH because it is perceptually uniform - a 0.05
 * lightness step means the same thing on gold as it does on teal. That property
 * is what lets the palette use lightness as the channel that keeps token roles
 * apart, which in turn is what makes the theme survive colour-vision deficiency.
 */

// ---------------------------------------------------------------------------
// sRGB transfer functions
// ---------------------------------------------------------------------------

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toGamma = (c) =>
    c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** '#1A262E' | '#1A262EFF' | '#ABC' -> { r, g, b, a } with channels in 0..1 */
function parseHex(hex) {
    if (typeof hex !== 'string')
        throw new TypeError(`Expected a hex string, got ${typeof hex}`);
    let h = hex.trim().replace(/^#/, '');

    if (h.length === 3 || h.length === 4) {
        h = h
            .split('')
            .map((c) => c + c)
            .join('');
    }
    if (h.length !== 6 && h.length !== 8) {
        throw new Error(`Invalid hex colour: ${hex}`);
    }
    if (!/^[0-9a-fA-F]+$/.test(h)) {
        throw new Error(`Invalid hex colour: ${hex}`);
    }

    return {
        r: parseInt(h.slice(0, 2), 16) / 255,
        g: parseInt(h.slice(2, 4), 16) / 255,
        b: parseInt(h.slice(4, 6), 16) / 255,
        a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
}

/** { r, g, b, a } in 0..1 -> '#RRGGBB' or '#RRGGBBAA' when alpha < 1 */
function formatHex({ r, g, b, a = 1 }) {
    const byte = (v) =>
        Math.round(clamp01(v) * 255)
            .toString(16)
            .padStart(2, '0')
            .toUpperCase();
    const base = `#${byte(r)}${byte(g)}${byte(b)}`;
    return a >= 1 ? base : base + byte(a);
}

// ---------------------------------------------------------------------------
// OKLab / OKLCH  (Björn Ottosson)
// ---------------------------------------------------------------------------

function linearRgbToOklab(r, g, b) {
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return {
        L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    };
}

function oklabToLinearRgb(L, a, bb) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * bb) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * bb) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * bb) ** 3;
    return {
        r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    };
}

const EPSILON = 0.0005;
const inGamut = ({ r, g, b }) =>
    r >= -EPSILON &&
    r <= 1 + EPSILON &&
    g >= -EPSILON &&
    g <= 1 + EPSILON &&
    b >= -EPSILON &&
    b <= 1 + EPSILON;

/**
 * OKLCH -> hex, reducing chroma until the colour fits in sRGB.
 *
 * Lightness and hue are held because those carry the design intent: lightness is
 * what separates roles under colour-vision deficiency, and hue is what carries
 * the theme's identity. Chroma is the channel we can afford to give up.
 *
 * @param {number} L lightness, 0..1
 * @param {number} C chroma, typically 0..0.4
 * @param {number} H hue angle in degrees
 * @param {number} [alpha=1]
 */
function oklch(L, C, H, alpha = 1) {
    const rad = (H * Math.PI) / 180;
    let lo = 0;
    let hi = C;

    // If full chroma already fits, take it.
    const full = oklabToLinearRgb(L, C * Math.cos(rad), C * Math.sin(rad));
    if (inGamut(full)) {
        return formatHex({
            r: toGamma(clamp01(full.r)),
            g: toGamma(clamp01(full.g)),
            b: toGamma(clamp01(full.b)),
            a: alpha,
        });
    }

    // Otherwise binary-search the largest in-gamut chroma.
    for (let i = 0; i < 32; i++) {
        const mid = (lo + hi) / 2;
        const rgb = oklabToLinearRgb(L, mid * Math.cos(rad), mid * Math.sin(rad));
        if (inGamut(rgb)) lo = mid;
        else hi = mid;
    }

    const rgb = oklabToLinearRgb(L, lo * Math.cos(rad), lo * Math.sin(rad));
    return formatHex({
        r: toGamma(clamp01(rgb.r)),
        g: toGamma(clamp01(rgb.g)),
        b: toGamma(clamp01(rgb.b)),
        a: alpha,
    });
}

/** hex -> { L, C, H } */
function toOklch(hex) {
    const { r, g, b } = parseHex(hex);
    const { L, a, b: bb } = linearRgbToOklab(toLinear(r), toLinear(g), toLinear(b));
    let H = (Math.atan2(bb, a) * 180) / Math.PI;
    if (H < 0) H += 360;
    return { L, C: Math.hypot(a, bb), H };
}

// ---------------------------------------------------------------------------
// Alpha
// ---------------------------------------------------------------------------

/**
 * Attaches an alpha channel to a colour, matching the `!alpha` tag the theme
 * has always used. `percent` is 0-100 to keep the YAML readable.
 */
function withAlpha(hex, percent) {
    const { r, g, b } = parseHex(hex);
    return formatHex({ r, g, b, a: clamp01(percent / 100) });
}

/**
 * Flattens a translucent colour against an opaque backdrop. Contrast checks need
 * this: VS Code composites a 20%-alpha selection against the editor background,
 * so measuring the raw #RRGGBBAA value would report a contrast that nobody sees.
 */
function composite(fgHex, bgHex) {
    const fg = parseHex(fgHex);
    const bg = parseHex(bgHex);
    if (fg.a >= 1) return formatHex({ ...fg, a: 1 });
    return formatHex({
        r: fg.r * fg.a + bg.r * (1 - fg.a),
        g: fg.g * fg.a + bg.g * (1 - fg.a),
        b: fg.b * fg.a + bg.b * (1 - fg.a),
        a: 1,
    });
}

// ---------------------------------------------------------------------------
// Contrast: WCAG 2.x
// ---------------------------------------------------------------------------

function relativeLuminance(hex) {
    const { r, g, b } = parseHex(hex);
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * WCAG 2.x contrast ratio, 1..21. Translucent foregrounds are composited first.
 * Thresholds: 4.5 normal text, 3.0 large text and non-text UI boundaries.
 */
function contrastRatio(fgHex, bgHex) {
    const fg = relativeLuminance(composite(fgHex, bgHex));
    const bg = relativeLuminance(bgHex);
    const hi = Math.max(fg, bg);
    const lo = Math.min(fg, bg);
    return (hi + 0.05) / (lo + 0.05);
}

// ---------------------------------------------------------------------------
// Contrast: APCA (bridge-PC constants, 0.98G-4g)
// ---------------------------------------------------------------------------

const APCA = {
    Ntx: 0.57,
    Nbg: 0.56,
    Rtx: 0.62,
    Rbg: 0.65,
    Bclip: 1.414,
    Bthrsh: 0.022,
    Wscale: 1.14,
    Woffset: 0.027,
    Wclamp: 0.1,
};

function apcaLuminance(hex) {
    const { r, g, b } = parseHex(hex);
    const s = (c) => Math.pow(c, 2.4);
    return 0.2126729 * s(r) + 0.7151522 * s(g) + 0.072175 * s(b);
}

/**
 * APCA lightness contrast, roughly -108..106. Sign indicates polarity; magnitude
 * is what matters. Guidance: |Lc| 75 is the minimum for body text, 90 preferred,
 * and 15 is the point of invisibility.
 *
 * Reported alongside WCAG because the two models disagree in useful places -
 * notably on light text over mid-tone accent fills, where APCA is more forgiving.
 * WCAG remains the gate, since that is the standard accessibility reviews cite.
 */
function apcaContrast(fgHex, bgHex) {
    let Ytx = apcaLuminance(composite(fgHex, bgHex));
    let Ybg = apcaLuminance(bgHex);

    const softClamp = (Y) =>
        Y < APCA.Bthrsh ? Y + Math.pow(APCA.Bthrsh - Y, APCA.Bclip) : Y;
    Ytx = softClamp(Ytx);
    Ybg = softClamp(Ybg);

    let C;
    if (Ybg > Ytx) {
        C = (Math.pow(Ybg, APCA.Nbg) - Math.pow(Ytx, APCA.Ntx)) * APCA.Wscale;
    } else {
        C = (Math.pow(Ybg, APCA.Rbg) - Math.pow(Ytx, APCA.Rtx)) * APCA.Wscale;
    }

    let Lc;
    if (Math.abs(C) < APCA.Wclamp) Lc = 0;
    else if (C > 0) Lc = C - APCA.Woffset;
    else Lc = C + APCA.Woffset;

    return Lc * 100;
}

// ---------------------------------------------------------------------------
// Colour vision deficiency simulation (Viénot, Brettel & Mollon 1999)
// ---------------------------------------------------------------------------

const CVD_MATRICES = {
    protanopia: [
        [0.11238, 0.88762, 0],
        [0.11238, 0.88762, 0],
        [0.00401, -0.00401, 1],
    ],
    deuteranopia: [
        [0.29275, 0.70725, 0],
        [0.29275, 0.70725, 0],
        [-0.02234, 0.02234, 1],
    ],
    tritanopia: [
        [1, 0.14461, -0.14461],
        [0, 0.85832, 0.14168],
        [0, 0.85832, 0.14168],
    ],
};

const CVD_TYPES = Object.keys(CVD_MATRICES);

/** Simulates how a colour appears to a viewer with the given deficiency. */
function simulate(hex, type) {
    const m = CVD_MATRICES[type];
    if (!m) throw new Error(`Unknown CVD type: ${type}`);

    const { r, g, b, a } = parseHex(hex);
    const lr = toLinear(r);
    const lg = toLinear(g);
    const lb = toLinear(b);

    return formatHex({
        r: toGamma(clamp01(m[0][0] * lr + m[0][1] * lg + m[0][2] * lb)),
        g: toGamma(clamp01(m[1][0] * lr + m[1][1] * lg + m[1][2] * lb)),
        b: toGamma(clamp01(m[2][0] * lr + m[2][1] * lg + m[2][2] * lb)),
        a,
    });
}

// ---------------------------------------------------------------------------
// Perceptual difference (CIELAB / CIE76)
// ---------------------------------------------------------------------------

function toLab(hex) {
    const { r, g, b } = parseHex(hex);
    const lr = toLinear(r);
    const lg = toLinear(g);
    const lb = toLinear(b);

    // sRGB -> XYZ (D65), normalised to the D65 white point
    const X = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
    const Y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
    const Z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883;

    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const fx = f(X);
    const fy = f(Y);
    const fz = f(Z);

    return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** CIE76 colour difference. Roughly: <2.3 imperceptible, <12 easily confused. */
function deltaE(hexA, hexB) {
    const A = toLab(hexA);
    const B = toLab(hexB);
    return Math.hypot(A.L - B.L, A.a - B.a, A.b - B.b);
}

/** deltaE between two colours as seen by a viewer with the given deficiency. */
function deltaEUnder(hexA, hexB, type) {
    return deltaE(simulate(hexA, type), simulate(hexB, type));
}

module.exports = {
    parseHex,
    formatHex,
    oklch,
    toOklch,
    withAlpha,
    composite,
    relativeLuminance,
    contrastRatio,
    apcaContrast,
    simulate,
    deltaE,
    deltaEUnder,
    CVD_TYPES,
};
