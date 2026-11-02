import type { Blocker, Finding, InspectionResult, PathBlockerCode } from "./model.js";
import { skippedDirectories } from "./walk.js";

const nextSteps = [
  "Run `vp migrate` at the workspace root.",
  "Review rewritten files before you accept the migration.",
  "Select the library, Node, React, or Vue profile that matches each package.",
  "Configure Changesets at the repository root.",
];

const blockerMessages: Record<PathBlockerCode, string> = {
  "rollup-plugins": "Custom Rollup plugins need a separate review.",
  "rollup-transforms": "Custom transforms need a separate review.",
  polyfills: "Polyfills or runtime replacements need a separate review.",
  "multi-entry": "Multi-entry builds need a separate review.",
  "asset-handling": "Custom asset handling needs a separate review.",
  "unparseable-rollup-config": "Unparseable Rollup config needs a separate review.",
  "torus-config": "Legacy torus.config files need manual replacement.",
  "legacy-commands": "Legacy `torus-scripts` commands need manual replacement with `vp` tasks.",
  "legacy-dependency": "@toruslabs/torus-scripts before v8 needs manual replacement.",
  "unknown-dependency-version": "Unrecognized @toruslabs/torus-scripts version needs a manual check.",
  "nested-workspaces": "Nested workspace migration needs a separate review.",
  "unreadable-manifest": "Unreadable package.json needs a separate review.",
  "escaped-symlink": "Symlink outside the inspection root was not inspected.",
};

function describeFinding(finding: Finding): string {
  switch (finding.kind) {
    case "config":
      return finding.path;
    case "tool":
      return `${finding.path}: ${finding.tool}`;
    case "legacy-scripts":
      return `${finding.path}: torus-scripts commands`;
    case "legacy-dependency":
      return `${finding.path}: @toruslabs/torus-scripts ${finding.spec}`;
    default: {
      const unhandled: never = finding;
      throw new Error(`Unhandled finding: ${JSON.stringify(unhandled)}`);
    }
  }
}

function describeBlocker(blocker: Blocker): string {
  if (blocker.code === "truncated") return `Inspection stopped after ${blocker.limit} directories. Review the remaining directories by hand.`;
  return `${blocker.path}: ${blockerMessages[blocker.code]}`;
}

function section(title: string, items: string[], emptyText: string): string[] {
  return [title, ...(items.length === 0 ? [`- ${emptyText}`] : items.map((item) => `- ${item}`))];
}

export function formatReport(result: InspectionResult): string {
  return [
    "Torus migration diagnostic",
    "",
    ...section("Found", result.findings.map(describeFinding), "No legacy configuration detected."),
    "",
    ...section("Unsupported", result.blockers.map(describeBlocker), "No known unsupported behavior detected."),
    "",
    "Next steps",
    ...nextSteps.map((step) => `- ${step}`),
    "",
    `Skipped directories: ${skippedDirectories.join(", ")}.`,
    "This read-only diagnostic does not execute user configuration or change files.",
    "",
  ].join("\n");
}
