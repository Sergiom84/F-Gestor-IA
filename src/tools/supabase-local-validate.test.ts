import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildSupabaseValidationPlan,
  formatValidationCommand,
  parsePostgresTarget,
  resolveSupabaseCliInvocation
} from "./supabase-local-validate.js";

test("builds a non-destructive Supabase local validation plan", () => {
  const plan = buildSupabaseValidationPlan();

  assert.deepEqual(plan.map((step) => step.id), [
    "migration-list",
    "db-lint",
    "db-tests"
  ]);
  assert.equal(plan.some((step) => formatValidationCommand(step).includes("db reset")), false);
  assert.equal(plan.some((step) => formatValidationCommand(step).includes("db push")), false);
});

test("configures linting to fail only on database errors", () => {
  const lintStep = buildSupabaseValidationPlan().find((step) => step.id === "db-lint");

  assert.ok(lintStep);
  assert.deepEqual(lintStep.args.slice(-2), ["--fail-on", "error"]);
  assert.equal(lintStep.args.includes("--local"), true);
  assert.equal(lintStep.args.includes("public,auth,storage"), true);
});

test("can use the installed Supabase CLI instead of npx", () => {
  const plan = buildSupabaseValidationPlan("supabase");

  assert.equal(plan.every((step) => step.command === "supabase"), true);
  assert.equal(plan.some((step) => step.args[0] === "supabase"), false);
});

test("defaults npx to an explicit Supabase subcommand", () => {
  assert.deepEqual(resolveSupabaseCliInvocation("npx"), {
    command: "npx",
    args: ["supabase"]
  });
});

test("parses the local Supabase database target", () => {
  assert.deepEqual(
    parsePostgresTarget("postgresql://postgres:postgres@127.0.0.1:54322/postgres"),
    {
      host: "127.0.0.1",
      port: 54322,
      database: "postgres",
      user: "postgres"
    }
  );
});

test("defaults Postgres port when DATABASE_URL omits it", () => {
  assert.equal(
    parsePostgresTarget("postgresql://worker:secret@localhost/gfiscal").port,
    5432
  );
});
