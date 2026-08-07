<div align="center">
  <h1>Sanity Bulk Actions Table Plugin</h1>
  <h3>A powerful table view with bulk actions for managing Sanity documents</h3>
  <p><em>Maintained by <a href="https://github.com/0x6Star3s" target="_blank">0x6Star3s</a></em></p>
  <p><em>Based on <a href="https://github.com/contentwrap/sanity-plugin-bulk-actions-table" target="_blank">ContentWrap's plugin</a>, itself forked from <a href="https://github.com/ricokahler/sanity-super-pane" target="_blank">Sanity Super Pane</a></em></p>

  <img src="https://img.shields.io/npm/v/sanity-plugin-bulk-table" alt="Sanity Bulk Actions Table" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Sanity-F03E2F?logo=sanity&logoColor=white" alt="Sanity" />
  <img src="https://img.shields.io/npm/l/sanity-plugin-bulk-table?style&color=5D6D7E" alt="GitHub license" />

  <br>
  <br>
  <img src="demo.gif" alt="Bulk Actions Table Demo" />
</div>

---

## Features

- **📊 Table View**: Display your documents in a sortable, searchable table format with real-time updates
- **⚡ Bulk Actions**: Select multiple documents and perform batch operations (publish, unpublish, delete, discard changes)
- **🎛️ Dynamic Columns**: Interactive column selector to show/hide document fields with instant preview
- **🔍 Advanced Search**: Real-time search across text, slug, and number fields with smart filtering
- **📄 Smart Pagination**: Customizable page sizes (50 or 100 rows) with efficient loading
- **📝 Draft Management**: Seamlessly work with both published and draft documents with visual indicators
- **🔔 Error Handling**: Toast notifications for operation feedback and comprehensive error management
- **↕️ Flexible Sorting**: Click column headers to sort ascending/descending with visual indicators
- **🗂️ List Layout**: Swap the table for a plain document list (`layout: 'list'`) keeping selection and bulk actions
- **🌍 Translations**: Point `languages` at your `internationalizedArray*` fields for a language picker, per-language sorting, coverage badges and a "needs translation" filter
- **🔠 Custom Copy**: Override any string in the UI through `labels` — translate the table or rename "items"
- **⚙️ Table Settings**: Full-width columns, a column width limit and dense rows, from the pane's "⋯" menu

---

## Installation

```sh
npm install sanity-plugin-bulk-table
# or
yarn add sanity-plugin-bulk-table
# or
pnpm add sanity-plugin-bulk-table
```

---

## Usage

### Important: Structure Tool Integration

This plugin integrates with Sanity's **Structure Tool**, not as a regular plugin. It's configured in the `structure` function of your Sanity config, **not** in the `plugins` array.

### Basic Setup

Add the bulk actions table to your `sanity.config.ts` file using the structure configuration:

```typescript
import {defineConfig} from 'sanity'
import {createBulkActionsTable} from 'sanity-plugin-bulk-table'
import {structureTool} from 'sanity/structure'

export default defineConfig({
  // ... your other configuration

  plugins: [
    structureTool({
      structure: (S, context) => {
        return S.list()
          .title('Content')
          .items([
            // Add a bulk actions table for your document type
            createBulkActionsTable({
              type: 'post', // Your document type
              S,
              context,
              title: 'Posts Table', // Optional: custom title
              icon: YourIcon, // Optional: custom icon
            }),
            // ... your other structure items
          ])
      },
    }),
    // ... your other plugins
  ],
})
```

### Alternative: Separate Structure File

For larger projects, you can organize your structure in a separate file:

```typescript
// sanity.config.ts
import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'

import {structure} from './structure'

export default defineConfig({
  plugins: [
    structureTool({structure}),
    // ... other plugins
  ],
})
```

```typescript
// structure.ts
import {createBulkActionsTable} from 'sanity-plugin-bulk-table'
import type {StructureResolver} from 'sanity/structure'

export const structure: StructureResolver = (S, context) =>
  S.list()
    .title('Content')
    .items([
      createBulkActionsTable({
        type: 'post',
        S,
        context,
        title: 'Blog Posts',
      }),
      // ... other items
    ])
```

### Configuration Options

The `createBulkActionsTable` function accepts the following options:

```typescript
interface CreateBulkActionsTableConfig {
  type: string // Required: The document type to display
  S: StructureBuilder // Required: Sanity structure builder
  context: ConfigContext // Required: Sanity context with client and schema
  title?: string // Optional: Custom title for the table view (defaults to document type)
  icon?: ComponentType | null | undefined // Optional: Custom icon component for the navigation
  layout?: 'table' | 'list' // Optional: 'list' renders a document list instead of a table (defaults to 'table')
  languages?: string[] // Optional: language codes of the document's internationalizedArray* fields
  labels?: Partial<Labels> // Optional: overrides for the strings the table renders
  apiVersion?: string // Optional: API version for GROQ queries (defaults to context version)
}
```

#### Configuration Reference

