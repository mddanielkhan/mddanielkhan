import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "dist/**", "coverage/**", "playwright-report/**", "test-results/**", "next-env.d.ts", "drizzle/**"],
  },
  {
    rules: {
      // Security: rendering raw HTML is never allowed. User content is always escaped by React.
      "react/no-danger": "error",
      "no-restricted-syntax": [
        "error",
        { selector: "CallExpression[callee.name='eval']", message: "eval is forbidden." },
        { selector: "NewExpression[callee.name='Function']", message: "new Function is forbidden." },
      ],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
    },
  },
  {
    // Route handlers must go through the security pipeline; raw NextResponse construction is reviewed.
    files: ["src/app/**/route.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "@/lib/db/client", message: "Route handlers call services, not the DB directly." }] },
      ],
    },
  },
];

export default config;
