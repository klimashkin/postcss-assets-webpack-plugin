var postcss = require('postcss');
var webpackSources = require('webpack-sources');

function PostCSSAssetsPlugin(options) {
    this.options = options || {};

    if (options.test === undefined) {
        this.options.test = /\.css$/;
    }

    if (options.plugins === undefined) {
        this.options.plugins = [];
    }

    if (options.log === undefined) {
        this.options.log = true;
    }
}

PostCSSAssetsPlugin.prototype.apply = function(compiler) {
    var self = this;
    var options = this.options;

    compiler.plugin('emit', function(compilation, compileCallback) {
        var assets = compilation.assets;

        self.log('Start PostCSSAssetsPlugin');

        return Promise.all(Object.keys(assets).reduce(function (result, name) {
            if (!options.test.test(name)) {
                return result;
            }

            var asset = assets[name];
            var originalCss = asset.source();

            var mapName = originalCss.match(/\/\*# sourceMappingURL=(.{1,200}).*\*\/$|$/)[1];

            var inlineMap = mapName ? mapName.search(/^data:/) === 0 : false;
            if (inlineMap) { self.log('Found inline source map'); }

            var mapAsset = mapName && !inlineMap ? assets[mapName] : null;
            var externalMap = mapAsset ? mapAsset.source() : undefined;
            if (externalMap) { self.log('Found external source map'); }

            var processOptions = {
                from: name,
                to: name,
                map: (inlineMap || externalMap) ? {
                    inline: inlineMap,
                    sourcesContent: true,
                    prev: externalMap
                } : false
            };

            self.log('Processing ' + name + '...');

            result.push(
                postcss(options.plugins)
                    .process(originalCss, processOptions)
                    .then(function handlePostCSSResult(result) {
                        var processedCss = result.css;
                        var warnings = result.warnings();

                        if (warnings && warnings.length) {
                            self.log(warnings.join('\n'));
                        }

                        assets[name] = new webpackSources.RawSource(processedCss);
                        if (mapAsset) {
                            assets[mapName] = new webpackSources.RawSource(JSON.stringify(result.map));
                        }

                        self.log('Processed ' + name + '. Length before: ' + originalCss.length + ', length after: ' + processedCss.length);
                    })
                    .catch(function (error) {
                        self.log('Error processing file: ' + name, error);
                    })
            );

            return result;
        }, [])).then(function () {
            self.log('Finish PostCSSAssetsPlugin');
            compileCallback();
        }).catch(compileCallback);
    });
};

PostCSSAssetsPlugin.prototype.log = function () {
    if (this.options.log) {
        console.log.apply(console, arguments);
    }
};

module.exports = PostCSSAssetsPlugin;