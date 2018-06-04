const postcss = require('postcss');
const fancyLog = require('fancy-log');
const humanSize = require('human-size');
const webpackSources = require('webpack-sources');

const pluginName = 'PostCSSAssetsPlugin';

module.exports = class PostCSSAssetsPlugin {
  constructor({test = /\.css$/, plugins = [], log = true} = {}) {
    this.test = test;
    this.plugins = plugins;

    this.log = log ? fancyLog : () => {};
  }

  apply(compiler) {
    compiler.hooks.emit.tapPromise(pluginName, compilation => {
      const assets = compilation.assets;

      this.log('PostCSSAssetsPlugin: Starting...');

      return Promise.all(Object.keys(assets).reduce((result, name) => {
        if (!this.test.test(name)) {
          return result;
        }

        const asset = assets[name];
        const originalCss = asset.source();

        const mapName = originalCss.match(/\/\*# sourceMappingURL=(.{1,200}).*\*\/$|$/)[1];

        const inlineMap = mapName ? mapName.search(/^data:/) === 0 : false;
        if (inlineMap) {
          this.log('PostCSSAssetsPlugin: Found inline source map');
        }

        const mapAsset = mapName && !inlineMap ? assets[mapName] : null;
        const externalMap = mapAsset ? mapAsset.source() : undefined;
        if (externalMap) {
          this.log('PostCSSAssetsPlugin: Found external source map');
        }

        const processOptions = {
          from: name,
          to: name,
          map: (inlineMap || externalMap) ? {
            inline: inlineMap,
            sourcesContent: true,
            prev: externalMap
          } : false
        };

        this.log(`PostCSSAssetsPlugin: Processing ${name}...`);

        result.push(
          postcss(this.plugins)
            .process(originalCss, processOptions)
            .then(result => {
              const processedCss = result.css;
              const warnings = result.warnings();

              if (warnings && warnings.length) {
                this.log('PostCSSAssetsPlugin:', warnings.join('\n'));
              }

              assets[name] = new webpackSources.RawSource(processedCss);

              if (mapAsset) {
                assets[mapName] = new webpackSources.RawSource(JSON.stringify(result.map));
              }

              this.log(
                'PostCSSAssetsPlugin:',
                `Processed ${name}. Size before: ${humanSize(originalCss.length, 3)},`,
                `size after: ${humanSize(processedCss.length, 2)}`
              );
            })
            .catch(error => {
              this.log('PostCSSAssetsPlugin:', `Error processing file: ${name}`, error);

              throw error;
            })
        );

        return result;
      }, []))
      .then(() => {
        this.log('PostCSSAssetsPlugin: Done.');
      });
    });
  }
};