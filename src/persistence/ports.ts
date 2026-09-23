import type { AuditEvent, InvoiceInput, ProgressHistory } from '../domain/models.js';

export interface IssuedDocumentRepository {
  findById(id: string): Promise<Readonly<InvoiceInput> | null>;
  saveImmutable(document: Readonly<InvoiceInput>, idempotencyKey: string, ruleVersions?: AuditEvent['ruleVersions']): Promise<Readonly<InvoiceInput>>;
}
export interface ProgressHistoryRepository { listValidated(contractId: string): Promise<ProgressHistory[]> }
export interface AuditRepository { append(event: AuditEvent): Promise<void>; list(entityId: string): Promise<AuditEvent[]> }
