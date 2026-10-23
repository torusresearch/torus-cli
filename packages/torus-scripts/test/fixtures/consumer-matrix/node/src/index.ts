import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { nanoid } from "nanoid";

export const hashMarker = (value: string): string => createHash("sha256").update(value).digest("hex");
export const readMarker = (file: string): string => readFileSync(file, "utf8");
export const nodeId = (): string => nanoid();
