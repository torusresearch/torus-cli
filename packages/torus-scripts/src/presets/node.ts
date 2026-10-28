export type NodeOptions = {
  entry: string | string[];
};

/**
 * Pack a Node library and leave its dependencies external. Use `tsc` or a
 * Nest-specific build for decorator metadata; this preset does not transform it.
 */
export function nodePreset(options: NodeOptions) {
  return {
    pack: {
      entry: options.entry,
      platform: "node",
      deps: {
        neverBundle: true,
      },
    },
  };
}
