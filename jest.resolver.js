/**
 * Composes the two resolvers that both want Jest's `resolver` slot: the
 * jest-expo preset's react-native resolver, and react-native-worklets'
 * (which strips `.native` extensions for its own modules so tests load the
 * JS implementation instead of the TurboModule that only exists on device).
 */

'use strict';

const reactNativeResolver = require('@react-native/jest-preset/jest/resolver.js');

module.exports = (request, options) => {
  if (
    options.basedir.includes('react-native-worklets') ||
    request.includes('react-native-worklets')
  ) {
    options = {
      ...options,
      extensions: options.extensions?.filter((ext) => !ext.includes('native')),
    };
  }

  return reactNativeResolver(request, options);
};
