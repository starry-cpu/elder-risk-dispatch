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
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/$1',
    '^uuid$': '<rootDir>/__mocks__/uuid',
  },
};

export default config;
