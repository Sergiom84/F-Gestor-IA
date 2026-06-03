import "dotenv/config";
import { z } from "zod";

const configSchema = z.object({
  supabaseUrl: z.string().url(),
  supabaseServiceRoleKey: z.string().min(1),
  databaseUrl: z.string().min(1),
  queueName: z.string().min(1).default("document_processing"),
  visibilityTimeoutSeconds: z.coerce.number().int().positive().default(300),
  batchSize: z.coerce.number().int().positive().max(10).default(1),
  pollSeconds: z.coerce.number().int().min(0).max(60).default(5),
  pollIntervalMs: z.coerce.number().int().positive().default(250),
  idleSleepMs: z.coerce.number().int().min(0).default(1000),
  maxChunkChars: z.coerce.number().int().min(1000).default(5000),
  retryBaseSeconds: z.coerce.number().int().positive().default(30)
});

export type WorkerConfig = z.infer<typeof configSchema>;

export function loadConfig(): WorkerConfig {
  const parsed = configSchema.safeParse({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    databaseUrl: process.env.DATABASE_URL,
    queueName: process.env.DOCUMENT_WORKER_QUEUE_NAME,
    visibilityTimeoutSeconds: process.env.DOCUMENT_WORKER_VISIBILITY_TIMEOUT_SECONDS,
    batchSize: process.env.DOCUMENT_WORKER_BATCH_SIZE,
    pollSeconds: process.env.DOCUMENT_WORKER_POLL_SECONDS,
    pollIntervalMs: process.env.DOCUMENT_WORKER_POLL_INTERVAL_MS,
    idleSleepMs: process.env.DOCUMENT_WORKER_IDLE_SLEEP_MS,
    maxChunkChars: process.env.DOCUMENT_WORKER_MAX_CHUNK_CHARS,
    retryBaseSeconds: process.env.DOCUMENT_WORKER_RETRY_BASE_SECONDS
  });

  if (!parsed.success) {
    throw new Error(`Invalid document worker config: ${parsed.error.message}`);
  }

  return parsed.data;
}
