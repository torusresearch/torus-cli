export type LibraryOptions = {
  entry: string | string[];
  dts?: boolean;
  format?: Array<"esm" | "cjs">;
  sourcemap?: boolean;
};

export function libraryPreset(options: LibraryOptions) {
  return {
    pack: {
      entry: options.entry,
      dts: options.dts ?? true,
      format: options.format ?? ["esm"],
      sourcemap: options.sourcemap ?? true,
    },
  };
}
