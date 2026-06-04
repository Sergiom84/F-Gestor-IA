import "dotenv/config";
import { spawn } from "node:child_process";
import net from "node:net";
import { pathToFileURL } from "node:url";

export const DEFAULT_LOCAL_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export type PostgresTarget = {
  host: string;
  port: number;
  database: string;
  user: string;
};

export type SupabaseValidationStep = {
  id: string;
  label: string;
  command: string;
  args: string[];
};

export function resolveSupabaseCliInvocation(cliCommand = process.env.SUPABASE_CLI_COMMAND ?? "npx"): Pick<SupabaseValidationStep, "command" | "args"> {
  const command = cliCommand.trim();

  if (command === "") {
    throw new Error("SUPABASE_CLI_COMMAND cannot be empty.");
  }

  if (command === "npx") {
    return {
      command,
      args: ["supabase"]
    };
  }

  return {
    command,
    args: []
  };
}

export function buildSupabaseValidationPlan(cliCommand = process.env.SUPABASE_CLI_COMMAND ?? "npx"): SupabaseValidationStep[] {
  const supabase = resolveSupabaseCliInvocation(cliCommand);

  return [
    {
      id: "migration-list",
      label: "List local migration status",
      command: supabase.command,
      args: [...supabase.args, "migration", "list", "--local"]
    },
    {
      id: "db-lint",
      label: "Lint exposed schemas",
      command: supabase.command,
      args: [
        ...supabase.args,
        "db",
        "lint",
        "--local",
        "--schema",
        "public,auth,storage",
        "--level",
        "warning",
        "--fail-on",
        "error"
      ]
    },
    {
      id: "db-tests",
      label: "Run pgTAP database tests",
      command: supabase.command,
      args: [...supabase.args, "test", "db", "--local"]
    }
  ];
}

export function parsePostgresTarget(databaseUrl = process.env.DATABASE_URL ?? DEFAULT_LOCAL_DATABASE_URL): PostgresTarget {
  let url: URL;

  try {
    url = new URL(databaseUrl);
  } catch (error) {
    throw new Error(`Invalid DATABASE_URL for Supabase validation: ${(error as Error).message}`);
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error(`DATABASE_URL must use postgres:// or postgresql://, received ${url.protocol}`);
  }

  const port = url.port === "" ? 5432 : Number(url.port);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`DATABASE_URL has an invalid Postgres port: ${url.port}`);
  }

  return {
    host: url.hostname,
    port,
    database: decodeURIComponent(url.pathname.replace(/^\//, "")) || "postgres",
    user: decodeURIComponent(url.username || "postgres")
  };
}

export async function canConnectToPostgres(target: Pick<PostgresTarget, "host" | "port">, timeoutMs = 1200): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (result: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(target.port, target.host);
  });
}

export function formatValidationCommand(step: SupabaseValidationStep): string {
  return [step.command, ...step.args].join(" ");
}

export async function runValidationStep(step: SupabaseValidationStep): Promise<number> {
  console.log(`\n[${step.id}] ${step.label}`);
  console.log(`$ ${formatValidationCommand(step)}`);

  return new Promise((resolve) => {
    const child = spawn(step.command, step.args, {
      shell: process.platform === "win32",
      stdio: "inherit"
    });

    child.once("error", (error) => {
      console.error(`[${step.id}] Could not start command: ${error.message}`);
      resolve(1);
    });

    child.once("close", (code) => {
      resolve(code ?? 1);
    });
  });
}

export async function runSupabaseLocalValidation(databaseUrl = process.env.DATABASE_URL ?? DEFAULT_LOCAL_DATABASE_URL): Promise<number> {
  const target = parsePostgresTarget(databaseUrl);

  console.log("GFiscal Supabase local validation");
  console.log(`Checking Postgres at ${target.host}:${target.port}/${target.database} as ${target.user}`);

  const reachable = await canConnectToPostgres(target);

  if (!reachable) {
    console.error(`Local Supabase Postgres is not reachable at ${target.host}:${target.port}.`);
    console.error("Start the local stack first, then apply migrations and rerun this validation:");
    console.error("  npx supabase start");
    console.error("  npx supabase db reset --local --no-seed");
    console.error("  npm run supabase:validate-local");
    return 1;
  }

  for (const step of buildSupabaseValidationPlan()) {
    const code = await runValidationStep(step);

    if (code !== 0) {
      console.error(`[${step.id}] failed with exit code ${code}.`);
      return code;
    }
  }

  console.log("\nSupabase local validation passed.");
  return 0;
}

async function main(): Promise<void> {
  process.exitCode = await runSupabaseLocalValidation();
}

const entryPoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";

if (import.meta.url === entryPoint) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
