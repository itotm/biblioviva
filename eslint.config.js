// SPDX-License-Identifier: GPL-3.0-or-later
import prettier from "eslint-config-prettier";
import path from "node:path";
import js from "@eslint/js";
import svelte from "eslint-plugin-svelte";
import { defineConfig, includeIgnoreFile } from "eslint/config";
import globals from "globals";
import ts from "typescript-eslint";

const gitignorePath = path.resolve(import.meta.dirname, ".gitignore");

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	// third-party builds vendored as-is (OpenCV.js, step 3.7)
	{ ignores: ["src/lib/vision/vendor/**"] },
	js.configs.recommended,
	ts.configs.strictTypeChecked,
	ts.configs.stylisticTypeChecked,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
			parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
		},
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			"no-undef": "off",
		},
	},
	{
		files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: [".svelte"],
				parser: ts.parser,
			},
		},
	},
	{
		rules: {
			// Best practices (owner review): braces on every block, strict equality, immutability.
			curly: ["error", "all"],
			eqeqeq: ["error", "always", { null: "ignore" }],
			"no-var": "error",
			"prefer-const": "error",
			"prefer-template": "error",
			"object-shorthand": "error",
			"no-else-return": ["error", { allowElseIf: false }],
			"@typescript-eslint/consistent-type-definitions": ["error", "interface"],
			// Every declared function, method and named arrow states its return type, `: void`
			// included (owner decision, step 1.15); inline callbacks passed as arguments
			// keep the type of the parameter they fill.
			"@typescript-eslint/explicit-function-return-type": [
				"error",
				{
					allowExpressions: true,
					allowTypedFunctionExpressions: true,
					allowHigherOrderFunctions: true,
					allowDirectConstAssertionInArrowFunctions: true,
				},
			],
			"@typescript-eslint/explicit-module-boundary-types": "error",
			"@typescript-eslint/no-floating-promises": "error",
			"@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],
			"@typescript-eslint/switch-exhaustiveness-check": "error",
			"@typescript-eslint/prefer-nullish-coalescing": "off",
			"@typescript-eslint/restrict-template-expressions": [
				"error",
				{ allowNumber: true, allowBoolean: true, allowNullish: true },
			],
			"@typescript-eslint/no-confusing-void-expression": "off",
			// runtime data (Drizzle `.get()`, JSON casts) is checked defensively even when the type says otherwise
			"@typescript-eslint/no-unnecessary-condition": "off",
			"@typescript-eslint/no-unnecessary-type-parameters": "off",
			"svelte/button-has-type": "error",
			"no-console": ["warn", { allow: ["warn", "error"] }],
			"@typescript-eslint/consistent-type-imports": "error",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
			],
		},
	},
	{
		files: ["scripts/**", "tests/**"],
		rules: { "no-console": "off" },
	},
	{
		// Tests may assert non-null on fixtures they control and poke at raw JSON.
		files: ["**/*.test.ts", "**/*.spec.ts", "tests/**"],
		rules: {
			"@typescript-eslint/no-non-null-assertion": "off",
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-dynamic-delete": "off",
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-argument": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-return": "off",
		},
	},
	{
		// Svelte components are type-checked by svelte-check (generated $types); ESLint sees `any`
		// for `$props()` data, so the unsafe-any family is left to svelte-check there.
		files: ["**/*.svelte"],
		rules: {
			// `$props()` destructuring must stay `let`; the Svelte rule knows the runes
			"prefer-const": "off",
			"svelte/prefer-const": "error",
			// `x = $bindable()` in `$props()` looks like a default value to this rule
			"@typescript-eslint/no-useless-default-assignment": "off",
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-argument": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-return": "off",
		},
	},
	{
		// Plain JavaScript (configs, scripts) is not type-checked.
		files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
		extends: [ts.configs.disableTypeChecked],
		rules: {
			"@typescript-eslint/no-floating-promises": "off",
			"@typescript-eslint/no-misused-promises": "off",
			"@typescript-eslint/switch-exhaustiveness-check": "off",
			"@typescript-eslint/restrict-template-expressions": "off",
			// types cannot be written in plain JavaScript
			"@typescript-eslint/explicit-function-return-type": "off",
			"@typescript-eslint/explicit-module-boundary-types": "off",
		},
	},
);
