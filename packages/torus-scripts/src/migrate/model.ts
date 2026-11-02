export type Finding =
  | { kind: "config"; path: string }
  | { kind: "tool"; tool: "Lerna" | "release-it"; path: string }
  | { kind: "legacy-scripts"; path: string }
  | { kind: "legacy-dependency"; path: string; spec: string };

export type PathBlockerCode =
  | "rollup-plugins"
  | "rollup-transforms"
  | "polyfills"
  | "multi-entry"
  | "asset-handling"
  | "unparseable-rollup-config"
  | "torus-config"
  | "legacy-commands"
  | "legacy-dependency"
  | "unknown-dependency-version"
  | "nested-workspaces"
  | "unreadable-manifest"
  | "escaped-symlink";

export type Blocker = { code: "truncated"; limit: number } | { code: PathBlockerCode; path: string };

export interface InspectionResult {
  findings: Finding[];
  blockers: Blocker[];
}
