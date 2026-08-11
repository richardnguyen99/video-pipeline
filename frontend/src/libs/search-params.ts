/**
 * FastAPI-compatible search param serialization.
 * Arrays become repeated keys: ?actress=1&actress=2
 * (not JSON: ?actress=[1,2])
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

export function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(search)) {
    if (key.startsWith("_")) continue;
    if (value == null) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      for (const item of value) {
        if (item == null) continue;
        params.append(key, String(item));
      }
    } else if (typeof value === "boolean") {
      params.set(key, value ? "true" : "false");
    } else {
      params.set(key, String(value));
    }
  }

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function coerceValue(value: string): string | number | boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value.trim() !== "" && Number.isFinite(Number(value)) && !/^0\d+/.test(value)) {
    return Number(value);
  }
  return value;
}
