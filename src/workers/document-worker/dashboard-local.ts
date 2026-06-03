import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { buildDashboardSnapshot } from "./dashboard/dashboard.js";

const inputPath = process.argv[2];
const periodStart = process.argv[3];
const periodEnd = process.argv[4];

if (!inputPath) {
  console.error("Usage: npm run dashboard:local -- <dashboard-data.json> [period_start] [period_end]");
  process.exit(1);
}

try {
  const input = await readJsonFile(inputPath);
  const snapshot = buildDashboardSnapshot(input, {
    period_start: periodStart,
    period_end: periodEnd
  });

  console.info(JSON.stringify(
    {
      input_file: basename(inputPath),
      snapshot
    },
    null,
    2
  ));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function readJsonFile(path: string): Promise<unknown> {
  const contents = await readFile(path, "utf8");
  return JSON.parse(contents) as unknown;
}
