export interface SearchSuggestion {
  id: string;
  label: string;
  description?: string;
}

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

export function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function ordinal(value: number): string {
  if (value % 100 >= 11 && value % 100 <= 13) {
    return `${value}th`;
  }
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

export function dateSearchVariants(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return [value];
  }

  const day = date.getUTCDate();
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  const monthName = MONTHS[month - 1];

  return [
    value,
    `${year}-${mm}-${dd}`,
    `${dd}/${mm}/${year}`,
    `${day} ${monthName} ${year}`,
    `${dd} ${monthName} ${year}`,
    `${ordinal(day)} ${monthName} ${year}`,
    `${dd}${mm}${year}`,
    `${year}${mm}${dd}`,
  ];
}

export function searchTokens(value: unknown): string[] {
  const normalized = normalizeSearchText(value);
  return normalized ? normalized.split(" ") : [];
}

export function matchesSearchTokens(query: string, fields: unknown[]): boolean {
  const queryTokens = searchTokens(query);
  if (queryTokens.length === 0) {
    return true;
  }

  const document = normalizeSearchText(fields.filter(Boolean).join(" "));
  if (!document) {
    return false;
  }

  const documentTokens = document.split(" ");
  return queryTokens.every((queryToken) =>
    documentTokens.some(
      (documentToken) =>
        documentToken.startsWith(queryToken) || documentToken.includes(queryToken),
    ),
  );
}

export function suggestionsFor<T>({
  getDescription,
  getFields,
  getId,
  getLabel,
  items,
  limit = 6,
  query,
}: {
  items: T[];
  query: string;
  getId: (item: T) => string | number;
  getLabel: (item: T) => string;
  getDescription?: (item: T) => string | undefined;
  getFields: (item: T) => unknown[];
  limit?: number;
}): SearchSuggestion[] {
  if (searchTokens(query).length === 0) {
    return [];
  }

  return items
    .filter((item) => matchesSearchTokens(query, getFields(item)))
    .slice(0, limit)
    .map((item) => ({
      id: String(getId(item)),
      label: getLabel(item),
      description: getDescription?.(item),
    }));
}
