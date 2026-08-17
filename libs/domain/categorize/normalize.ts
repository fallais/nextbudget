export function normalizeDescription(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 +\-./&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
