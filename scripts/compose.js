'use strict';

/**
 * Theme composition.
 *
 * Reads the shared partials once, then builds each theme listed in themes.yml
 * by resolving that theme's palette against them. Shared here so the build,
 * the validator and the verification gate all see exactly the same output.
 */

const { readSource } = require('./yaml');
const { createResolver } = require('./resolve');

const UI_TYPE_BY_UI_THEME = {
    'vs-dark': 'dark',
    vs: 'light',
    'hc-black': 'hcDark',
    'hc-light': 'hcLight',
};

/** Loads the partials that every theme variant shares. */
function loadShared() {
    const ui = readSource('ui.yml');
    const syntax = readSource('syntax.yml');
    const semantic = readSource('semantic.yml') || { enabled: false, rules: {} };
    const themes = readSource('themes.yml');

    if (!ui || typeof ui !== 'object')
        throw new Error('src/ui.yml is empty or not a mapping');
    if (!Array.isArray(syntax)) throw new Error('src/syntax.yml must be a list of rules');
    if (!Array.isArray(themes))
        throw new Error('src/themes.yml must be a list of theme entries');

    return { ui, syntax, semantic, themes };
}

/** Builds one theme object from a manifest entry plus the shared partials. */
function composeTheme(entry, shared) {
    const { ui, syntax, semantic } = shared;
    const tokens = readSource(entry.tokens);
    if (!tokens) throw new Error(`Palette ${entry.tokens} is empty`);

    const resolver = createResolver(tokens);

    // --- workbench colours ---
    const colors = {};
    for (const [key, expr] of Object.entries(ui)) {
        colors[key] = resolver.resolve(expr, `ui.yml → ${key}`);
    }

    // --- TextMate rules ---
    const tokenColors = syntax.map((rule, index) => {
        const where = `syntax.yml → rule ${index}${rule.name ? ` (${rule.name})` : ''}`;
        const out = {};
        if (rule.name) out.name = rule.name;
        out.scope = rule.scope;

        const settings = {};
        const src = rule.settings || {};
        if (src.foreground != null) {
            settings.foreground = resolver.resolve(
                src.foreground,
                `${where} → foreground`,
            );
        }
        if (src.background != null) {
            settings.background = resolver.resolve(
                src.background,
                `${where} → background`,
            );
        }
        if (src.fontStyle != null) settings.fontStyle = src.fontStyle;
        out.settings = settings;

        return out;
    });

    // --- semantic tokens (Phase 3) ---
    const semanticTokenColors = {};
    for (const [selector, value] of Object.entries(semantic.rules || {})) {
        const where = `semantic.yml → ${selector}`;
        if (typeof value === 'string') {
            semanticTokenColors[selector] = resolver.resolve(value, where);
            continue;
        }
        const out = {};
        if (value.foreground != null)
            out.foreground = resolver.resolve(value.foreground, where);
        if (value.fontStyle != null) out.fontStyle = value.fontStyle;
        if (value.bold != null) out.bold = value.bold;
        if (value.italic != null) out.italic = value.italic;
        if (value.underline != null) out.underline = value.underline;
        semanticTokenColors[selector] = out;
    }

    const theme = {
        $schema: 'vscode://schemas/color-theme',
        name: entry.label,
        type: UI_TYPE_BY_UI_THEME[entry.uiTheme] || 'dark',
        semanticHighlighting: Boolean(semantic.enabled),
        colors,
        tokenColors,
    };

    if (Object.keys(semanticTokenColors).length > 0) {
        theme.semanticTokenColors = semanticTokenColors;
    }

    return { entry, theme, resolver };
}

/** Builds every theme in the manifest. */
function composeAll() {
    const shared = loadShared();
    return shared.themes.map((entry) => {
        for (const field of ['id', 'label', 'uiTheme', 'tokens', 'output']) {
            if (!entry[field]) {
                throw new Error(
                    `themes.yml: entry ${entry.id || '?'} is missing "${field}"`,
                );
            }
        }
        return composeTheme(entry, shared);
    });
}

module.exports = { composeAll, composeTheme, loadShared };
