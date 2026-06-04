import { loadConfig } from "./config.js";
import { createDb } from "./db.js";
import { archiveMessage, readMessages, requeueMessage } from "./queue.js";
import { processQueueMessage } from "./processor.js";
import { createStorageClient } from "./storage.js";
import { logError, logInfo } from "./logger.js";

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
  logInfo("document_worker.starting", {
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
      logInfo("document_worker.message_received", {
        msg_id: message.msgId,
        job_id: message.message.job_id,
        document_id: message.message.document_id,
        organization_id: message.message.organization_id,
        read_count: message.readCount
      });

      const result = await processQueueMessage(config, db, supabase, message);

      if (result.shouldRetry) {
        await requeueMessage(db, config.queueName, message.message, result.retryDelaySeconds ?? config.retryBaseSeconds);
        logInfo("document_worker.message_requeued", {
          msg_id: message.msgId,
          job_id: message.message.job_id,
          document_id: message.message.document_id,
          organization_id: message.message.organization_id,
          retry_delay_seconds: result.retryDelaySeconds ?? config.retryBaseSeconds
        });
      }

      await archiveMessage(db, config.queueName, message.msgId);
      logInfo("document_worker.message_archived", {
        msg_id: message.msgId,
        job_id: message.message.job_id,
        document_id: message.message.document_id,
        organization_id: message.message.organization_id
      });
    }
  }

  await db.end({ timeout: 5 });
  logInfo("document_worker.stopped");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch(async (error) => {
  logError("document_worker.fatal_error", error);
  await db.end({ timeout: 5 });
  process.exitCode = 1;
});
