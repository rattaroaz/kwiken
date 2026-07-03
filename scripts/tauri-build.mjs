import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const signedFlag = process.argv.includes("--signed");
const keyPath = resolve(root, "scripts/tauri-signing.key");

const targetIdx = process.argv.indexOf("--target");
const targetArgs =
  targetIdx !== -1 && process.argv[targetIdx + 1]
    ? ["--target", process.argv[targetIdx + 1]]
    : [];

function buildEnv() {
  const env = { ...process.env };
  if (process.platform === "win32" && env.PATH) {
    env.PATH = env.PATH.split(";")
      .filter((entry) => entry && !/[\\/]Git[\\/]usr[\\/]bin$/i.test(entry))
      .join(";");
  }
  return env;
}

function runTauri(args) {
  return new Promise((resolvePromise, reject) => {
    const tauriCli = resolve(root, "node_modules/@tauri-apps/cli/tauri.js");
    const child = spawn(process.execPath, [tauriCli, "build", ...args], {
      cwd: root,
      stdio: "inherit",
      env: buildEnv(),
    });
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`tauri build exited with code ${code}`));
    });
  });
}

const hasEnvKey = Boolean(process.env.TAURI_SIGNING_PRIVATE_KEY);
const hasKeyFile = existsSync(keyPath);

if (signedFlag || hasEnvKey) {
  if (signedFlag && hasKeyFile && !hasEnvKey) {
    process.env.TAURI_SIGNING_PRIVATE_KEY = readFileSync(keyPath, "utf8");
  }
  if (!process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
    console.warn(
      "Warning: TAURI_SIGNING_PRIVATE_KEY_PASSWORD is not set. Signed builds may fail.",
    );
  }
  console.log("Building signed release with updater artifacts…");
  await runTauri([...targetArgs, "--bundles", "nsis,msi"]);
} else {
  console.log("Building unsigned (createUpdaterArtifacts disabled)…");
  console.log("For release-parity signed builds, run: npm run build:win:signed");
  await runTauri([
    "-c",
    JSON.stringify({ bundle: { createUpdaterArtifacts: false } }),
    ...targetArgs,
    "--bundles",
    "nsis,msi",
  ]);
}
