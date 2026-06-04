import type { DbClient } from "./db.js";
import { documentJobMessageSchema, type DocumentJobMessage, type QueueMessage } from "./types.js";

type PgmqRecord = {
  msg_id: number | string;
  read_ct: number | string;
  message: unknown;
};

export async function readMessages(
  db: DbClient,
  queueName: string,
  visibilityTimeoutSeconds: number,
  batchSize: number,
  pollSeconds: number,
  pollIntervalMs: number
): Promise<QueueMessage[]> {
  const rows = await db<PgmqRecord[]>`
    select * from pgmq.read_with_poll(
      ${queueName},
      ${visibilityTimeoutSeconds},
      ${batchSize},
      ${pollSeconds},
      ${pollIntervalMs}
    )
  `;

  return rows.map((row) => {
    const parsed = documentJobMessageSchema.parse(row.message);

    return {
      msgId: Number(row.msg_id),
      readCount: Number(row.read_ct),
      message: parsed
    };
  });
}

export async function archiveMessage(db: DbClient, queueName: string, msgId: number): Promise<void> {
  await db`select pgmq.archive(${queueName}::text, ${msgId}::bigint)`;
}

export async function requeueMessage(
  db: DbClient,
  queueName: string,
  message: DocumentJobMessage,
  delaySeconds: number
): Promise<void> {
  await db`select * from pgmq.send(${queueName}::text, ${db.json(message)}::jsonb, ${delaySeconds}::integer)`;
}
