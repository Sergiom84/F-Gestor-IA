import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migrationSql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260629225925_sales_line_retention_checks.sql"),
  "utf8"
);

const lineTables = [
  "sales_invoice_lines",
  "sales_quote_lines",
  "sales_order_lines",
  "sales_delivery_note_lines",
  "sales_recurring_invoice_lines"
] as const;

test("sales line retention migration guards every line table", () => {
  for (const table of lineTables) {
    assert.match(migrationSql, new RegExp(`'${table}'`));
    assert.match(migrationSql, new RegExp(`'${table}_retention_rate_range'`));
  }

  assert.match(migrationSql, /retention_rate >= 0 and retention_rate <= 100/);
  assert.match(migrationSql, /validate constraint/);
});
