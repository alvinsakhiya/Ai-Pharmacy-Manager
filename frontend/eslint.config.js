import js from "@eslint/js";
import react from "@eslint-react/eslint-plugin";
import globals from "globals";
import hooks from "eslint-plugin-react-hooks";
import refresh from "eslint-plugin-react-refresh";

export default [
  {
    ignores: ["dist/**"],
  },
  {
    files: ["**/*.{js,jsx}"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["src/**/*.{js,jsx}"],
    ...react.configs.recommended,
    rules: {
      ...react.configs.recommended.rules,
      "@eslint-react/set-state-in-effect": "off",
    },
  },
  {
    files: ["src/**/*.{js,jsx}"],
    ...hooks.configs.flat["recommended-latest"],
    rules: {
      ...hooks.configs.flat["recommended-latest"].rules,
      // This app intentionally uses effects to initialise modal state and start
      // client-side data loading when dependencies change.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["src/**/*.{js,jsx}"],
    ...refresh.configs.vite,
    rules: {
      ...refresh.configs.vite.rules,
      // Providers and their consumer hooks are deliberately colocated.
      "react-refresh/only-export-components": "off",
    },
  },
];
