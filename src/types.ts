import { ComponentType } from 'react';
import { ConfigContext } from 'sanity';
import { StructureBuilder } from 'sanity/structure';

import { SelectableField } from './helpers/getSelectableFields';

/**
 * A field that can be either a real SelectableField (from schema introspection)
 * or a mock field for built-in columns like `_createdAt`, `_document`, etc.
 */
export type TableField =
  | SelectableField
  | {
      fieldPath: string;
      title: string | undefined;
      level: number;
      sortable: boolean;
      type: string;
      field: { type: { name: string } };
    };

/**
 * Configuration options for creating a bulk actions table in Sanity Studio
 * @public
 */
export interface CreateBulkActionsTableConfig {
  /**
   * The document schema type to display in the table
   * @example 'post', 'page', 'product'
   */
  type: string;

  /**
   * Custom title for the table view in Studio navigation
   * If not provided, will use the document type name
   * @example 'Blog Posts', 'Product Catalog'
   */
  title?: string;

  /**
   * Custom icon component for the navigation item
   * Can be null, undefined, or a React component
   * If not provided, will use the default table icon
   * @example DocumentIcon, FolderIcon
   */
  icon?: ComponentType | null | undefined;

  /**
   * Sanity configuration context containing client and schema
   * Automatically provided by the structure resolver
   */
  context: ConfigContext;

  /**
   * Sanity Structure Builder instance
   * Automatically provided by the structure resolver
   */
  S: StructureBuilder;

  /**
   * Render as a document list (one row per document, no columns) instead of a
   * table. Selection and bulk actions work the same in both layouts.
   * Defaults to 'table'.
   * @example 'list'
   */
  layout?: 'table' | 'list';

  /**
   * API version for GROQ queries and Actions API calls
   * Defaults to '2025-02-19' if not provided
   * @example '2025-02-19', '2024-03-12'
   */
  apiVersion?: string;
}
