/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	projects: [
		{
			displayName: 'unit',
			preset: 'ts-jest',
			testEnvironment: 'node',
			testMatch: ['<rootDir>/test/unit/**/*.test.ts'],
			moduleNameMapper: {
				'^@utils/(.*)$': '<rootDir>/utils/$1',
			},
			transform: {
				'^.+\\.ts$': [
					'ts-jest',
					{
						tsconfig: 'tsconfig.test.json',
					},
				],
			},
		},
		{
			displayName: 'integration',
			preset: 'ts-jest',
			testEnvironment: 'node',
			testMatch: ['<rootDir>/test/integration/**/*.test.ts'],
			moduleNameMapper: {
				'^@utils/(.*)$': '<rootDir>/utils/$1',
			},
			transform: {
				'^.+\\.ts$': [
					'ts-jest',
					{
						tsconfig: 'tsconfig.test.json',
					},
				],
			},
		},
	],
};
