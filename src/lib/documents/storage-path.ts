export type DocumentStoragePathContext = {
  organizationId: string;
  fiscalEntityId: string;
  documentId: string;
  documentFileId: string;
  filename: string;
};

export type ParsedDocumentStoragePath = {
  organizationId: string;
  fiscalEntityId: string;
  documentId: string;
  documentFileId: string;
  filename: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function sanitizeStorageFilename(filename: string): string {
  const sanitized = filename
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);

  return sanitized || "document.pdf";
}

export function buildDocumentStoragePath(context: DocumentStoragePathContext): string {
  const filename = sanitizeStorageFilename(context.filename);

  return [
    "organizations",
    context.organizationId,
    "fiscal-entities",
    context.fiscalEntityId,
    "documents",
    context.documentId,
    "files",
    `${context.documentFileId}-${filename}`
  ].join("/");
}

export function parseDocumentStoragePath(storagePath: string): ParsedDocumentStoragePath | null {
  const parts = storagePath.split("/");

  if (
    parts.length !== 8 ||
    parts[0] !== "organizations" ||
    parts[2] !== "fiscal-entities" ||
    parts[4] !== "documents" ||
    parts[6] !== "files"
  ) {
    return null;
  }

  const [organizationId, fiscalEntityId, documentId] = [parts[1], parts[3], parts[5]];
  const filePart = parts[7] ?? "";
  const documentFileId = filePart.slice(0, 36);
  const filename = filePart.slice(37);

  if (
    !isUuid(organizationId) ||
    !isUuid(fiscalEntityId) ||
    !isUuid(documentId) ||
    !isUuid(documentFileId) ||
    filePart.charAt(36) !== "-" ||
    !filename
  ) {
    return null;
  }

  return {
    organizationId,
    fiscalEntityId,
    documentId,
    documentFileId,
    filename
  };
}

export function validateDocumentStoragePath(
  storagePath: string,
  expected: Omit<DocumentStoragePathContext, "filename">
): { valid: boolean; errors: string[] } {
  const parsed = parseDocumentStoragePath(storagePath);

  if (!parsed) {
    return {
      valid: false,
      errors: ["storage_path does not match the expected GFiscal document path format"]
    };
  }

  const errors: string[] = [];

  if (parsed.organizationId !== expected.organizationId) {
    errors.push("storage_path organization_id does not match the document organization_id");
  }

  if (parsed.fiscalEntityId !== expected.fiscalEntityId) {
    errors.push("storage_path fiscal_entity_id does not match the document fiscal_entity_id");
  }

  if (parsed.documentId !== expected.documentId) {
    errors.push("storage_path document_id does not match the document id");
  }

  if (parsed.documentFileId !== expected.documentFileId) {
    errors.push("storage_path document_file_id does not match the document_file id");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function assertDocumentStoragePath(
  storagePath: string,
  expected: Omit<DocumentStoragePathContext, "filename">
): void {
  const validation = validateDocumentStoragePath(storagePath, expected);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }
}

function isUuid(value: string | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
