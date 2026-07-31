const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The card-detection model ships in the bundle; Metro must treat the
// TensorFlow Lite binary as an asset for `require('...cards.tflite')` to work.
config.resolver.assetExts.push('tflite');

module.exports = config;
