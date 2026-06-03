import { loadConfig } from "./config.js";
import { createDb } from "./db.js";
import { archiveMessage, readMessages, requeueMessage } from "./queue.js";
import { processQueueMessage } from "./processor.js";
import { createStorageClient } from "./storage.js";

const config = loadConfig();
const db = createDb(config);
const supabase = createStorageClient(config);

let shuttingDown = false;

process.on("SIGINT", () => {
  shuttingDown = true;
});

process.on("SIGTERM", () => {
  shuttingDown = true;
});

async function main() {
  console.info("document-worker starting", {
    queueName: config.queueName,
    batchSize: config.batchSize
  });

  while (!shuttingDown) {
    const messages = await readMessages(
      db,
      config.queueName,
      config.visibilityTimeoutSeconds,
      config.batchSize,
      config.pollSeconds,
      config.pollIntervalMs
    );

    if (messages.length === 0) {
      await sleep(config.idleSleepMs);
      continue;
    }

    for (const message of messages) {
      console.info("document-worker processing message", {
        msgId: message.msgId,
        jobId: message.message.job_id,
        documentId: message.message.document_id,
        readCount: message.readCount
      });

      const result = await processQueueMessage(config, db, supabase, message);

      if (result.shouldRetry) {
        await requeueMessage(db, config.queueName, message.message, result.retryDelaySeconds ?? config.retryBaseSeconds);
      }

      await archiveMessage(db, config.queueName, message.msgId);
    }
  }

  await db.end({ timeout: 5 });
  console.info("document-worker stopped");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch(async (error) => {
  console.error("document-worker fatal error", error);
  await db.end({ timeout: 5 });
  process.exitCode = 1;
});
