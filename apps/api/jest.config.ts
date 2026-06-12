import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  transformIgnorePatterns: [
    'node_modules/(?!.*@aws-sdk)',
  ],
  // Keep Jest cache inside the project so it gets cleaned with node_modules
  cacheDirectory: '<rootDir>/../node_modules/.cache/jest',
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/$1',
    '^uuid$': '<rootDir>/__mocks__/uuid',
  },
};

export default config;
