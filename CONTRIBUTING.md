# Contributing

Thank you for your contribution! To submit your changes please fork this repository and open a pull request.

## Adding new translations

To add a new language follow these steps:
1. Fork this repository (with all branches)
1. Change branch to `dev`
1. Create a new json file named with a [correct language code](https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry) in `/src/localize/languages/` directory
1. Copy content of [`src/localize/languages/en.json`](/src/localize/languages/en.json) file to a newly created file
1. Replace English texts with your translations (do not replace keys!)
1. Import your file in [`src/localize/localize.ts`](/src/localize/localize.ts)
1. Add a new entry in [translations list](/README.md#translations)
1. Create a pull request

## Adding new platform

To add a new platform follow these steps:
1. Fork this repository (with all branches)
1. Change branch to `dev`
1. Create a new json file in `src/model/generators/platform_templates` directory
1. Copy content of [`src/model/generators/platform_templates/new.json`](/src/model/generators/platform_templates/new.json) file to a newly created file
1. Adjust configuration according to parameters of added platform
1. Import your file in [`src/model/generators/platform-generator.ts`](/src/model/generators/platform-generator.ts)
1. Add a new entry in [supported platforms list](/README.md#supported-vacuum-platforms)
1. Create a pull request

## Building with npm

To build this card run following commands:
```sh
npm install
npm run build
```

## Building and hosting with [devcontainer](https://code.visualstudio.com/docs/remote/containers)

Note: this is available only in vscode ensure you have the [Remote Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension installed.

1. Fork and clone the repository.
2. Open a [devcontainer](https://code.visualstudio.com/docs/remote/containers) terminal and run `npm start` when it's ready.
3. The compiled `.js` file will be accessible on
   `http://127.0.0.1:5000/xiaomi-vacuum-map-card.js`.
4. On a running Home Assistant installation add this to your Lovelace
   `resources:`

```yaml
- url: 'http://127.0.0.1:5000/xiaomi-vacuum-map-card.js'
  type: module
```

_Change "127.0.0.1" to the IP of your development machine._

### Bonus

If you need a fresh test instance you can install a fresh Home Assistant instance inside the devcontainer as well.

1. Run the command `container start`.
2. Home Assistant will install and will eventually be running on port `9123`
