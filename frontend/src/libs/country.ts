import { countries } from "country-data-list";

const COUNTRY_OPTIONS = countries.all
  .filter((country) => country.status === "assigned" && Boolean(country.name) && Boolean(country.alpha3))
  .map((country) => ({
    alpha3: country.alpha3,
    name: country.name,
    emoji: country.emoji ?? "",
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

function formatCountryLabel(country: (typeof COUNTRY_OPTIONS)[number]): string {
  return country.emoji ? `${country.emoji} ${country.name}` : country.name;
}

export const COUNTRY_LABELS = COUNTRY_OPTIONS.map(formatCountryLabel);

export const COUNTRY_ALPHA3_BY_LABEL = new Map(
  COUNTRY_OPTIONS.map((country) => [formatCountryLabel(country), country.alpha3]),
);

export const COUNTRY_LABEL_BY_ALPHA3 = new Map(
  COUNTRY_OPTIONS.map((country) => [country.alpha3, formatCountryLabel(country)]),
);

export function resolveCountryDisplay(codeOrName: string | null | undefined): string | null {
  if (codeOrName == null || codeOrName === "") {
    return null;
  }

  const byCode = COUNTRY_LABEL_BY_ALPHA3.get(codeOrName);

  if (byCode != null) {
    return byCode;
  }

  const byName = COUNTRY_OPTIONS.find((country) => country.name === codeOrName);

  if (byName != null) {
    return formatCountryLabel(byName);
  }

  return codeOrName;
}
