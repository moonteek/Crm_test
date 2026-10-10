// Fails when source files still use hard-coded colours instead of the theme tokens in globals.css.
// Usage: node scripts/check-colors.mjs [file-or-folder ...]   (defaults to src/)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const PALETTE = "slate|brand|sidebar|rose|emerald|sky|amber|gray|blue|red|green|yellow";
const PREFIX = "bg|text|border|ring|fill|stroke|from|to|divide|outline|accent";
const CLASS_RE = new RegExp(`\\b(?:${PREFIX})-(?:${PALETTE})(?:-\\d{2,3})?\\b`, "g");
const HEX_RE = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/g;
const HEX_EXEMPT = `src${sep}components${sep}brand${sep}`;

const files = (path) =>
  statSync(path).isDirectory()
    ? readdirSync(path).flatMap((f) => files(join(path, f)))
    : /\.(tsx?|mjs)$/.test(path) && !path.endsWith(".test.ts") ? [path] : [];

const targets = process.argv.slice(2);
let found = 0;
for (const file of (targets.length ? targets : ["src"]).flatMap(files)) {
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    const hits = [...line.matchAll(CLASS_RE)].map((m) => m[0]);
    if (file.endsWith(".tsx") && !relative(".", file).startsWith(HEX_EXEMPT)) hits.push(...[...line.matchAll(HEX_RE)].map((m) => m[0]));
    for (const hit of hits) {
      console.log(`${relative(".", file)}:${i + 1}  ${hit}`);
      found++;
    }
  });
}
if (found) {
  console.error(`\n${found} hard-coded colour(s) found — use the theme tokens from globals.css.`);
  process.exit(1);
}
console.log("No hard-coded colours.");
