/**
 * Column Lineage Module
 *
 * Traces how columns flow through SQL queries, from source tables to result set.
 * Supports CTEs, derived tables, subqueries, JOINs, and set operations.
 */

import {
  lineage_sql as wasmLineage,
  lineage_sql_at as wasmLineageAt,
  lineage_sql_at_with_schema as wasmLineageAtWithSchema,
  lineage_sql_with_schema as wasmLineageWithSchema,
  output_columns_sql as wasmOutputColumns,
  output_columns_sql_with_schema as wasmOutputColumnsWithSchema,
  source_tables as wasmSourceTables,
} from '../wasm/polyglot_sql_wasm.js';
import type { Expression } from './generated/Expression';
import type { Schema } from './validation/schema';

export type LineageSourceKind =
  | 'root'
  | 'table'
  | 'derived_table'
  | 'cte'
  | 'virtual'
  | 'unknown';

export type SetOperator = 'union' | 'intersect' | 'except';

export interface SetBranch {
  operator: SetOperator;
  ordinal: number;
  all: boolean;
}

/** A node in the column lineage tree */
export interface LineageNode {
  name: string;
  expression: Expression;
  source: Expression;
  downstream: LineageNode[];
  source_name: string;
  source_kind: LineageSourceKind;
  source_alias?: string;
  set_branch?: SetBranch;
  reference_node_name: string;
}

/** Result from lineage analysis */
export interface LineageResult {
  success: boolean;
  lineage?: LineageNode;
  error?: string;
  columnResolution?: ColumnResolutionInfo;
}

export type ColumnResolutionReason =
  | 'not_found'
  | 'indeterminate'
  | 'ambiguous';

export type ColumnResolutionTarget =
  | { kind: 'name'; name: string }
  | { kind: 'ordinal'; ordinal: number };

export interface ColumnResolutionInfo {
  target: ColumnResolutionTarget;
  reason: ColumnResolutionReason;
}

export type OutputColumn =
  | { kind: 'named'; name: string; ordinal: number | null }
  | { kind: 'unnamed'; ordinal: number | null }
  | {
      kind: 'wildcard';
      qualifier: string | null;
      startOrdinal: number | null;
    };

export interface QueryOutput {
  columns: OutputColumn[];
  ordinalComplete: boolean;
}

export interface QueryOutputResult {
  success: boolean;
  output?: QueryOutput;
  error?: string;
}

/** Result from source tables extraction */
export interface SourceTablesResult {
  success: boolean;
  tables?: string[];
  error?: string;
}

/**
 * Trace the lineage of a column through a SQL query.
 *
 * @param column - Column name to trace (e.g. "id", "users.name")
 * @param sql - SQL string to analyze
 * @param dialect - Dialect for parsing (default: 'generic')
 * @param trimSelects - Trim SELECT to only target column (default: false)
 *
 * @example
 * ```typescript
 * const result = lineage("a", "SELECT a FROM t");
 * // result.lineage.name === "a"
 * // result.lineage.downstream[0].name === "t.a"
 * ```
 */
export function lineage(
  column: string,
  sql: string,
  dialect: string = 'generic',
  trimSelects: boolean = false,
): LineageResult {
  const resultJson = wasmLineage(sql, column, dialect, trimSelects);
  return JSON.parse(resultJson) as LineageResult;
}

/**
 * Trace the lineage of a column through a SQL query using schema metadata.
 *
 * When a schema is provided, columns are fully qualified and type-annotated.
 * Each `LineageNode.expression` will have its `inferred_type` field populated
 * with the resolved SQL data type. Use `ast.getInferredType(node.expression)`
 * to read it.
 *
 * @param column - Column name to trace
 * @param sql - SQL string to analyze
 * @param schema - ValidationSchema-compatible schema object
 * @param dialect - Dialect for parsing/qualification (default: 'generic')
 * @param trimSelects - Trim SELECT to only target column (default: false)
 *
 * @example
 * ```typescript
 * import { lineageWithSchema, ast } from '@polyglot-sql/sdk';
 *
 * const result = lineageWithSchema("name", "SELECT name FROM users", {
 *   tables: { users: { name: "TEXT", id: "INT" } }
 * });
 *
 * if (result.success) {
 *   const dt = ast.getInferredType(result.lineage!.expression);
 *   // dt => { data_type: "text" }
 * }
 * ```
 */
export function lineageWithSchema(
  column: string,
  sql: string,
  schema: Schema,
  dialect: string = 'generic',
  trimSelects: boolean = false,
): LineageResult {
  const resultJson = wasmLineageWithSchema(
    sql,
    column,
    JSON.stringify(schema),
    dialect,
    trimSelects,
  );
  return JSON.parse(resultJson) as LineageResult;
}

/** Trace lineage for the column at a zero-based output ordinal. */
export function lineageAt(
  ordinal: number,
  sql: string,
  dialect: string = 'generic',
  trimSelects: boolean = false,
): LineageResult {
  const resultJson = wasmLineageAt(sql, ordinal, dialect, trimSelects);
  return JSON.parse(resultJson) as LineageResult;
}

/** Trace schema-aware lineage for the column at a zero-based output ordinal. */
export function lineageAtWithSchema(
  ordinal: number,
  sql: string,
  schema: Schema,
  dialect: string = 'generic',
  trimSelects: boolean = false,
): LineageResult {
  const resultJson = wasmLineageAtWithSchema(
    sql,
    ordinal,
    JSON.stringify(schema),
    dialect,
    trimSelects,
  );
  return JSON.parse(resultJson) as LineageResult;
}

/** Return the ordered output description of a query. */
export function outputColumns(
  sql: string,
  dialect: string = 'generic',
): QueryOutputResult {
  return JSON.parse(wasmOutputColumns(sql, dialect)) as QueryOutputResult;
}

/** Return the ordered output description after schema-aware wildcard expansion. */
export function outputColumnsWithSchema(
  sql: string,
  schema: Schema,
  dialect: string = 'generic',
): QueryOutputResult {
  return JSON.parse(
    wasmOutputColumnsWithSchema(sql, JSON.stringify(schema), dialect),
  ) as QueryOutputResult;
}

/**
 * Get all source tables that feed into a column.
 *
 * @param column - Column name to trace
 * @param sql - SQL string to analyze
 * @param dialect - Dialect for parsing (default: 'generic')
 *
 * @example
 * ```typescript
 * const result = getSourceTables("a", "SELECT t.a FROM t JOIN s ON t.id = s.id");
 * // result.tables === ["t"]
 * ```
 */
export function getSourceTables(
  column: string,
  sql: string,
  dialect: string = 'generic',
): SourceTablesResult {
  const resultJson = wasmSourceTables(sql, column, dialect);
  return JSON.parse(resultJson) as SourceTablesResult;
}
