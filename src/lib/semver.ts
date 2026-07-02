export type SemverTuple = [number, number, number];

export function parseSemver(version: string): SemverTuple | null {
  let v = version.trim();
  if (v.startsWith("v") || v.startsWith("V")) {
    v = v.slice(1);
  }
  const main = v.split("-")[0].split("+")[0];
  const parts = main.split(".");
  if (parts.length < 2 || parts.length > 3) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0)) return null;
  const major = nums[0];
  const minor = nums[1];
  const patch = nums.length === 3 ? nums[2] : 0;
  return [major, minor, patch];
}

export function isVersionNewer(candidate: string, installed: string): boolean {
  const c = parseSemver(candidate);
  const i = parseSemver(installed);
  if (!c || !i) return false;
  for (let idx = 0; idx < 3; idx++) {
    if (c[idx] > i[idx]) return true;
    if (c[idx] < i[idx]) return false;
  }
  return false;
}
