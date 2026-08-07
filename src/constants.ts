import {SanityClient} from '@sanity/client'
import {Schema} from 'sanity'

import {Emitter} from './createEmitter'
import {ColumnOrder} from './hooks/useStickyState'
import {Labels} from './labels'

export const rowsPerPage = [50, 100]
export const orderColumnDefault: ColumnOrder = {
  key: '',
  direction: 'asc',
  type: null,
}

/**
 * The upper bound on a column's width in "full width columns" mode.
 *
 * Without it a description column stretches to the longest sentence in the
 * table and every other column runs off the screen — one cell decides how far
 * you have to scroll. 300px is about half a sentence: enough to tell which
 * description it is, while the remaining columns stay in view.
 */
export const MAX_COLUMN_WIDTH = 300

/** Bounds of the slider in the table settings dialog. */
export const MAX_COLUMN_WIDTH_MIN = 120
export const MAX_COLUMN_WIDTH_MAX = 800
export const MAX_COLUMN_WIDTH_STEP = 20

export interface Options {
  type: string
  title?: string
  layout: 'table' | 'list'
  schema: Schema
  client: SanityClient
  refresh: Emitter
  /** The pane menu ("⋯") opens the view settings dialog. */
  openSettings: Emitter
  languages?: string[]
  labels?: Partial<Labels>
}

export const defaultDatetimesObj = {
  _updatedAt: {
    key: '_updatedAt',
    title: 'Updated',
    sortable: true,
  },
  _createdAt: {
    key: '_createdAt',
    title: 'Created',
    sortable: true,
  },
  // Not sortable: the value is derived from the draft/published pair after the
  // page has been fetched, so the dataset has nothing to order by.
  _lastPublishedAt: {
    key: '_lastPublishedAt',
    title: 'Last published',
    sortable: false,
  },
}

export const defaultDatetimeFields = Object.values(defaultDatetimesObj)