| Parameter    | Type                                 | Required | Default              | Description                                                                                                                                | Example                             |
| ------------ | ------------------------------------ | -------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| `type`       | `string`                             | ✅ Yes   | -                    | Document schema type name to manage in the table                                                                                           | `'post'`, `'page'`, `'product'`     |
| `S`          | `StructureBuilder`                   | ✅ Yes   | -                    | Structure builder instance from structure resolver                                                                                         | Automatically provided by Sanity    |
| `context`    | `ConfigContext`                      | ✅ Yes   | -                    | Configuration context with client and schema                                                                                               | Automatically provided by Sanity    |
| `title`      | `string`                             | ❌ No    | Document type name   | Custom title for Studio navigation                                                                                                         | `'Blog Posts'`, `'Product Catalog'` |
| `icon`       | `ComponentType \| null \| undefined` | ❌ No    | Default table icon   | React component for navigation icon                                                                                                        | `DocumentIcon`, `FolderIcon`        |
| `layout`     | `'table' \| 'list'`                  | ❌ No    | `'table'`            | `'list'` shows a plain document list with the same selection and bulk actions (no columns, no sorting). Its list item id is `<type>-list`. | `'list'`                            |
| `languages`  | `string[]`                           | ❌ No    | -                    | Language codes of the document's `internationalizedArray*` fields, in display order. Switches on the language controls described below.    | `['en', 'de']`                      |
| `labels`     | `Partial<Labels>`                    | ❌ No    | `LABELS`             | Overrides for the strings the table renders; the rest fall back to the English defaults.                                                   | `{create: 'New product'}`           |
| `apiVersion` | `string`                             | ❌ No    | Client's API version | GROQ API version for queries                                                                                                               | `'2024-03-12'`, `'2023-05-03'`      |

#### Type Definitions

For TypeScript users, you can import the configuration interface:

```typescript
import {CreateBulkActionsTableConfig, LABELS, type Labels} from 'sanity-plugin-bulk-table'
```

### Example with Multiple Document Types

```typescript
export default defineConfig({
  structure: (S, context) => {
    return S.list()
      .title('Content Management')
      .items([
        createBulkActionsTable({
          type: 'post',
          S,
          context,
          title: 'Blog Posts',
        }),
        createBulkActionsTable({
          type: 'page',
          S,
          context,
          title: 'Pages',
        }),
        createBulkActionsTable({
          type: 'product',
          S,
          context,
          title: 'Products',
        }),
        S.divider(),
        // ... other structure items
      ])
  },
})
```

---

## Translated Documents

