// Metro configures Babel on its own, but Jest's babel-jest needs this file to
// parse React Native's Flow-typed internals.
module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
  };
};
