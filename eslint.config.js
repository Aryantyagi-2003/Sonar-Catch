import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "dist-firefox/**", "node_modules/**", "web-ext-artifacts/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
);
