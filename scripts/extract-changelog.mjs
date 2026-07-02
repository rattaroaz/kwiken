import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const tag = process.argv[2];
if (!tag) {
  console.error("Usage: node scripts/extract-changelog.mjs vX.Y.Z");
  process.exit(1);
}

const version = tag.replace(/^v/, "");
const changelogPath = resolve(dirname(fileURLToPath(import.meta.url)), "../CHANGELOG.md");
const changelog = readFileSync(changelogPath, "utf8");
const header = `## [${version}]`;
const start = changelog.indexOf(header);

if (start === -1) {
  console.log(`Kwiken ${version}\n\nSee CHANGELOG.md for details.`);
  process.exit(0);
}

const rest = changelog.slice(start + header.length);
const next = rest.search(/\n## \[/);
const section = (next === -1 ? rest : rest.slice(0, next)).trim();
console.log(`## Kwiken ${version}\n\n${section}`);
