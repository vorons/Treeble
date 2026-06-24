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
    // Vite 8 has codeSplitting at runtime but types don't reflect it yet
    codeSplitting: false,
  } as any,
});
