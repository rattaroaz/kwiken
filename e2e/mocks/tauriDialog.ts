type DialogFilter = { name: string; extensions: string[] };

interface OpenOptions {
  directory?: boolean;
  multiple?: boolean;
  filters?: DialogFilter[];
}

interface SaveOptions {
  defaultPath?: string;
  filters?: DialogFilter[];
}

export async function open(options?: OpenOptions): Promise<string | string[] | null> {
  if (options?.directory) {
    return "C:\\e2e\\backup-folder";
  }
  return "C:\\e2e\\mock-import.csv";
}

export async function save(_options?: SaveOptions): Promise<string | null> {
  return "C:\\e2e\\kwiken-backup.db";
}

export async function ask(_message: string, _options?: { title?: string; kind?: string }): Promise<boolean> {
  return true;
}

export async function message(_message: string, _options?: { title?: string }): Promise<void> {}
