export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

export function getSupabasePublicConfig(): SupabasePublicConfig {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.SUPABASE_PUBLISHABLE_KEY
    ?? process.env.SUPABASE_ANON_KEY;
  const expectedProjectRef = process.env.SUPABASE_PROJECT_REF ?? process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF;

  if (!url) {
    throw new Error("Missing Supabase URL. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL.");
  }

  assertSupabaseUrlMatchesProject(url, expectedProjectRef);

  if (!publishableKey) {
    throw new Error(
      "Missing Supabase publishable key. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY."
    );
  }

  return {
    url,
    publishableKey
  };
}

function assertSupabaseUrlMatchesProject(url: string, expectedProjectRef: string | undefined) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`Invalid Supabase URL: ${url}`);
  }

  if (!expectedProjectRef || !parsedUrl.hostname.endsWith(".supabase.co")) {
    return;
  }

  const actualProjectRef = parsedUrl.hostname.split(".")[0];

  if (actualProjectRef !== expectedProjectRef) {
    throw new Error(
      `Supabase URL project mismatch. Expected ${expectedProjectRef}, got ${actualProjectRef}. ` +
        "Check for stale SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL values in the process environment."
    );
  }
}
