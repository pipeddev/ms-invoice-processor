module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {
    '^@procureai/domain$': '<rootDir>/src/packages/domain/src/index.ts',
    '^@procureai/domain/(.*)$': '<rootDir>/src/packages/domain/src/$1',
    '^@procureai/infra$': '<rootDir>/src/packages/infra/src/index.ts',
    '^@procureai/infra/(.*)$': '<rootDir>/src/packages/infra/src/$1',
    '^@procureai/shared$': '<rootDir>/src/packages/shared/src/index.ts',
    '^@procureai/shared/(.*)$': '<rootDir>/src/packages/shared/src/$1'
  }
};
