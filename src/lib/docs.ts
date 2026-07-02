import { openUrl } from "@tauri-apps/plugin-opener";

export const REPO_URL = "https://github.com/rattaroaz/kwiken";
export const DOCS_BASE_URL = `${REPO_URL}/blob/main/docs`;

export async function openDoc(filename: string): Promise<void> {
  await openUrl(`${DOCS_BASE_URL}/${filename}`);
}

export async function openDocsIndex(): Promise<void> {
  await openUrl(`${DOCS_BASE_URL}/README.md`);
}
