/**
 * Set the automatic JSX runtime. Add `@vitejs/plugin-react` in the consumer
 * config only when the project needs its transforms or Fast Refresh support.
 */
export function reactPreset() {
  return {
    esbuild: {
      jsx: "automatic",
    },
  };
}
