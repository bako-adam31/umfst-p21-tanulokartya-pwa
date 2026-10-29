import { defineConfig } from "vite";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export default defineConfig({
  base: '/umfst-p21-tanulokartya-pwa/',
  build: { manifest: true },
  plugins: [
    {
      name: "copy-service-worker-and-public-assets",
      closeBundle() {
        mkdirSync("dist/samples", { recursive: true });
        mkdirSync("dist/icons", { recursive: true });
        copyFileSync(
          resolve("samples/tanulokartya.json"),
          resolve("dist/samples/tanulokartya.json"),
        );
        copyFileSync(
          resolve("manifest.webmanifest"),
          resolve("dist/manifest.webmanifest"),
        );
        for (const icon of ["icon.svg", "icon-192.png", "icon-512.png"])
          copyFileSync(resolve(`icons/${icon}`), resolve(`dist/icons/${icon}`));
        const manifest = JSON.parse(
          readFileSync(resolve("dist/.vite/manifest.json"), "utf8"),
        );
        const assets = new Set();
        for (const item of Object.values(manifest))
          for (const path of [
            item.file,
            ...(item.css || []),
            ...(item.assets || []),
          ])
            if (path) assets.add(`./${path}`);
        const worker = readFileSync(resolve("sw.js"), "utf8").replace(
          "'./icons/icon-512.png'];",
          `'./icons/icon-512.png', ${[...assets].map((path) => JSON.stringify(path)).join(", ")}];`,
        );
        writeFileSync(resolve("dist/sw.js"), worker);
        const htmlPath = resolve("dist/index.html");
        writeFileSync(
          htmlPath,
          readFileSync(htmlPath, "utf8").replace(
            /<link rel="manifest" href="[^"]+"\s*\/>/,
            '<link rel="manifest" href="./manifest.webmanifest" />',
          ),
        );
      },
    },
  ],
});
