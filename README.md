<p align="center">
  <img src="./assets/banner.png" alt="Satellite — a space-inspired theme for VS Code, in dark, light and high contrast" width="900">
</p>

<p align="center">
  A space-inspired theme for VS Code, in dark and light, meant to be easy on the eyes.<br>
  Every colour is verified against WCAG&nbsp;2.2 and colour-vision simulation on every build.
</p>

---

## Themes

Four variants, all built from one set of partials — the workbench, syntax and
semantic rules are shared, and only the palette differs.

| Theme | Ground | Contrast floor |
| --- | --- | --- |
| **Satellite** | dark `#1A262E` | WCAG AA |
| **Satellite Daybreak** | light | WCAG AA |
| **Satellite High Contrast** | dark | WCAG AAA, no decorative exemptions |
| **Satellite Daybreak High Contrast** | white | WCAG AAA, no decorative exemptions |

Pick one from **Preferences: Color Theme** (`Ctrl/Cmd` `K` then `Ctrl/Cmd` `T`).

## Screenshots

_Coming with the first Marketplace release — one capture per theme, plus a
per-language sheet._

## Accessibility

Checked on every build, not asserted in a README.

- **Every text role clears WCAG AA** against the surface it actually sits on.
  That includes comments, which earlier versions of this theme rendered at
  2.39:1 — close to the point of invisibility for many readers.
- **Every pair of token colours that appears adjacent in real code stays
  distinguishable** under protanopia, deuteranopia and tritanopia. Roughly 1 in
  12 men has some form of colour vision deficiency, and under it hue differences
  collapse while lightness differences survive — so roles here are separated by
  lightness, not by hue alone.
- **The high-contrast variants clear AAA**, with the decorative exemptions
  withdrawn, so indent guides and rulers have to meet 3:1 as well.

`yarn verify` runs 336 contrast and colour-vision checks across the four themes
and fails the build on any regression. The requirements live in
[`src/a11y.yml`](./src/a11y.yml), declared separately from the code that
enforces them, so they can be reviewed on their own.

One documented exception: ANSI black on a dark terminal ground — and its mirror,
ANSI bright white on a light one — cannot reach AA without ceasing to be black
or white. Both are held to a lower floor of 2.5:1, which is where the colour is
unambiguously visible. The reasoning is written into `src/a11y.yml`.

## Supported languages

Two layers do the work. Languages with a language server are coloured by
**semantic tokens** — the compiler's own answer for what each identifier is,
rather than the grammar's guess — which covers TypeScript, JavaScript, Go, Rust,
C#, Java and Python from one set of rules. Everything else falls back to
TextMate scopes.

| Family | Languages |
| --- | --- |
| Core web | TypeScript, JavaScript, TSX, JSX, HTML, CSS |
| Frameworks | Vue SFC, Svelte, Astro |
| Styling | SCSS, Less, Tailwind, CSS-in-JS |
| Data and schema | JSON, YAML, TOML, GraphQL, Prisma |
| Server | Python, Go, Rust, PHP, Ruby, SQL |
| Prose and config | Markdown, Shell, Dockerfile, Makefile, diffs |

Coverage is asserted rather than claimed: [`src/fixtures.yml`](./src/fixtures.yml)
lists scope stacks the real grammars emit, and `yarn fixtures` checks that each
one resolves to the intended colour, with the intended font style, at readable
contrast. The fixtures verify how the theme handles a scope, not that a grammar
emits it; scope names are taken from each language's published grammar and the
sources are listed at the top of that file.

## Installing without the Marketplace

```bash
git clone https://github.com/Jmeza081/Satellite.git ~/.vscode/extensions/theme-satellite
cd ~/.vscode/extensions/theme-satellite
yarn install
yarn build
```

Restart VS Code and the four themes appear in the theme picker.

## Development

The theme is authored as YAML partials under `src/` and compiled into `theme/`,
which is generated and not committed.

```
src/tokens.yml           the dark palette — every colour resolves back to here
src/tokens-daybreak.yml  the light palette
src/tokens-*-hc.yml      the high-contrast palettes
src/ui.yml               VS Code workbench colour keys
src/syntax.yml           TextMate syntax rules
src/semantic.yml         semantic token colours
src/a11y.yml             the accessibility contract that `yarn verify` enforces
src/fixtures.yml         per-language scope expectations `yarn fixtures` checks
src/themes.yml           which variants to build
```

Colours are authored in OKLCH — `oklch(<lightness> <chroma> <hue>)` — and
converted to hex at build time, with chroma reduced automatically when a colour
falls outside sRGB. `alpha(token, A6)` appends a hex alpha byte, matching VS
Code's own `#RRGGBBAA` format. Nothing outside a palette file may contain a
literal hex value, so a palette change is a change to one file.

OKLCH is used because it is perceptually uniform: a lightness step means the
same thing on gold as it does on teal. That is what allows lightness to be the
channel that keeps token roles apart.

```bash
yarn build       # compile src/ into theme/
yarn dev         # rebuild on every change
yarn validate    # check colour keys against the VS Code reference
yarn coverage    # ... and list which key groups are still unstyled
yarn verify      # contrast and colour-vision separation — fails on regression
yarn fixtures    # per-language scope coverage
yarn assets      # re-render assets/*.svg to PNG
yarn test        # unit tests, then all of the above
```

`yarn verify:report` prints the full table — every colour's WCAG ratio and APCA
Lc, and the ΔE for each adjacency pair under all three simulations — without
failing the build. It is the tool to reach for when changing a palette.

`yarn validate` checks against [`data/vscode-color-keys.json`](./data/vscode-color-keys.json),
a committed snapshot of the VS Code colour reference. Refresh it with
`yarn update-color-keys` — the only command that needs network access.

## Contributing

Please read the [contributing guidelines](./.github/CONTRIBUTING.md).

## Licence

[MIT](./Licenses/SATELLITE%20LICENSE). The syntax rules began life as a fork of
[Dracula](https://github.com/dracula/visual-studio-code), whose licence is kept
alongside at [`Licenses/DRACULA LICENSE`](./Licenses/DRACULA%20LICENSE).
