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

# Development Build Instructions

This project uses `.yaml` files to structure the contents of the final `.json` theme. When running `yarn build`, the `loadTheme.js` file will aggregate the `.yaml` theme file and convert it into `.json` which is then exported under the `theme` directory.

## License

[MIT License](./LICENSE)
