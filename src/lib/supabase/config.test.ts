import assert from "node:assert/strict";
import test from "node:test";
import { getSupabasePublicConfig } from "./config";

const ENV_KEYS = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_PROJECT_REF",
  "NEXT_PUBLIC_SUPABASE_PROJECT_REF",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY"
] as const;

function withEnv(env: Partial<Record<(typeof ENV_KEYS)[number], string>>, run: () => void) {
  const previous = new Map<string, string | undefined>();

  for (const key of ENV_KEYS) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }

  Object.assign(process.env, env);

  try {
    run();
  } finally {
    for (const key of ENV_KEYS) {
      const value = previous.get(key);

      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("uses server Supabase URL before stale public URL", () => {
  withEnv(
    {
      SUPABASE_URL: "https://yhnqdntfxeojhfgdvkva.supabase.co",
      NEXT_PUBLIC_SUPABASE_URL: "https://bvnsodtjlpiraojrnsrs.supabase.co",
      SUPABASE_PROJECT_REF: "yhnqdntfxeojhfgdvkva",
      SUPABASE_ANON_KEY: "test-key"
    },
    () => {
      const config = getSupabasePublicConfig();

      assert.equal(config.url, "https://yhnqdntfxeojhfgdvkva.supabase.co");
    }
  );
});

test("rejects Supabase URL from a different project ref", () => {
  withEnv(
    {
      SUPABASE_URL: "https://bvnsodtjlpiraojrnsrs.supabase.co",
      SUPABASE_PROJECT_REF: "yhnqdntfxeojhfgdvkva",
      SUPABASE_ANON_KEY: "test-key"
    },
    () => {
      assert.throws(
        () => getSupabasePublicConfig(),
        /Supabase URL project mismatch\. Expected yhnqdntfxeojhfgdvkva, got bvnsodtjlpiraojrnsrs/
      );
    }
  );
});
