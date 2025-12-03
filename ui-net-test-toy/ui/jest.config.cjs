module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'jsdom',
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        jsx: 'react-jsx'
      }
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@testing-library/.*|react-router-dom)/)',
  ],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(png|jpg|jpeg|gif|svg|ico|webp)$': '<rootDir>/src/tests/fileMock.ts',
  },
  testMatch: [
    '<rootDir>/src/tests/**/*.test.{js,ts,tsx}',
    '<rootDir>/src/tests/components*.{js,ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/src/tests/browser.*.{js,ts,tsx}',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/tests/**',
    '!src/main.{jsx,tsx}',
    '!src/vite-env.d.ts',
  ],
};
