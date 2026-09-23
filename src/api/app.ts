import Fastify from 'fastify';
import { invoiceInputSchema } from '../core/validation/schemas.js';
import { calculateCreditNote, calculateDeposit, calculateInvoice, validateInvoice } from '../invoicing/service.js';
import { calculateProgress, validateProgress } from '../btp/progress-billing/service.js';
import { evaluateBtpVat, evaluateReverseCharge } from '../btp/vat/service.js';
import { RuleEngine } from '../core/rules/engine.js';
import { generateInvoiceEvent, mapAccountingEntries } from '../accounting/service.js';
import type { AccountMapping, InvoiceCalculation, ProgressInput } from '../domain/models.js';
import { InMemoryAuditStore } from '../core/audit/service.js';

export function buildApp() {
  const app = Fastify({ logger: false }); const rules = new RuleEngine(); const audit = new InMemoryAuditStore();
  app.setErrorHandler((error, _request, reply) => reply.status(400).send({ error: error instanceof Error ? error.message : String(error) }));
  app.post('/v1/invoices/calculate', (request) => calculateInvoice(invoiceInputSchema.parse(request.body)));
  app.post('/v1/invoices/validate', (request) => { const input = invoiceInputSchema.parse(request.body); const validations = validateInvoice(input); return { result: validations.some((d) => d.result === 'INVALID') ? 'INVALID' : 'VALID', calculations: null, validations, rulesApplied: validations.map(({ ruleId, ruleVersion }) => ({ ruleId, ruleVersion })), warnings: [] }; });
  app.post('/v1/invoices/issue', (request) => { const body = request.body as { invoice: unknown; actorId: string; idempotencyKey: string }; const input = invoiceInputSchema.parse({ ...(body.invoice as object), status: 'ISSUED' }); const checked = calculateInvoice(input); if (checked.result !== 'VALID') throw new Error(`Invoice cannot be issued: ${checked.result}`); return { result: 'VALID', calculations: audit.issueInvoice(input, body.actorId, body.idempotencyKey, checked.rulesApplied), validations: checked.validations, rulesApplied: checked.rulesApplied, warnings: checked.warnings }; });
  app.post('/v1/credit-notes/calculate', (request) => calculateCreditNote(invoiceInputSchema.parse(request.body)));
  app.post('/v1/deposits/calculate', (request) => calculateDeposit(invoiceInputSchema.parse(request.body)));
  app.post('/v1/btp/progress/calculate', (request) => calculateProgress(request.body as ProgressInput));
  app.post('/v1/btp/progress/validate', (request) => validateProgress(request.body as ProgressInput));
  app.post('/v1/btp/reverse-charge/evaluate', (request) => evaluateReverseCharge(request.body as Parameters<typeof evaluateReverseCharge>[0]));
  app.post('/v1/btp/vat/evaluate', (request) => evaluateBtpVat(request.body as Parameters<typeof evaluateBtpVat>[0]));
  app.post('/v1/accounting/events/generate', (request) => { const body = request.body as { referenceId: string; calculation: InvoiceCalculation; mapping: AccountMapping }; const event = generateInvoiceEvent(body.referenceId, body.calculation); return { result: 'VALID', calculations: { event, entries: mapAccountingEntries(event, body.mapping) }, validations: [], rulesApplied: [], warnings: [] }; });
  app.post('/v1/accounting/events/post', (request) => { const body = request.body as { eventId: string; actorId: string; idempotencyKey: string; entries: unknown }; return { result: 'VALID', calculations: audit.recordAction('ACCOUNTING_EVENT_POSTED', body.eventId, body.actorId, body.idempotencyKey, body.entries, body.entries, []), validations: [], rulesApplied: [], warnings: [] }; });
  app.get('/v1/rules', () => rules.rules);
  app.get<{ Params: { id: string } }>('/v1/rules/:id', (request, reply) => rules.getRule(request.params.id) ?? reply.status(404).send({ error: 'Rule not found' }));
  app.post('/v1/rules/applicable', (request) => rules.getApplicableRules(request.body as Parameters<RuleEngine['getApplicableRules']>[0]));
  return app;
}
