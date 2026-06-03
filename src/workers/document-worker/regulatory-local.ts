import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { prepareRegulatoryRecord } from "./regulatory/regulatory-ledger.js";

const inputPath = process.argv[2];

if (!inputPath) {
  console.error("Usage: npm run regulatory:local -- <regulatory-input.json>");
  process.exit(1);
}

try {
  const input = await readJsonFile(inputPath);
  const preparation = prepareRegulatoryRecord(input);

  console.info(JSON.stringify(
    {
      input_file: basename(inputPath),
      preparation
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
