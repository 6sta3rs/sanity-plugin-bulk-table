/**
 * A language code → its name in the reader's own language ("pl" → "Polish").
 *
 * `Intl.DisplayNames` ships with the browser, so there is no list to maintain
 * here — a fourth language works without anything being added.
 */
const displayNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(undefined, {type: 'language'})
    : null

export function languageName(code: string): string {
  // `of()` throws a `RangeError` on a code that isn't well-formed — and the
  // code comes from the table's config, so a typo in `languages` took the whole
  // pane down instead of showing the code in capitals.
  let name: string | undefined
  try {
    name = displayNames?.of(code)
  } catch {
    name = undefined
  }

  if (!name || name === code) return code.toUpperCase()
  return name.charAt(0).toUpperCase() + name.slice(1)
}
