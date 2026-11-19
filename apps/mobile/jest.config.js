module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules[\\/\\\\](?!(jest-)?(@?react-native[^\\/\\\\]*|@react-navigation|@reduxjs|react-redux|@firebase|firebase|lucide-react-native|immer)[\\/\\\\])',
  ],
  moduleNameMapper: {
    '^immer$': '<rootDir>/node_modules/immer/dist/cjs/index.js',
    '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
    '^react-redux$': '<rootDir>/node_modules/react-redux/dist/cjs/index.js',
  },
};

