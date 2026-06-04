import { z } from "zod";
import { loadDatabaseUrl } from "./ai/config.js";
import { createDb } from "./db.js";
import { persistRegulatoryEventForInvoice } from "./regulatory/repository.js";
import { regulatoryModeSchema } from "./regulatory/regulatory-schema.js";

const invoiceId = process.argv[2];
const regulatoryModeInput = process.argv[3] ?? "verifactu_pending";
const parsedArgs = z.object({
  invoiceId: z.string().uuid(),
  regulatoryMode: regulatoryModeSchema
}).safeParse({
  invoiceId,
  regulatoryMode: regulatoryModeInput
});

if (!parsedArgs.success) {
  console.error("Usage: npm run regulatory:persist-invoice -- <invoice_id> [regulatory_mode]");
  process.exit(1);
}

const db = createDb({ databaseUrl: loadDatabaseUrl() });

try {
  const result = await persistRegulatoryEventForInvoice(db, {
    invoiceId: parsedArgs.data.invoiceId,
    regulatoryMode: parsedArgs.data.regulatoryMode,
    actor: {
      user_id: null,
      role: "system",
      system_id: "gfiscal-worker"
    }
  });

  console.info(JSON.stringify(
    {
      invoice_id: result.savedEvent.invoiceId,
      organization_id: result.savedEvent.organizationId,
      regulatory_event_id: result.savedEvent.id,
      event_type: result.savedEvent.eventType,
      previous_hash: result.savedEvent.previousHash,
      hash: result.savedEvent.hash,
      readiness: result.preparation.readiness,
      export_format: result.eventRow.export_format,
      official_submission_ready: result.eventRow.official_submission_ready
    },
    null,
    2
  ));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await db.end({ timeout: 5 });
}
