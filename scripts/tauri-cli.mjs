import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const args = process.argv.slice(2);
const tauriCli = resolve(root, "node_modules/@tauri-apps/cli/tauri.js");

function hasClangOnPath() {
  try {
    execSync("where clang", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function findVsVarsAll() {
  const vswhere =
    "C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe";
  if (existsSync(vswhere)) {
    try {
      const installPath = execSync(
        `"${vswhere}" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`,
        { encoding: "utf8" },
      ).trim();
      const vcvars = resolve(
        installPath,
        "VC/Auxiliary/Build/vcvarsall.bat",
      );
      if (existsSync(vcvars)) return vcvars;
    } catch {
      // fall through to common install paths
    }
  }

  for (const ver of ["18", "2022", "2019"]) {
    for (const edition of ["Community", "Professional", "Enterprise", "BuildTools"]) {
      const vcvars = `C:\\Program Files\\Microsoft Visual Studio\\${ver}\\${edition}\\VC\\Auxiliary\\Build\\vcvarsall.bat`;
      if (existsSync(vcvars)) return vcvars;
    }
  }
  return null;
}

function findLlvmBin() {
  const candidates = [
    "C:\\Program Files\\LLVM\\bin",
    "C:\\Program Files (x86)\\LLVM\\bin",
  ];
  return candidates.find((dir) => existsSync(resolve(dir, "clang.exe"))) ?? null;
}

function needsWindowsToolchain() {
  return (
    process.platform === "win32" &&
    (!hasClangOnPath() || !process.env.VCINSTALLDIR)
  );
}

function runTauri(env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [tauriCli, ...args], {
      cwd: root,
      stdio: "inherit",
      env,
    });
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`tauri exited with code ${code}`));
    });
  });
}

function runTauriViaCmd(vcvars, llvmBin) {
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  const tauriArgs = args.map((a) => `"${a}"`).join(" ");
  const command = [
    `call "${vcvars}" ${arch}`,
    `set "PATH=${llvmBin};%PATH%"`,
    `cd /d "${root}"`,
    `"${process.execPath}" "${tauriCli}" ${tauriArgs}`,
  ].join(" && ");

  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, {
      cwd: root,
      stdio: "inherit",
      shell: true,
    });
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`tauri exited with code ${code}`));
    });
  });
}

try {
  if (needsWindowsToolchain()) {
    const vcvars = findVsVarsAll();
    const llvmBin = findLlvmBin();

    if (!vcvars) {
      console.error(
        "Visual Studio C++ build tools not found. Install the Desktop development with C++ workload.",
      );
      process.exit(1);
    }
    if (!llvmBin) {
      console.error(
        "LLVM/clang not found. On ARM64 Windows it is required for Rust builds.\nInstall with: winget install LLVM.LLVM",
      );
      process.exit(1);
    }

    await runTauriViaCmd(vcvars, llvmBin);
  } else {
    await runTauri(process.env);
  }
} catch (err) {
  process.exit(err.message?.includes("code") ? 1 : 1);
}
