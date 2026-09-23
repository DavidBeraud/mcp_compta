import { Prisma, PrismaClient } from '@prisma/client';
import type { AuditEvent, InvoiceInput, ProgressHistory } from '../domain/models.js';
import type { AuditRepository, IssuedDocumentRepository, ProgressHistoryRepository } from './ports.js';

const inputJson = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export class PrismaIssuedDocumentRepository implements IssuedDocumentRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async findById(id: string): Promise<Readonly<InvoiceInput> | null> {
    const row = await this.prisma.issuedDocument.findUnique({ where: { id } });
    return row ? row.snapshot as unknown as Readonly<InvoiceInput> : null;
  }
  async saveImmutable(document: Readonly<InvoiceInput>, idempotencyKey: string, ruleVersions: AuditEvent['ruleVersions'] = []): Promise<Readonly<InvoiceInput>> {
    const replay = await this.prisma.issuedDocument.findUnique({ where: { idempotencyKey } });
    if (replay) return replay.snapshot as unknown as Readonly<InvoiceInput>;
    if (!document.id || !document.number || !document.issueDate || !document.seller) throw new Error('Persisted issuance requires id, number, issueDate and seller');
    const row = await this.prisma.issuedDocument.create({ data: { id: document.id, legalEntityId: document.seller.id, number: document.number, series: document.number.split('-')[0] ?? 'DEFAULT', documentType: document.type, issueDate: new Date(`${document.issueDate}T00:00:00Z`), snapshot: inputJson(document), ruleVersions: inputJson(ruleVersions), idempotencyKey } });
    return row.snapshot as unknown as Readonly<InvoiceInput>;
  }
}

export class PrismaProgressHistoryRepository implements ProgressHistoryRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async listValidated(contractId: string): Promise<ProgressHistory[]> {
    const rows = await this.prisma.validatedProgress.findMany({ where: { contractId }, orderBy: { sequence: 'asc' } });
    return rows.map((row) => ({ statementId: row.id, validated: true, currentCumulative: row.currentCumulative.toFixed(2), lineCumulatives: row.lineCumulatives as Record<string, string> | undefined }));
  }
}

export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async append(event: AuditEvent): Promise<void> {
    await this.prisma.auditEvent.create({ data: { id: event.id, actorId: event.actorId, action: event.action, entityId: event.entityId, idempotencyKey: event.idempotencyKey, previousState: event.previousState === undefined ? Prisma.JsonNull : inputJson(event.previousState), newState: inputJson(event.newState), ruleVersions: inputJson(event.ruleVersions), input: inputJson(event.input), output: inputJson(event.output), occurredAt: new Date(event.occurredAt) } });
  }
  async list(entityId: string): Promise<AuditEvent[]> {
    const rows = await this.prisma.auditEvent.findMany({ where: { entityId }, orderBy: { occurredAt: 'asc' } });
    return rows.map((row) => ({ id: row.id, actorId: row.actorId, occurredAt: row.occurredAt.toISOString(), action: row.action, entityId: row.entityId, idempotencyKey: row.idempotencyKey, previousState: row.previousState, newState: row.newState, ruleVersions: row.ruleVersions as unknown as AuditEvent['ruleVersions'], input: row.input, output: row.output }));
  }
}
