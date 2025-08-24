// @ts-check

import eslint from '@eslint/js'
import { includeIgnoreFile } from '@eslint/compat'
import tseslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'
import { fileURLToPath } from 'node:url'

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url))

export default tseslint.config(
	includeIgnoreFile(gitignorePath, 'Imported .gitignore patterns'),
	{
		files: [
			'src/**/*.ts'
		],
		extends: [
			eslint.configs.recommended,
			tseslint.configs.recommendedTypeChecked,
			stylistic.configs.recommended,
		],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				projectService: true,
			},
		},
		rules: {
			'@stylistic/brace-style': 'off',
			'@stylistic/comma-spacing': ['warn', { before: false, after: true }],
			'@stylistic/indent': ['error', 'tab'],
			'@stylistic/no-extra-parens': 'warn',
			'@stylistic/no-tabs': 'off',
			'@stylistic/space-before-function-paren': ['warn', 'always'],

			'@stylistic/max-statements-per-line': 'off',

			'@typescript-eslint/no-unused-vars': ['warn', {
				argsIgnorePattern: '^_',
				// vars: 'all',
				// args: 'none',
				// ignoreRestSiblings: false,
			}],
			'@typescript-eslint/restrict-plus-operands': 'off',
		},
	}
);

// 			// '@typescript-eslint/no-restricted-types': ['error', {
// 			// 	types: {
// 			// 		Object: 'Use {} instead.',
// 			// 		String: 'Use \'string\' instead.',
// 			// 		Number: 'Use \'number\' instead.',
// 			// 		Boolean: 'Use \'boolean\' instead.',
// 			// 	},
// 			// }],
// 			// '@typescript-eslint/naming-convention': ['error', {
// 			// 	selector: 'interface',
// 			// 	format: ['PascalCase'],

// 			// 	custom: {
// 			// 		regex: '^I[A-Z]',
// 			// 		match: true,
// 			// 	},
// 			// }],
// 			// '@typescript-eslint/no-confusing-non-null-assertion': 'warn',
// 			// '@typescript-eslint/no-floating-promises': ['error', {
// 			// 	checkThenables: true,
// 			// }],
// 			// '@typescript-eslint/no-misused-promises': 'error',
// 			// '@typescript-eslint/no-non-null-assertion': 0,
// 			// '@typescript-eslint/no-unnecessary-condition': 0,
// 			// 'no-unused-vars': 'off',
// 			'@typescript-eslint/no-unused-vars': ['warn', {
// 				argsIgnorePattern: '^_',
// 				vars: 'all',
// 				args: 'none',
// 				ignoreRestSiblings: false,
// 			}],
// 			// '@typescript-eslint/prefer-readonly': 'warn',
// 			// '@typescript-eslint/switch-exhaustiveness-check': 'warn',

// 			// // 'promise/catch-or-return': 'warn',
// 			// // 'promise/no-callback-in-promise': 'off',
// 			// // 'promise/always-return': ['warn', {
// 			// // 	ignoreLastCallback: true,
// 			// // }],

// 			// 'no-console': 'warn',
// 			// 'no-empty': 'warn',
// 			// 'no-mixed-spaces-and-tabs': ['error', 'smart-tabs'],
// 			// 'no-trailing-spaces': ['error', { skipBlankLines: false }],
// 			// 'prefer-promise-reject-errors': 'error',
// 			// 'quotes': ['warn', 'single'],
// 			// 'semi': ['error', 'never'],
// 			// 'space-before-blocks': ['error', 'always'],
// 			// 'space-in-parens': ['warn', 'never'],
// 			// 'spaced-comment': ['error', 'always', { markers: ['/'] }],
