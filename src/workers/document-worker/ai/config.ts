import "dotenv/config";
import { z } from "zod";

const openAiInvoiceConfigSchema = z.object({
  apiKey: z.string().min(1),
  model: z.string().min(1).default("gpt-5.4-mini"),
  baseUrl: z.string().url().default("https://api.openai.com"),
  timeoutMs: z.coerce.number().int().positive().default(60_000),
  inputCostPerMillionTokensCents: z.coerce.number().nonnegative().optional(),
  outputCostPerMillionTokensCents: z.coerce.number().nonnegative().optional()
});

export type OpenAiInvoiceConfig = z.infer<typeof openAiInvoiceConfigSchema>;

export function loadOpenAiInvoiceConfig(): OpenAiInvoiceConfig {
  const parsed = openAiInvoiceConfigSchema.safeParse({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL,
    baseUrl: process.env.OPENAI_BASE_URL,
    timeoutMs: process.env.OPENAI_TIMEOUT_MS,
    inputCostPerMillionTokensCents: process.env.OPENAI_INPUT_COST_PER_MILLION_TOKENS_CENTS,
    outputCostPerMillionTokensCents: process.env.OPENAI_OUTPUT_COST_PER_MILLION_TOKENS_CENTS
  });

  if (!parsed.success) {
    throw new Error(`Invalid OpenAI invoice config: ${parsed.error.message}`);
  }

  return parsed.data;
}

export function loadDatabaseUrl(): string {
  const parsed = z.string().min(1).safeParse(process.env.DATABASE_URL);

  if (!parsed.success) {
    throw new Error("Invalid database config: DATABASE_URL is required");
  }

  return parsed.data;
}
