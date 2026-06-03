import { createClient } from "@supabase/supabase-js";
import type { WorkerConfig } from "./config.js";

export function createStorageClient(config: WorkerConfig) {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export type StorageClient = ReturnType<typeof createStorageClient>;

export async function downloadStorageObject(
  supabase: StorageClient,
  bucket: string,
  path: string
): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(bucket).download(path);

  if (error) {
    throw new Error(`Storage download failed for ${bucket}/${path}: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Storage download returned no data for ${bucket}/${path}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
