import {ComponentType} from 'react'
import {ConfigContext} from 'sanity'
import {StructureBuilder} from 'sanity/structure'

import {SelectableField} from './helpers/getSelectableFields'
import {Labels} from './labels'

/**
 * A field that can be either a real SelectableField (from schema introspection)
 * or a mock field for built-in columns like `_createdAt`, `_document`, etc.
 */
export type TableField =
  | SelectableField
  | {
      fieldPath: string
      title: string | undefined
      level: number
      sortable: boolean
      type: string
      field: {type: {name: string}}
    }

/**
 * Configuration options for creating a bulk actions table in Sanity Studio
 * @public
 */
export interface CreateBulkActionsTableConfig {
  /**
   * The document schema type to display in the table
   * @example 'post', 'page', 'product'
   */
  type: string

  /**
   * Custom title for the table view in Studio navigation
   * If not provided, will use the document type name
   * @example 'Blog Posts', 'Product Catalog'
   */
  title?: string

  /**
   * Custom icon component for the navigation item
   * Can be null, undefined, or a React component
   * If not provided, will use the default table icon
   * @example DocumentIcon, FolderIcon
   */
  icon?: ComponentType | null | undefined

  /**
   * Sanity configuration context containing client and schema
   * Automatically provided by the structure resolver
   */
  context: ConfigContext

  /**
   * Sanity Structure Builder instance
   * Automatically provided by the structure resolver
   */
  S: StructureBuilder

  /**
   * Render as a document list (one row per document, no columns) instead of a
   * table. Selection and bulk actions work the same in both layouts.
   * Defaults to 'table'.
   * @example 'list'
   */
  layout?: 'table' | 'list'

  /**
   * Language codes of the document's `internationalizedArray*` fields, in the
   * order they should be shown. Switches on the language picker in the header:
   * those columns then render the chosen language, sort by it, and can be
   * filtered down to the documents that are still missing it.
   *
   * Omit it and the table behaves exactly as before.
   * @example ['pl', 'en', 'de']
   */
  languages?: string[]

  /**
   * Overrides for the strings the table renders — pass the ones you want to
   * change, the rest fall back to `LABELS`. Useful for translating the UI, or
   * for calling the documents something other than "items".
   * @example `{create: 'New product'}`
   */
  labels?: Partial<Labels>

  /**
   * API version for GROQ queries and Actions API calls
   * Defaults to '2025-02-19' if not provided
   * @example '2025-02-19', '2024-03-12'
   */
  apiVersion?: string
}
