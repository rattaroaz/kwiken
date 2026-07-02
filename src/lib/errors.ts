export function formatErrorForUser(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function copyErrorToClipboard(error: unknown): Promise<boolean> {
  const text = formatErrorForUser(error);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
