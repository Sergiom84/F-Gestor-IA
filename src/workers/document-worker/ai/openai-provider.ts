import type { OpenAiInvoiceConfig } from "./config.js";
import {
  buildReceivedInvoiceUserPrompt,
  INVOICE_EXTRACTION_PROMPT_VERSION,
  INVOICE_EXTRACTION_SCHEMA_VERSION,
  RECEIVED_INVOICE_JSON_SCHEMA,
  RECEIVED_INVOICE_SYSTEM_PROMPT,
  receivedInvoiceExtractionSchema,
  type ReceivedInvoiceExtraction
} from "./invoice-schema.js";

export type OpenAiUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type OpenAiInvoiceExtractionResult = {
  providerKey: "openai";
  modelKey: string;
  promptVersion: typeof INVOICE_EXTRACTION_PROMPT_VERSION;
  schemaVersion: typeof INVOICE_EXTRACTION_SCHEMA_VERSION;
  responseId: string | null;
  rawResponse: unknown;
  extraction: ReceivedInvoiceExtraction;
  usage: OpenAiUsage;
  latencyMs: number;
  estimatedCostCents: number | null;
};

export async function extractReceivedInvoiceWithOpenAi(
  config: OpenAiInvoiceConfig,
  documentText: string
): Promise<OpenAiInvoiceExtractionResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/v1/responses`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        input: [
          {
            role: "system",
            content: RECEIVED_INVOICE_SYSTEM_PROMPT
          },
          {
            role: "user",
            content: buildReceivedInvoiceUserPrompt(documentText)
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "received_invoice_extraction",
            description: "Structured extraction for a Spanish received invoice.",
            strict: true,
            schema: RECEIVED_INVOICE_JSON_SCHEMA
          }
        }
      }),
      signal: controller.signal
    });

    const rawResponse = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(`OpenAI Responses API failed (${response.status}): ${formatApiError(rawResponse)}`);
    }

    const outputText = extractOutputText(rawResponse);
    const parsedJson = JSON.parse(outputText) as unknown;
    const extraction = receivedInvoiceExtractionSchema.parse(parsedJson);
    const usage = extractUsage(rawResponse);

    return {
      providerKey: "openai",
      modelKey: config.model,
      promptVersion: INVOICE_EXTRACTION_PROMPT_VERSION,
      schemaVersion: INVOICE_EXTRACTION_SCHEMA_VERSION,
      responseId: extractResponseId(rawResponse),
      rawResponse,
      extraction,
      usage,
      latencyMs: Date.now() - startedAt,
      estimatedCostCents: estimateCostCents(config, usage)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractOutputText(rawResponse: unknown): string {
  const responseRecord = asRecord(rawResponse);
  const directOutputText = responseRecord?.output_text;

  if (typeof directOutputText === "string" && directOutputText.trim()) {
    return directOutputText;
  }

  const output = responseRecord?.output;

  if (!Array.isArray(output)) {
    throw new Error("OpenAI response did not include output text");
  }

  const textParts: string[] = [];
  const refusals: string[] = [];

  for (const item of output) {
    const itemRecord = asRecord(item);
    const content = itemRecord?.content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const contentItem of content) {
      const contentRecord = asRecord(contentItem);

      if (contentRecord?.type === "output_text" && typeof contentRecord.text === "string") {
        textParts.push(contentRecord.text);
      }

      if (contentRecord?.type === "refusal" && typeof contentRecord.refusal === "string") {
        refusals.push(contentRecord.refusal);
      }
    }
  }

  if (refusals.length > 0) {
    throw new Error(`OpenAI refused the invoice extraction: ${refusals.join(" ")}`);
  }

  const outputText = textParts.join("").trim();

  if (!outputText) {
    throw new Error("OpenAI response output text was empty");
  }

  return outputText;
}

function extractUsage(rawResponse: unknown): OpenAiUsage {
  const usage = asRecord(asRecord(rawResponse)?.usage);
  const inputTokens = toNumber(usage?.input_tokens ?? usage?.prompt_tokens);
  const outputTokens = toNumber(usage?.output_tokens ?? usage?.completion_tokens);
  const totalTokens = toNumber(usage?.total_tokens) || inputTokens + outputTokens;

  return {
    inputTokens,
    outputTokens,
    totalTokens
  };
}

function estimateCostCents(config: OpenAiInvoiceConfig, usage: OpenAiUsage): number | null {
  const inputCost = config.inputCostPerMillionTokensCents;
  const outputCost = config.outputCostPerMillionTokensCents;

  if (inputCost === undefined && outputCost === undefined) {
    return null;
  }

  const inputCents = (usage.inputTokens / 1_000_000) * (inputCost ?? 0);
  const outputCents = (usage.outputTokens / 1_000_000) * (outputCost ?? 0);

  return Number((inputCents + outputCents).toFixed(6));
}

function extractResponseId(rawResponse: unknown): string | null {
  const id = asRecord(rawResponse)?.id;
  return typeof id === "string" ? id : null;
}

function formatApiError(rawResponse: unknown): string {
  const error = asRecord(asRecord(rawResponse)?.error);
  const message = error?.message;

  if (typeof message === "string") {
    return message;
  }

  return JSON.stringify(rawResponse);
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : null;
}
