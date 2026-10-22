import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";

export const readSdkMarker = (filePath: string): string => readFileSync(filePath, "utf8");

export const createSdkId = (): string => nanoid();

export const hashSdkMarker = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
