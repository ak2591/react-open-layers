module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Fix for ol-contextmenu using bare ESM imports (without .js extension)
      // ol v7+ uses "type": "module" which requires fully specified paths in webpack 5
      webpackConfig.module.rules.push({
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false,
        },
      });
      return webpackConfig;
    },
  },
};
