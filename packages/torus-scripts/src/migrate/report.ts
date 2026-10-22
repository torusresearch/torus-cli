import type { InspectionResult } from "./inspect.ts";

export function formatReport(result: InspectionResult): string {
  const sections = [
    "Migration inspection",
    "",
    "Detected:",
    ...(result.found.length ? result.found.map((item) => `- ${item}`) : ["- None"]),
    "",
    "Unsupported:",
    ...(result.unsupported.length ? result.unsupported.map((item) => `- ${item}`) : ["- None"]),
    "",
    "Next steps:",
    ...result.next.map((item) => `- ${item}`),
  ];
  return sections.join("\n");
}
