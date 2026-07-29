// Metro configures Babel on its own, but Jest's babel-jest needs this file to
// parse React Native's Flow-typed internals.
module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 worklets. babel-preset-expo adds this on Metro when the
    // package is installed, but babel-jest reads this file directly, so it
    // must be explicit — and last.
    plugins: ['react-native-worklets/plugin'],
  };
};
