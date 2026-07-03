export async function readTextFile(_path: string): Promise<string> {
  if (typeof sessionStorage !== "undefined") {
    const content = sessionStorage.getItem("e2e-file-content");
    if (content !== null) return content;
  }
  return "date,amount,payee,memo,category\n2026-06-20,-12.50,Coffee Shop,,Food & Dining";
}

export async function writeTextFile(_path: string, _contents: string): Promise<void> {}

export async function exists(_path: string): Promise<boolean> {
  return true;
}
