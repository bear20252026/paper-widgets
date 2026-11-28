import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // CSS minification rewrites rgba() colours as 8-digit hex, rounding their alpha (.95 → f2 = .949): every soft
  // highlight on Pip shifts by a level. The stylesheet is small; ship it as written.
  build: { cssMinify: false },
});
