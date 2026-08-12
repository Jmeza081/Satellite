'use strict';

/**
 * TextMate scope resolution.
 *
 * Answers the question the fixtures need to ask: given a scope stack that a
 * grammar would emit, which of the theme's rules wins, and what colour does the
 * editor actually paint?
 *
 * This exists because "the theme supports Svelte" is otherwise an untestable
 * claim. Running the real grammars would mean shipping vscode-textmate,
 * vscode-oniguruma and a copy of every language extension's grammar; resolving
 * scope stacks against the theme's own rules tests the part that is actually
 * ours — rule coverage, ordering and precedence — and catches the failure modes
 * that matter: a scope nothing matches, or a broad rule quietly overriding a
 * specific one.
 *
 * What it does NOT verify is that a given grammar emits a given scope. Fixture
 * scope names are taken from the published grammars (see src/fixtures.yml).
 *
 * Matching rules, following TextMate and VS Code:
 *
 *   · A selector element matches a scope when it equals it, or is a
 *     dot-boundary prefix of it: `string` matches `string.quoted.double`,
 *     but `st` does not match `string`.
 *   · A descendant selector (`meta.decorator variable.other`) matches when its
 *     last element matches the innermost scope and each earlier element matches
 *     some ancestor, in order.
 *   · The most specific matching rule wins. Element count dominates, then the
 *     number of dot-separated segments those elements matched.
 *   · Ties go to the rule declared last, which is how VS Code resolves them.
 */

/** Does one selector element match one scope name? */
function elementMatches(element, scope) {
    return scope === element || scope.startsWith(element + '.');
}

/**
 * Matches a descendant selector against a scope stack.
 *
 * @param {string} selector e.g. 'meta.decorator variable.other.readwrite'
 * @param {string[]} stack outermost first, e.g. ['source.ts', 'meta.decorator', 'variable.other.readwrite']
 * @returns {number|null} specificity score, or null when it does not match
 */
function matchSelector(selector, stack) {
    const elements = selector.trim().split(/\s+/).filter(Boolean);
    if (elements.length === 0 || stack.length === 0) return null;

    // The final element must match the innermost scope — a rule for
    // `punctuation` never paints an `entity.name.tag` just because a
    // punctuation scope sits above it in the stack.
    const target = stack[stack.length - 1];
    const last = elements[elements.length - 1];
    if (!elementMatches(last, target)) return null;

    let segments = last.split('.').length;

    // Remaining elements match ancestors, innermost-first, allowing gaps.
    let cursor = stack.length - 2;
    for (let i = elements.length - 2; i >= 0; i--) {
        let found = false;
        while (cursor >= 0) {
            if (elementMatches(elements[i], stack[cursor])) {
                segments += elements[i].split('.').length;
                cursor--;
                found = true;
                break;
            }
            cursor--;
        }
        if (!found) return null;
    }

    return elements.length * 100 + segments;
}

/**
 * Resolves a scope stack against a theme's tokenColors.
 *
 * When nothing matches the innermost scope, the innermost scope is dropped and
 * the enclosing one is tried, and so on outwards. That is how VS Code behaves,
 * and it is why a theme does not need a rule for every punctuation scope inside
 * a string: `punctuation.definition.string.begin` with no rule of its own
 * inherits the colour of the enclosing `string`. The theme carried an explicit
 * override for exactly that case as a workaround for microsoft/vscode#4795,
 * which is why removing it changed nothing.
 *
 * @param {string[]} stack outermost first
 * @param {Array} tokenColors the built theme's rules
 * @returns {{ foreground?: string, fontStyle?: string, rule: object|null, score: number }}
 */
function resolve(stack, tokenColors) {
    for (let depth = stack.length; depth > 0; depth--) {
        const result = resolveExact(stack.slice(0, depth), tokenColors);
        if (result.rule) {
            return depth === stack.length ? result : { ...result, inherited: true };
        }
    }
    return { rule: null, score: -1 };
}

/** Resolution against the innermost scope only, with no outward fallback. */
function resolveExact(stack, tokenColors) {
    let best = null;
    let bestScore = -1;

    tokenColors.forEach((rule, index) => {
        const selectors = Array.isArray(rule.scope) ? rule.scope : [rule.scope];
        for (const selector of selectors) {
            if (typeof selector !== 'string') continue;
            const score = matchSelector(selector, stack);
            if (score === null) continue;
            // >= so that a later rule wins a tie, matching VS Code.
            if (score >= bestScore) {
                bestScore = score;
                best = { rule, index, selector };
            }
        }
    });

    if (!best) return { rule: null, score: -1 };

    // A rule that sets only fontStyle leaves the colour to whatever a less
    // specific rule provided, so the foreground has to be resolved separately.
    const settings = best.rule.settings || {};
    let foreground = settings.foreground;
    if (!foreground) {
        let fallback = null;
        let fallbackScore = -1;
        tokenColors.forEach((rule) => {
            if (!rule.settings || !rule.settings.foreground) return;
            const selectors = Array.isArray(rule.scope) ? rule.scope : [rule.scope];
            for (const selector of selectors) {
                if (typeof selector !== 'string') continue;
                const score = matchSelector(selector, stack);
                if (score !== null && score >= fallbackScore) {
                    fallbackScore = score;
                    fallback = rule.settings.foreground;
                }
            }
        });
        foreground = fallback;
    }

    return {
        foreground,
        fontStyle: settings.fontStyle,
        rule: best.rule,
        selector: best.selector,
        score: bestScore,
    };
}

module.exports = { resolve, resolveExact, matchSelector, elementMatches };
