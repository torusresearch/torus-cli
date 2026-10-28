export type ReactPreset = {
  esbuild: {
    jsx: "automatic";
  };
};

/**
 * Set the automatic JSX runtime. Add `@vitejs/plugin-react` in the consumer
 * config only when the project needs its transforms or Fast Refresh support.
 */
export function reactPreset(): ReactPreset {
  return {
    esbuild: {
      jsx: "automatic",
    },
  };
}
