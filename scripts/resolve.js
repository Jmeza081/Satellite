'use strict';

/**
 * Token resolution.
 *
 * Turns the small expression language used across src/*.yml into concrete hex
 * colours. Keeping this separate from the build means the validator and the
 * verification gate can resolve a palette without producing files.
 *
 * Grammar:
 *
 *   #RRGGBB | #RRGGBBAA        a literal colour
 *   oklch(<L> <C> <H>)         an OKLCH colour, gamut-mapped into sRGB
 *   alpha(<expr>, <HH>)        <expr> with a two-digit hex alpha byte appended
 *   some.token.path            a reference to another token
 *
 * Literal hex is legal in tokens.yml only. Anywhere else it is a validation
 * error, so that a palette change cannot be defeated by a stray hard-coded
 * colour halfway down ui.yml.
 */

const { oklch, withAlpha, parseHex, formatHex } = require('./color');

const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const OKLCH = /^oklch\(\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)\s*\)$/i;
const ALPHA = /^alpha\(\s*(.+?)\s*,\s*([0-9a-fA-F]{2})\s*\)$/;
const TOKEN_PATH = /^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)*$/;

/** Flattens nested YAML into { 'surface.base': 'oklch(...)', ... } */
function flatten(obj, prefix = '', out = {}) {
    for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            flatten(value, path, out);
        } else {
            out[path] = value;
        }
    }
    return out;
}

/**
 * Appends a hex alpha byte, matching VS Code's #RRGGBBAA format. This preserves
 * the semantics of the theme's original `!alpha [*COLOR, A6]` YAML tag, which
 * concatenated the byte as a string rather than treating it as a percentage.
 */
function applyAlphaByte(hex, byte) {
    const { r, g, b } = parseHex(hex);
    return formatHex({ r, g, b, a: parseInt(byte, 16) / 255 });
}

/**
 * @param {object} tokenTree parsed tokens.yml
 * @returns {{ resolve: (expr: string, where?: string) => string, table: object }}
 */
function createResolver(tokenTree) {
    const raw = flatten(tokenTree);
    const cache = new Map();
    const resolving = new Set();

    function evaluate(expr, where) {
        if (expr === null || expr === undefined) {
            throw new Error(`${where}: value is empty`);
        }
        if (typeof expr !== 'string') {
            throw new Error(`${where}: expected a colour expression, got ${typeof expr}`);
        }

        const value = expr.trim();

        if (HEX.test(value)) {
            return formatHex(parseHex(value));
        }

        const ok = value.match(OKLCH);
        if (ok) {
            const [, L, C, H] = ok;
            return oklch(Number(L), Number(C), Number(H));
        }

        const al = value.match(ALPHA);
        if (al) {
            const [, inner, byte] = al;
            return applyAlphaByte(evaluate(inner, where), byte);
        }

        if (TOKEN_PATH.test(value)) {
            return lookup(value, where);
        }

        throw new Error(
            `${where}: cannot parse colour expression ${JSON.stringify(expr)}`,
        );
    }

    function lookup(path, where) {
        if (cache.has(path)) return cache.get(path);

        if (!(path in raw)) {
            throw new Error(`${where}: unknown token "${path}"`);
        }
        if (resolving.has(path)) {
            throw new Error(`${where}: circular token reference through "${path}"`);
        }

        resolving.add(path);
        const result = evaluate(raw[path], `token ${path}`);
        resolving.delete(path);

        cache.set(path, result);
        return result;
    }

    // Resolve everything up front so a broken token fails the build immediately
    // rather than only when some rarely-used key happens to reference it.
    const table = {};
    for (const path of Object.keys(raw)) {
        table[path] = lookup(path, `token ${path}`);
    }

    return {
        table,
        /** Resolves an expression that may reference tokens. */
        resolve(expr, where = 'value') {
            const value = String(expr == null ? '' : expr).trim();
            if (HEX.test(value)) {
                throw new Error(
                    `${where}: literal hex ${value} is not allowed outside tokens.yml — add it to the palette and reference it`,
                );
            }
            return evaluate(expr, where);
        },
    };
}

module.exports = { createResolver, flatten, applyAlphaByte };
