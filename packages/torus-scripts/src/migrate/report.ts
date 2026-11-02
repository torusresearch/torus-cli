import { codes, type Finding, isBlocking } from "./model.js";
import { skippedDirectories } from "./walk.js";

const nextSteps = [
  "Run `vp migrate` at the workspace root.",
  "Review rewritten files before you accept the migration.",
  "Select the library, Node, React, or Vue profile that matches each package.",
  "Configure Changesets at the repository root.",
];

function describe(finding: Finding): string {
  const detail = finding.detail === undefined ? "" : ` (${finding.detail})`;
  return `${finding.path}: ${codes[finding.code].message}${detail}`;
}

function section(title: string, findings: Finding[], emptyText: string): string[] {
  return [title, ...(findings.length === 0 ? [`- ${emptyText}`] : findings.map((finding) => `- ${describe(finding)}`))];
}

export function formatReport(findings: Finding[]): string {
  return [
    "Torus migration diagnostic",
    "",
    ...section(
      "Found",
      findings.filter((finding) => !isBlocking(finding)),
      "No legacy configuration detected."
    ),
    "",
    ...section("Unsupported", findings.filter(isBlocking), "No known unsupported behavior detected."),
    "",
    "Next steps",
    ...nextSteps.map((step) => `- ${step}`),
    "",
    `Skipped directories: ${skippedDirectories.join(", ")}.`,
    "This read-only diagnostic does not execute user configuration or change files.",
    "",
  ].join("\n");
}
