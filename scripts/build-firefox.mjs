// Builds the Firefox target: three self-contained IIFE bundles (background, content
// script, options) via Vite's library-mode API called once per entry — deliberately not
// using @crxjs/vite-plugin (Chromium-specific manifest handling) or a single multi-entry
// Rollup build (IIFE output doesn't support the shared chunks Rollup would otherwise want
// to create between these three entries, since they share imports like storage.ts and
// webextension-polyfill). Each bundle inlines everything it needs.
import { build } from "vite";
import { readFile, writeFile, mkdir, copyFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const outDir = path.join(rootDir, "dist-firefox");
const resolve = (...parts) => path.join(rootDir, ...parts);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const entries = [
  { name: "background", entry: resolve("src/adapters/webextension/background.ts") },
  { name: "content-script", entry: resolve("src/adapters/webextension/content-script.ts") },
  { name: "options", entry: resolve("src/adapters/webextension/options/options.ts") },
];

for (const { name, entry } of entries) {
  await build({
    configFile: false,
    resolve: { alias: { "@": resolve("src") } },
    build: {
      outDir,
      emptyOutDir: false,
      target: "firefox115",
      lib: {
        entry,
        formats: ["iife"],
        name: `SonarCatch_${name.replace(/-/g, "_")}`,
        fileName: () => `${name}.js`,
      },
      rollupOptions: {
        output: { extend: true },
      },
    },
  });
}

// --- manifest.json: transform Chrome's manifest.json into Firefox's shape ---
const chromeManifest = JSON.parse(await readFile(resolve("manifest.json"), "utf-8"));

const firefoxManifest = {
  ...chromeManifest,
  options_page: "options.html",
  background: {
    // Firefox MV3 does not support the "service_worker" key at all (confirmed against
    // MDN — see README's Firefox section) and instead runs "scripts" as a non-persistent
    // event page. Not using "type": "module" here since these bundles are plain IIFE, not
    // ES modules.
    scripts: ["background.js"],
  },
  content_scripts: chromeManifest.content_scripts.map((cs) => ({
    ...cs,
    js: ["content-script.js"],
    css: ["ui.css"],
  })),
  browser_specific_settings: {
    gecko: {
      id: "{8cce6740-d0dd-42bc-83c5-91ee68af95ad}",
      // optional_host_permissions (used for the runtime Sonar-URL permission grant) was
      // only added in Firefox 128 — see README's Firefox section.
      strict_min_version: "128.0",
      // This extension sends job-posting text to a user-configured Sonar instance, never
      // to any Mozilla/AMO telemetry endpoint — "none" is accurate, not a placeholder.
      data_collection_permissions: { required: ["none"] },
    },
  },
};
delete firefoxManifest.web_accessible_resources; // Chrome-only artifact of crxjs's build; unused here

await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(firefoxManifest, null, 2));

// --- static assets ---
await mkdir(path.join(outDir, "icons"), { recursive: true });
for (const size of [16, 32, 48, 128]) {
  await copyFile(resolve(`icons/icon${size}.png`), path.join(outDir, "icons", `icon${size}.png`));
}
await copyFile(resolve("src/adapters/webextension/ui.css"), path.join(outDir, "ui.css"));
await copyFile(resolve("src/adapters/webextension/options/options.css"), path.join(outDir, "options.css"));

const optionsHtml = (await readFile(resolve("src/adapters/webextension/options/options.html"), "utf-8")).replace(
  '<script type="module" src="options.ts"></script>',
  '<script src="options.js"></script>',
);
await writeFile(path.join(outDir, "options.html"), optionsHtml);

console.log(`Firefox build written to ${outDir}`);
