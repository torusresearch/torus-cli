import type { OxfmtConfig } from "vite-plus/fmt";

export function formatPreset(): OxfmtConfig {
  return {
    printWidth: 150,
    semi: true,
    singleQuote: false,
    trailingComma: "es5",
    sortImports: true,
    sortPackageJson: false,
  };
}
