import { defineConfig } from "astro/config";

// GitHub Pages project sites are served from /SolidGround. Local development
// and previews use "/". Set SITE_BASE at build time.
const base = process.env.SITE_BASE ?? "/";

export default defineConfig({
  site: "https://joeyhammoth.github.io",
  base,
  outDir: "./dist",
  build: { format: "directory" },
  devToolbar: { enabled: false },
});
