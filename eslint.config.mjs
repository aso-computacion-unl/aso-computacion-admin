import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next 16 ships native flat configs, so FlatCompat is no longer needed.
const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [".next/**", "coverage/**", "src/generated/**", "node_modules/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
