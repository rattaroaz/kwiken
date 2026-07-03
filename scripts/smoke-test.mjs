import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const target = process.env.CARGO_BUILD_TARGET;
const exe = target
  ? resolve(root, `src-tauri/target/${target}/release/kwiken.exe`)
  : resolve(root, "src-tauri/target/release/kwiken.exe");
const startupMs = Number(process.env.SMOKE_STARTUP_MS ?? 5000);

if (!existsSync(exe)) {
  console.error(`Smoke test: executable not found at ${exe}`);
  console.error("Run: npm run build && cargo build --release --manifest-path src-tauri/Cargo.toml");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

const child = spawn(exe, [], {
  cwd: root,
  stdio: "ignore",
  detached: false,
});

let exited = false;
child.on("exit", (code) => {
  exited = true;
  if (code !== null && code !== 0) {
    console.error(`Smoke test failed: app exited with code ${code} within ${startupMs}ms`);
    process.exit(1);
  }
});

await sleep(startupMs);

if (exited) {
  process.exit(1);
}

try {
  child.kill();
} catch {
  // process may already be gone
}

console.log(`Smoke test passed: app stayed running for ${startupMs}ms`);
