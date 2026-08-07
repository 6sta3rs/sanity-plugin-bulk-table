/**
 * Tables of documents whose texts live in `internationalizedArray*` fields
 * (sanity-plugin-internationalized-array): one document, one row, N languages
 * inside a single field.
 *
 * Without this the table renders such a field through `<Preview>` and every row
 * reads "Untitled" — the value is an array of `{_key, language, value}`, not a
 * string, and nothing in the plugin knew that.
 */

export interface I18nItem {
  _key?: string
  language?: string
  value?: unknown
}

/** `internationalizedArrayString`, `internationalizedArrayText`, … */
export const isI18nArray = (typeName: string): boolean =>
  typeName.startsWith('internationalizedArray')

// Since v5 of the plugin the `_key` is random and the language lives in its own
// field; `_key` is only a fallback for documents written by older versions.
const languageOf = (item: I18nItem) => item.language ?? item._key

/** The text in one language, or `''` when that version doesn't exist yet. */
export function i18nValue(value: unknown, language: string): string {
  if (!Array.isArray(value)) return ''
  const item = (value as I18nItem[]).find((i) => languageOf(i) === language)
  return typeof item?.value === 'string' ? item.value.trim() : ''
}

/**
 * GROQ path to one language's value, for `order()`. Sorting on it groups every
 * document missing that language together — which is the point: the gap is the
 * thing you're looking for, not the alphabet.
 *
 * The language is interpolated, not bound, because `order()` takes no params.
 * It comes from the table's own config, but it is still checked here — this is
 * the one place in the plugin that puts a caller-supplied string into a query.
 */
export function i18nOrderKey(field: string, language: string): string {
  if (!/^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(language)) return field
  return `${field}[language == "${language}"][0].value`
}

/** Filter: documents with nothing written in `language` yet. */
export function missingLanguageFilter(field: string, language: string): string {
  if (!/^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(language)) return ''
  return ` && count(${field}[language == "${language}" && defined(value)]) == 0`
}

/** Key the coverage projection lands under, per translatable field. */
export const coverageKey = (field: string) => `_i18n_${field}`

/**
 * Projection of "which languages does this field already have".
 *
 * The languages, not the texts: a row needs to know that `descriptionHtml` has
 * PL and EN, not what they say. Fetching the values would mean pulling every
 * translation of every description for fifty rows to render three dots.
 */
export function coverageProjection(fields: string[]): string {
  return fields
    .filter((field) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field))
    .map((field) => `"${coverageKey(field)}": ${field}[defined(value)].language`)
    .join(', ')
}

/**
 * Share of translatable fields that have a version in `language`, 0–1.
 *
 * Fields the document leaves empty in every language don't count — an optional
 * description nobody filled in is not a missing translation, and counting it
 * would cap every document below 100% for no reason.
 */
export function coverageOf(
  row: Record<string, unknown>,
  fields: string[],
  language: string,
): {ratio: number; filled: number; total: number} {
  let filled = 0
  let total = 0

  for (const field of fields) {
    const languages = row[coverageKey(field)]
    if (!Array.isArray(languages) || languages.length === 0) continue

    total += 1
    if (languages.includes(language)) filled += 1
  }

  return {ratio: total === 0 ? 0 : filled / total, filled, total}
}
