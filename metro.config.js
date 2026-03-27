const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Limit workers to reduce memory usage
config.maxWorkers = 2;

// Force @firebase/auth to use browser/esm build instead of react-native build
// The RN build tries to register native modules that don't exist in Expo Go
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Redirect @firebase/auth away from the react-native entry point
  if (moduleName === '@firebase/auth') {
    const filePath = path.resolve(
      __dirname,
      'node_modules/@firebase/auth/dist/esm2017/index.js'
    );
    return { type: 'sourceFile', filePath };
  }
  if (moduleName === '@firebase/auth/internal') {
    const filePath = path.resolve(
      __dirname,
      'node_modules/@firebase/auth/dist/esm2017/internal.js'
    );
    return { type: 'sourceFile', filePath };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
