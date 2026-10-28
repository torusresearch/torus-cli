import type { InspectionResult } from "./inspect.js";

function section(title: string, items: string[], emptyText: string): string[] {
  return [title, ...(items.length === 0 ? [`- ${emptyText}`] : items.map((item) => `- ${item}`))];
}

export function formatReport(result: InspectionResult): string {
  return [
    "Torus migration diagnostic",
    "",
    ...section("Found", result.found, "No legacy configuration detected."),
    "",
    ...section("Unsupported", result.unsupported, "No known unsupported behavior detected."),
    "",
    ...section("Next steps", result.next, "Review the migration result."),
    "",
    "This read-only diagnostic does not execute user configuration or change files.",
    "",
  ].join("\n");
}
