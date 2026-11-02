export const codes = {
  config: { blocking: false, message: "Legacy build configuration." },
  lerna: { blocking: false, message: "Lerna workspace tooling." },
  "release-it": { blocking: false, message: "release-it release tooling." },
  "local-dependency": { blocking: false, message: "Local @toruslabs/torus-scripts dependency." },
  "rollup-plugins": { blocking: true, message: "Custom Rollup plugins need a separate review." },
  "rollup-transforms": { blocking: true, message: "Custom transforms need a separate review." },
  polyfills: { blocking: true, message: "Polyfills or runtime replacements need a separate review." },
  "multi-entry": { blocking: true, message: "Multi-entry builds need a separate review." },
  "asset-handling": { blocking: true, message: "Custom asset handling needs a separate review." },
  "dynamic-rollup-config": { blocking: true, message: "Rollup config built at runtime needs a separate review." },
  "unparseable-rollup-config": { blocking: true, message: "Unparseable Rollup config needs a separate review." },
  "torus-config": { blocking: true, message: "Legacy torus.config files need manual replacement." },
  "legacy-commands": { blocking: true, message: "Legacy `torus-scripts` commands need manual replacement with `vp` tasks." },
  "legacy-dependency": { blocking: true, message: "@toruslabs/torus-scripts before v8 needs manual replacement." },
  "unknown-dependency-version": { blocking: true, message: "Unrecognized @toruslabs/torus-scripts version needs a manual check." },
  "nested-workspaces": { blocking: true, message: "Nested workspace migration needs a separate review." },
  "unreadable-manifest": { blocking: true, message: "Unreadable package.json needs a separate review." },
  "escaped-symlink": { blocking: true, message: "Symlink outside the inspection root was not inspected." },
  truncated: { blocking: true, message: "Inspection stopped at the directory limit. Review the remaining directories by hand." },
} as const satisfies Record<string, { blocking: boolean; message: string }>;

export type Code = keyof typeof codes;

export interface Finding {
  code: Code;
  path: string;
  detail?: string;
}

export function isBlocking(finding: Finding): boolean {
  return codes[finding.code].blocking;
}

export const exitCodes = { clean: 0, blocked: 1, failed: 2 } as const;

export type ExitCode = (typeof exitCodes)[keyof typeof exitCodes];
