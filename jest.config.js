module.exports = {
    preset: 'ts-jest',
    roots: ['<rootDir>/tests', '<rootDir>/local/tests'],
    reporters: ['default'],
    testMatch: ['**/tests/**/*.jest.ts'],
    transform: {
        '^.+\\.jest.ts?$': ['ts-jest', {
            tsconfig: {
                inlineSourceMap: true
            }
        }],
    },
};
