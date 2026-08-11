<p align="center">
  <img
    src="https://user-images.githubusercontent.com/16481834/51505499-6a821080-1dac-11e9-891e-a0ba8fdb8c7e.png"
    height="200"
  />
</p>

<h2 align="center">
Satellite-Dark
</h2>
<p align="center">
A dark theme for vs code meant to be easy on the eyes.
</p>

---

## Demo

Current version of working theme. Sample picture is using JS as the base language.

<img width="1552" alt="satellite-dark" src="https://user-images.githubusercontent.com/16481834/51505622-4bd04980-1dad-11e9-8380-8829f0bad60f.png">

## Installation (Without Vs Code Marketplace)

If you would like to install this theme without the use of the Vs Code market place, you can do so by running the following commands:

```
$ git clone https://github.com/Jmeza081/Satellite.git ~/.vscode/extensions/theme-satellite
$ cd ~/.vscode/extensions/theme-satellite
$ yarn
$ yarn build
```

Note that you may have to restart your Vscode in order for the theme extension to show up in your settings.

## Supported Languages

## Contributing

If you'd like to contribute to this theme, please read the [contributing guidelines](./.github/CONTRIBUTING.md).

# Development

The theme is authored as YAML partials under `src/` and compiled into the
`theme/` directory, which is generated and not committed.

```
src/tokens.yml    the palette — every colour in the theme resolves back to here
src/ui.yml        VS Code workbench colour keys
src/syntax.yml    TextMate syntax rules
src/semantic.yml  semantic token colours
src/a11y.yml      the accessibility contract that `yarn verify` enforces
src/themes.yml    which theme variants to build
```

Colours are authored in OKLCH — `oklch(<lightness> <chroma> <hue>)` — and
converted to hex at build time, with chroma reduced automatically if a colour
falls outside sRGB. `alpha(token, A6)` appends a hex alpha byte. Nothing outside
`tokens.yml` may contain a literal hex value, so a palette change is a change to
one file.

```bash
yarn install
yarn build       # compile src/ into theme/
yarn dev         # rebuild on every change
yarn validate    # check colour keys against the VS Code reference
yarn coverage    # ... and list which key groups are still unstyled
yarn verify      # check contrast and colour-vision separation
yarn test        # unit tests, then all of the above
```

`yarn verify` reports how every colour scores against WCAG 2.2 and APCA, and
whether token pairs that appear adjacent in real code stay distinguishable under
protanopia, deuteranopia and tritanopia. It currently reports failures rather
than blocking the build; the requirements it checks live in `src/a11y.yml`.

`yarn validate` checks against `data/vscode-color-keys.json`, a committed
snapshot of the VS Code colour reference. Refresh it with
`yarn update-color-keys` — that is the only command that needs network access.

## License

[MIT License](./LICENSE)
