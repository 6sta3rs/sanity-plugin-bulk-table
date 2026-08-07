import {useEffect, useState} from 'react'

/**
 * Settings remembered in `localStorage`: the chosen columns, the sort order,
 * the table layout. They belong to the person working with the table — resetting
 * them to the defaults on every visit to the pane would mean setting them up
 * again every time.
 *
 * One core instead of three near-identical hooks. They differ only in how a
 * stored value comes back into memory (`revive`) and how it goes out
 * (`serialize`).
 */

export interface ColumnOrder {
  key: string
  /** The direction goes straight into `order(... asc|desc)`, so it is not a plain string. */
  direction: 'asc' | 'desc'
  type: string | null
}

/**
 * `localStorage` throws more often than you would think: a Studio in an iframe
 * with third-party cookies blocked raises `SecurityError` on the read alone,
 * and a write can hit `QuotaExceededError`. A remembered column layout has no
 * business taking the pane down, so both directions are wrapped here.
 */
function read(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? undefined : JSON.parse(raw)
  } catch {
    return undefined
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Out of space, or no access to browser storage. The setting will not
    // survive a reload, and that is all — no reason to interrupt the render.
  }
}

/**
 * `revive` returns `undefined` for anything that doesn't have the right shape,
 * and then the default value takes over.
 *
 * That is not excess caution: these values end up inside a GROQ query. A
 * `{"key":"price"}` stored by an older version, with no `direction`, produced
 * `order(price undefined)` — a query error; and because the value is
 * remembered, the pane stayed broken across every reload until browser storage
 * was cleared.
 */
function useStored<T>(
  key: string,
  defaultValue: T,
  revive: (raw: unknown) => T | undefined,
  serialize: (value: T) => unknown,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => revive(read(key)) ?? defaultValue)

  useEffect(() => {
    write(key, serialize(value))
  }, [key, value, serialize])

  return [value, setValue]
}

// At module level so their identity doesn't change every render — otherwise the
// writing effect would run forever.
const identity = (value: unknown) => value
const setToArray = (value: Set<string>) => Array.from(value)

const reviveStringSet = (raw: unknown): Set<string> | undefined =>
  Array.isArray(raw) && raw.every((item) => typeof item === 'string')
    ? new Set<string>(raw)
    : undefined

const reviveColumnOrder = (raw: unknown): ColumnOrder | undefined => {
  if (!raw || typeof raw !== 'object') return undefined
  if (!('key' in raw) || !('direction' in raw) || !('type' in raw)) return undefined
  const {key, direction, type} = raw
  if (typeof key !== 'string') return undefined
  if (direction !== 'asc' && direction !== 'desc') return undefined
  if (type !== null && typeof type !== 'string') return undefined
  return {key, direction, type}
}

/** A primitive value: `boolean`, `number` or `string`. */
export function useStickyState<T extends boolean | number | string>(
  // `T`, not `true`/`300`: without it TypeScript narrows the type to the default
  // value and the setter accepts nothing else.
  defaultValue: T,
  key: string,
): [T, (value: T) => void] {
  return useStored<T>(
    key,
    defaultValue,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `typeof` is the only check available for a `boolean | number | string` union, and it narrows the runtime value without narrowing the type.
    (raw) => (typeof raw === typeof defaultValue ? (raw as T) : undefined),
    identity,
  )
}

/** A set of column names. */
export function useStickyStateSet(
  defaultValue: Set<string>,
  key: string,
): [Set<string>, (value: Set<string>) => void] {
  return useStored(key, defaultValue, reviveStringSet, setToArray)
}

/** The sort column and direction. */
export function useStickyStateOrder(
  defaultValue: ColumnOrder,
  key: string,
): [ColumnOrder, (value: ColumnOrder) => void] {
  return useStored(key, defaultValue, reviveColumnOrder, identity)
}
