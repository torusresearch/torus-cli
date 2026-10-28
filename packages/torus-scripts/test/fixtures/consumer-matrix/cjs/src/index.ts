import { nanoid } from "nanoid";

export const sdkId = (): string => `sdk-${nanoid()}`;
