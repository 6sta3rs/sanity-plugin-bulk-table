/**
 * The plugin's error handling.
 *
 * `PluginError` used to carry `operation` and `documentIds` - fields nobody
 * ever read. What is left is what actually has an audience: a console entry for
 * the developer and a message for the editor.
 */

export interface PluginError extends Error {
  context?: string
}

/** A console entry. A silent failure hides broken data from the user. */
export function logError(error: unknown, context: string): void {
  console.error(`[bulk-table] ${context}`, error)
}

/**
 * A data-fetching error - with a message the table can show.
 *
 * Returned rather than thrown: the caller puts it in state so the table can say
 * "could not load" instead of "no documents".
 */
export function handleDataFetchError(error: unknown, context: string): PluginError {
  logError(error, context)

  const pluginError = new Error(
    error instanceof Error ? error.message : String(error),
  ) as PluginError
  pluginError.context = context
  return pluginError
}
