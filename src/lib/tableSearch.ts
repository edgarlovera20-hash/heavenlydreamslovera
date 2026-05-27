export type PaginationItem = number | 'ellipsis';

export function normalizeTableSearch(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizeDigits(value: unknown) {
  return String(value ?? '').replace(/\D/g, '');
}

export function tableSearchTokens(query: string) {
  return normalizeTableSearch(query).split(/\s+/).filter(Boolean);
}

export function matchesTableSearch(query: string, values: unknown[]) {
  const tokens = tableSearchTokens(query);
  if (tokens.length === 0) return true;

  const textIndex = normalizeTableSearch(values.join(' '));
  const digitIndex = normalizeDigits(values.join(' '));

  return tokens.every((token) => {
    const digits = normalizeDigits(token);
    return textIndex.includes(token) || Boolean(digits && digitIndex.includes(digits));
  });
}

export function getPaginationItems(currentPage: number, totalPages: number, siblings = 1): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages]);
  const start = Math.max(2, currentPage - siblings);
  const end = Math.min(totalPages - 1, currentPage + siblings);

  for (let page = start; page <= end; page += 1) {
    pages.add(page);
  }

  const ordered = Array.from(pages).sort((a, b) => a - b);
  const items: PaginationItem[] = [];

  ordered.forEach((page, index) => {
    const previous = ordered[index - 1];
    if (previous && page - previous > 1) items.push('ellipsis');
    items.push(page);
  });

  return items;
}
