import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Treeble embeds dist/ into the binary; no need for code splitting
  build: {
    // @ts-expect-error Vite 8 types lack codeSplitting but it exists at runtime
    codeSplitting: false,
  },
});
