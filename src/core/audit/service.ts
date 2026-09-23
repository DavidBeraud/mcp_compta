import type { AuditEvent, InvoiceInput } from '../../domain/models.js';

export class InMemoryAuditStore {
  private readonly events: AuditEvent[] = [];
  private readonly issued = new Map<string, Readonly<InvoiceInput>>();
  private readonly idempotency = new Map<string, unknown>();

  issueInvoice(invoice: InvoiceInput, actorId: string, idempotencyKey: string, rules: AuditEvent['ruleVersions']): Readonly<InvoiceInput> {
    const replay = this.idempotency.get(idempotencyKey) as Readonly<InvoiceInput> | undefined;
    if (replay) return replay;
    if (!invoice.id || !invoice.number || !invoice.issueDate) throw new Error('Issuance requires id, number and issueDate');
    if (this.issued.has(invoice.id)) throw new Error('Issued invoice is financially immutable; create a credit note');
    const snapshot = Object.freeze(structuredClone({ ...invoice, status: 'ISSUED' as const }));
    this.issued.set(invoice.id, snapshot); this.idempotency.set(idempotencyKey, snapshot);
    this.events.push({ id: crypto.randomUUID(), actorId, occurredAt: new Date().toISOString(), action: 'INVOICE_ISSUED', entityId: invoice.id, idempotencyKey, newState: snapshot, ruleVersions: rules, input: invoice, output: snapshot });
    return snapshot;
  }
  recordAction(action: string, entityId: string, actorId: string, idempotencyKey: string, input: unknown, output: unknown, rules: AuditEvent['ruleVersions']): unknown {
    const replay = this.idempotency.get(idempotencyKey); if (replay !== undefined) return replay;
    this.idempotency.set(idempotencyKey, output);
    this.events.push({ id: crypto.randomUUID(), actorId, occurredAt: new Date().toISOString(), action, entityId, idempotencyKey, newState: output, ruleVersions: rules, input, output });
    return output;
  }
  getEvents(entityId?: string): AuditEvent[] { return structuredClone(entityId ? this.events.filter((event) => event.entityId === entityId) : this.events); }
}
