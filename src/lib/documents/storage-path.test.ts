import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDocumentStoragePath,
  parseDocumentStoragePath,
  sanitizeStorageFilename,
  validateDocumentStoragePath
} from "./storage-path.js";

const context = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  fiscalEntityId: "22222222-2222-4222-8222-222222222222",
  documentId: "33333333-3333-4333-8333-333333333333",
  documentFileId: "44444444-4444-4444-8444-444444444444",
  filename: "factura junio 2026.pdf"
};

test("builds and parses a tenant-scoped document storage path", () => {
  const storagePath = buildDocumentStoragePath(context);

  assert.equal(
    storagePath,
    "organizations/11111111-1111-4111-8111-111111111111/fiscal-entities/22222222-2222-4222-8222-222222222222/documents/33333333-3333-4333-8333-333333333333/files/44444444-4444-4444-8444-444444444444-factura-junio-2026.pdf"
  );
  assert.deepEqual(parseDocumentStoragePath(storagePath), {
    organizationId: context.organizationId,
    fiscalEntityId: context.fiscalEntityId,
    documentId: context.documentId,
    documentFileId: context.documentFileId,
    filename: "factura-junio-2026.pdf"
  });
});

test("rejects storage paths from another organization or fiscal entity", () => {
  const storagePath = buildDocumentStoragePath(context);
  const validation = validateDocumentStoragePath(storagePath, {
    organizationId: "55555555-5555-4555-8555-555555555555",
    fiscalEntityId: context.fiscalEntityId,
    documentId: context.documentId,
    documentFileId: context.documentFileId
  });

  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /organization_id/);
});

test("sanitizes unsafe filenames without leaving an empty name", () => {
  assert.equal(sanitizeStorageFilename("../Factura número 1.pdf"), "Factura-numero-1.pdf");
  assert.equal(sanitizeStorageFilename("////"), "document.pdf");
});
