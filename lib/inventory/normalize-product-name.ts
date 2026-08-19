export function normalizeProductName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\bkits\b/g, "kit")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
