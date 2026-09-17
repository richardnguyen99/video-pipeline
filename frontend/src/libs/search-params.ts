/**
 * FastAPI-compatible search param serialization.
 * Arrays become repeated keys: ?actress=1&actress=2
 * (not JSON: ?actress=[1,2])
 *
 * For ``q``, spaces are encoded as ``%20`` and ``+`` as ``%2B`` so the
 * multi-term operator is never confused with a space in the address bar.
 * Example: ``aimi yoshikawa+mird`` → ``q=aimi%20yoshikawa%2Bmird``
 */

export function parseSearch(searchStr: string): Record<string, unknown> {
  const raw = searchStr.startsWith("?") ? searchStr.slice(1) : searchStr;
  if (!raw) return {};

  const params = new URLSearchParams(raw);
  const result: Record<string, unknown> = {};

  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    if (values.length > 1) {
      result[key] = values.map(coerceValue);
    } else {
      result[key] = coerceValue(values[0]);
    }
  }

  return result;
}

/**
 * Encode a free-text search query for the URL.
 *
 * Uses ``encodeURIComponent`` so spaces become ``%20`` and ``+`` becomes
 * ``%2B``, matching the backend term-split on ``+`` only.
 */
export function encodeSearchQuery(q: string): string {
  return encodeURIComponent(q);
}

export function stringifySearch(search: Record<string, unknown>): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(search)) {
    if (key.startsWith("_")) continue;
    if (value == null) continue;

    if (key === "q") {
      const text = String(value).trim();

      if (text) {
        parts.push(`q=${encodeSearchQuery(text)}`);
      }

      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) continue;

      for (const item of value) {
        if (item == null) continue;
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
      }

      continue;
    }

    if (typeof value === "boolean") {
      parts.push(`${encodeURIComponent(key)}=${value ? "true" : "false"}`);
      continue;
    }

    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }

  if (parts.length === 0) {
    return "";
  }

  return `?${parts.join("&")}`;
}

function coerceValue(value: string): string | number | boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value.trim() !== "" && Number.isFinite(Number(value)) && !/^0\d+/.test(value)) {
    return Number(value);
  }
  return value;
}
