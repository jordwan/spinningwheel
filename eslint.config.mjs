import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next 16 ships native flat configs, so the old FlatCompat
// bridge (which crashed on ESLint 9 with a circular JSON error) is not needed.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // These two rules arrived with the React Compiler-era eslint-plugin-react-hooks
      // that eslint-config-next 16 enables. They flag the theme/colour memoisation in
      // SpinningWheel.tsx (refs read during render) and the mount/device-detection
      // guards. That code works today; keep the findings visible as warnings so
      // `npm run lint` stays useful for real errors until that code is refactored.
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Standalone Node scripts (CommonJS, not part of the app bundle)
    "scripts/**",
  ]),
]);

export default eslintConfig;
