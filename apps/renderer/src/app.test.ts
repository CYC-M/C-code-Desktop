import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const srcRoot = path.resolve(here, ".");

// Brief-required shell files (relative to apps/web)
const requiredFiles = [
  "src/app.tsx",
  "src/theme.css",
  "src/sidebar/index.tsx",
  "src/topbar/index.tsx",
  "src/composer/index.tsx",
  "src/statusbar/index.tsx",
  "src/main.ts",
];

test("shell files exist", () => {
  for (const f of requiredFiles) {
    assert.ok(
      fs.existsSync(path.join(webRoot, f)),
      `missing required shell file: ${f}`,
    );
  }
});

test("theme.css carries brief tokens verbatim", () => {
  const css = fs.readFileSync(path.join(srcRoot, "theme.css"), "utf8");
  for (const token of [
    "--bg:#1e1f22",
    "--side:#17181b",
    "--content:#1e1f22",
    "--composer:#2a2c30",
    "--accent:#3b82f6",
    "--text:#e5e7eb",
    "--muted:#9ca3af",
    "--border:#2e3035",
  ]) {
    const compact = css.replace(/\s+/g, "");
    assert.ok(
      compact.includes(token),
      `theme.css missing token ${token}`,
    );
  }
});

test("tabs.json is [{id,title}] and main.ts mounts App", () => {
  const tabsRaw = fs.readFileSync(
    path.join(srcRoot, "config/tabs.json"),
    "utf8",
  );
  const tabs = JSON.parse(tabsRaw) as Array<{ id: string; title: string }>;
  assert.ok(Array.isArray(tabs) && tabs.length > 0, "tabs.json must be non-empty array");
  for (const t of tabs) {
    assert.equal(typeof t.id, "string");
    assert.equal(typeof t.title, "string");
  }
  const main = fs.readFileSync(path.join(srcRoot, "main.ts"), "utf8");
  assert.ok(
    main.includes("App"),
    "main.ts must mount App",
  );
  const app = fs.readFileSync(path.join(srcRoot, "app.tsx"), "utf8");
  assert.ok(app.includes("setActiveTab"), "app.tsx must use zustand setActiveTab for tab switch");
  assert.ok(app.includes("280"), "app.tsx sidebar must be 280px");
});
