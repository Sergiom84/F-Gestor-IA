import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const existingNodeOptions = process.env.NODE_OPTIONS?.trim();
const heapOption = "--max-old-space-size=1024";
const nodeOptions = existingNodeOptions
  ? `${existingNodeOptions} ${heapOption}`
  : heapOption;

const child = spawn(process.execPath, [nextBin, "build"], {
  env: {
    ...process.env,
    NODE_OPTIONS: nodeOptions
  },
  shell: false,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