If a document keeps its texts in `internationalizedArray*` fields
([sanity-plugin-internationalized-array](https://github.com/sanity-io/sanity-plugin-internationalized-array)),
pass the language codes and the table learns about them:

```typescript
createBulkActionsTable({
  type: 'product',
  S,
  context,
  languages: ['en', 'de', 'fr'],
})
```

That turns on:

- a **language picker** in the header — the text columns render that language and sort by it;
- a **Languages column** with one badge per language: filled when every translatable field of
  that document has a version in it, outlined when some or none, with the exact percentage
  under the cursor;
- a **"Needs translation" filter**, narrowing the list to the documents with nothing written in
  the chosen language, so the "N items" count answers "how many are left";
- **search across every language**, not only the chosen one.

Without `languages` the table behaves exactly as it did before: an `internationalizedArray*`
field would otherwise render as "Untitled" in every row, because its value is an array of
`{_key, language, value}` rather than a string.

Coverage counts **filled** fields only — an optional description nobody wrote in any language is
not a missing translation.

---

## Custom Copy

Every string the table renders lives in one object. Pass the ones you want to change:

```typescript
import {createBulkActionsTable} from 'sanity-plugin-bulk-table'

createBulkActionsTable({
  type: 'product',
  S,
  context,
  labels: {
    create: 'New product',
    items: (count) => (count === 1 ? '1 product' : `${count} products`),
  },
})
```

The defaults are exported as `LABELS` (typed `Labels`), so a full translation is
`labels: {...myPolishLabels}` and a partial one only overrides what it lists. The copy inside the
bulk-action confirmation dialogs is not part of `labels` yet.

---

## Features in Detail

### 🎛️ Dynamic Column Selection

The column selector provides complete control over your table view:

- **Interactive Interface**: Click the column filter button to open a dropdown with all available fields
- **Field Type Support**: Automatically detects and displays text, number, date, boolean, and reference fields
- **Instant Preview**: Columns are added/removed immediately as you toggle them
- **Persistent Settings**: Your column preferences are saved per document type
- **Smart Defaults**: Initially shows the most relevant fields based on your schema

### 🔍 Advanced Search & Filtering

Powerful search capabilities across your document fields:

- **Multi-Field Search**: Searches across all text, slug, and number fields simultaneously
- **Real-Time Results**: Results update instantly as you type
- **Smart Matching**: Uses partial matching with wildcard support for flexible searches
- **Field-Specific Search**: Automatically handles different field types (strings, slugs, numbers)
- **Parameterized Queries**: The search term is bound as a GROQ parameter, never spliced into the query, so quotes and braces are ordinary characters rather than something to strip

### ↕️ Flexible Sorting

Comprehensive sorting functionality:

- **Column Header Sorting**: Click any column header to sort by that field
- **Visual Indicators**: Clear ascending (↑) and descending (↓) arrows show current sort direction
- **Toggle Sorting**: Click the same header again to reverse the sort order
- **Multi-Type Support**: Handles text, number, date, and boolean field sorting appropriately
- **Persistent State**: Sort preferences are remembered per document type

### 📄 Smart Pagination

Efficient handling of large document collections:

- **Customizable Page Sizes**: Choose from 50 or 100, or custom row counts
- **Navigation Controls**: First, previous, next, and last page buttons
- **Page Information**: Shows current page, total pages, and total document count
- **Performance Optimized**: Only loads visible documents for faster response times
- **Smooth Navigation**: Maintains selections and filters when changing pages

### ⚡ Bulk Actions & Selection

Comprehensive bulk operations for efficient document management:

#### Selection Interface

- **Select Mode Toggle**: Click "Select" to enter bulk selection mode
- **Individual Selection**: Check/uncheck documents individually
- **Select All**: Quickly select all documents on current page or across all pages
- **Visual Feedback**: Selected documents are clearly highlighted
- **Selection Counter**: Shows count of selected documents

#### Available Actions

- **📤 Publish**: Publish selected draft documents with validation
- **📥 Unpublish**: Unpublish selected published documents
- **🗑️ Delete**: Permanently delete selected documents (with confirmation dialog)
- **↩️ Discard Changes**: Revert draft changes to published version
- **Batch Processing**: All actions support multiple documents simultaneously

#### Safety Features

- **Confirmation Dialogs**: Destructive actions require explicit confirmation
- **Progress Indicators**: Shows operation progress for large batches
- **Error Handling**: Individual failures don't stop the entire batch operation

### 🔔 Error Handling & Notifications

Comprehensive feedback system for all operations:

- **Toast Notifications**: Success and error messages for all operations
- **Operation Status**: Real-time feedback during bulk operations
- **Network Error Handling**: Graceful handling of connection issues
- **Permission Errors**: Clear messages for insufficient permissions
- **Validation Feedback**: Helpful messages for invalid operations
- **Recovery Suggestions**: Actionable advice when operations fail

### 📝 Draft Management

Seamless integration with Sanity's draft system:

- **Visual Draft Indicators**: Clear distinction between published and draft documents
- **Draft-Only Actions**: Publish and discard actions only appear for applicable documents
- **Mixed State Handling**: Bulk operations intelligently handle mixed published/draft selections
- **Real-Time Updates**: Document states update immediately after operations

---

## Performance & Best Practices

### Optimization Features

- **Lazy Loading**: Documents are loaded on-demand as you navigate pages
- **Smart Caching**: Query results are cached to reduce redundant API calls
- **Efficient Pagination**: Only fetches the documents needed for the current page
- **Debounced Search**: Search queries are debounced to prevent excessive API calls
- **Selective Field Loading**: Only loads the fields you've selected as columns

### Best Practices

- **Column Selection**: Choose only the columns you need to improve loading times
- **Page Size**: Use smaller page sizes (10-25) for better performance with large datasets
- **Search Strategy**: Use specific search terms to reduce result sets
- **Bulk Operations**: Process documents in smaller batches for better reliability

### Performance Tips

- **Schema Design**: Ensure searchable fields are indexed in your Sanity dataset
- **Network**: The plugin respects your Sanity client configuration for API endpoints and CDN
- **Memory**: The plugin automatically manages memory by releasing unused data when navigating

---

## Requirements

- Sanity Studio v4, v5 or v6
- React 19.2+ and React DOM 19.2+
- styled-components v6.1+
- Node.js 20.19+ or 22.12+
- TypeScript (recommended)

> **Note:** the package is ESM-only. Sanity Studio v3 is no longer supported — use v1.x of this plugin for v3.

---

## Acknowledgments

This plugin is built upon the excellent foundation created by **[Rico Kahler](https://github.com/ricokahler)** with the original [Sanity Super Pane](https://github.com/ricokahler/sanity-super-pane) plugin.

The original plugin provided innovative bulk action capabilities for Sanity Studio v2, but was not compatible with later Studio versions. This project forks and modernizes that work while maintaining the core functionality that made the original so valuable.

Special thanks to Rico for creating such a useful tool for the Sanity community.

---

## License

MIT — see [LICENSE](LICENSE) for the full attribution chain.

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

```sh
pnpm install
pnpm run lint       # oxlint
pnpm run format     # oxfmt
pnpm run typecheck  # tsc --noEmit
pnpm run test       # vitest
pnpm run build      # @sanity/pkg-utils
```

## Issues

If you encounter any issues, please report them on [GitHub Issues](https://github.com/0x6Star3s/sanity-plugin-bulk-table/issues).
