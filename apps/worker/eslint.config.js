import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
	{
		ignores: ['node_modules/', 'dist/', 'tmp/', 'ecosystem.config.cjs']
	},
	js.configs.recommended,
	...tseslint.configs.recommendedTypeChecked.map((config) => ({
		...config,
		files: ['src/**/*.ts']
	})),
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			globals: globals.node,
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname
			}
		},
		rules: {
			'@typescript-eslint/no-unused-vars': ['warn'],
			'@typescript-eslint/no-explicit-any': ['off'],
			'@typescript-eslint/no-unsafe-call': ['off'],
			'@typescript-eslint/no-unsafe-member-access': ['off'],
			'@typescript-eslint/no-unsafe-argument': ['off'],
			'@typescript-eslint/no-unsafe-enum-comparison': ['off'],
			'@typescript-eslint/no-unsafe-return': ['off'],
			'@typescript-eslint/no-unsafe-assignment': ['off'],
			'@typescript-eslint/no-redundant-type-constituents': ['off']
		}
	},
	prettier
);
