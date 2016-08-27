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

            self.log('Processing ' + name + '...');

            result.push(
                postcss(options.plugins)
                    .process(originalCss)
                    .then(function handlePostCSSResult(result) {
                        var processedCss = result.css;
                        var warnings = result.warnings();

                        if (warnings && warnings.length) {
                            self.log(warnings.join('\n'));
                        }

                        assets[name] = new webpackSources.RawSource(processedCss);

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