import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migrationSql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260629231237_sales_template_snapshots_and_transactional_docs.sql"),
  "utf8"
);

const documentTables = [
  "sales_invoices",
  "sales_quotes",
  "sales_orders",
  "sales_delivery_notes",
  "sales_recurring_invoices"
] as const;

test("sales document migration snapshots templates for every sales document table", () => {
  for (const table of documentTables) {
    assert.match(migrationSql, new RegExp(`alter table public\\.${table} add column if not exists sales_document_template_snapshot jsonb`));
    assert.match(migrationSql, new RegExp(`'${table}'`));
    assert.match(migrationSql, new RegExp(`${table}_template_org_fk`));
  }

  assert.match(migrationSql, /sales_document_templates_id_organization_unique/);
  assert.match(migrationSql, /foreign key \(sales_document_template_id, organization_id\)/);
  assert.match(migrationSql, /on delete set null \(sales_document_template_id\)/);
});

test("sales document migration adds transactional create and duplicate RPCs", () => {
  assert.match(migrationSql, /create or replace function public\.create_sales_document/);
  assert.match(migrationSql, /create or replace function public\.duplicate_sales_document/);
  assert.match(migrationSql, /jsonb_array_length/);
  assert.match(migrationSql, /El documento debe contener al menos una linea/);
  assert.match(migrationSql, /grant execute on function public\.create_sales_document/);
  assert.match(migrationSql, /grant execute on function public\.duplicate_sales_document/);
});
