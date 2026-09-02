import { defineConfig } from "vitest/config";

/*
 * Configuration de test isolée : les moteurs AgwèStream (src/agwe) sont du
 * TypeScript pur, sans JSX ni CSS — aucun plugin Vite n'est requis.
 * Exécution : `npx vitest run`
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/agwe/**/*.test.ts"],
    globals: false,
  },
});
