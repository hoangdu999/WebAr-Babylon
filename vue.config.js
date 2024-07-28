const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

module.exports = {
  configureWebpack: {
    resolve: {
      fallback: {
        https: require.resolve("https-browserify"),
      },
    },
    plugins: [new NodePolyfillPlugin()],
  },
};
