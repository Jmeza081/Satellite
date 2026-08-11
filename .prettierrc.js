/**
 * Prettier config. Sets every option explicitly, including those that currently
 * match the defaults, so a future Prettier release changing a default does not
 * silently reformat the repository.
 *
 * See https://prettier.io/docs/en/options.html
 */
module.exports = {
    // Number of characters allowed before formatter wraps code.
    printWidth: 90,

    // Number of spaces in a tab.
    tabWidth: 4,

    // Add Semicolons at the end of all statements.
    semi: true,

    // NOTE: Quotes in JSX will always be double and ignore this setting.
    // The rest will use single quotes when possible.
    singleQuote: true,

    // Where to add trailing commas, es5 option supports adding anywhere
    // possible that is still ES5 valid
    trailingComma: 'all',

    // Add spacing between bracket destructuring (e.g., { varName } )
    bracketSpacing: true,

    // Whether to put the '>' of a multi-line element on its own line.
    // Replaces jsxBracketSameLine, which Prettier 3 removed.
    bracketSameLine: false,

    // Whether to force the use of parens when using arrow functions:
    // params => {}       vs       (params) => {}
    arrowParens: 'always',

    overrides: [
        {
            // The theme sources are YAML, where two-space indentation is the
            // convention. Without this they inherit tabWidth 4 from the JS
            // settings above, which is valid but reads as wrong and pushes the
            // aligned trailing comments off the right edge.
            files: '*.{yml,yaml}',
            options: {
                tabWidth: 2,
                singleQuote: false,
            },
        },
    ],
};
