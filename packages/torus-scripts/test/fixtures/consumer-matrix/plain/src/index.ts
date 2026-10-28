import { nanoid } from "nanoid";

export const createPlainSdkId = (): string => nanoid();

export type PlainSdkOptions = {
  prefix?: string;
};
