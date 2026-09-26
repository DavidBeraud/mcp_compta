import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { calculateInvoice, calculateCreditNote, calculateDeposit, validateInvoice } from '../invoicing/service.js';
import { calculateProgress, validateProgress } from '../btp/progress-billing/service.js';
import { validatePayment } from '../payments/service.js';
import { evaluateBtpVat, evaluateReverseCharge } from '../btp/vat/service.js';
import { RuleEngine } from '../core/rules/engine.js';
import type { InvoiceInput, ProgressInput, RuleDecision } from '../domain/models.js';
import { generateInvoiceEvent, mapAccountingEntries } from '../accounting/service.js';
import type { AccountMapping, InvoiceCalculation } from '../domain/models.js';

export const ACCOUNTING_MCP_NAME = 'accounting-core-fr';
export const ACCOUNTING_MCP_VERSION = '1.1.0';

const json = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }], structuredContent: value as Record<string, unknown> });
const object = z.record(z.unknown());

export function createAccountingMcpServer() {
  const server = new McpServer({ name: ACCOUNTING_MCP_NAME, version: ACCOUNTING_MCP_VERSION });
  server.registerTool('calculate_invoice', { inputSchema: { input: object } }, ({ input }) => json(calculateInvoice(input as unknown as InvoiceInput)));
  server.registerTool('validate_invoice', { inputSchema: { input: object } }, ({ input }) => json(validateInvoice(input as unknown as InvoiceInput)));
  server.registerTool('calculate_credit_note', { inputSchema: { input: object } }, ({ input }) => json(calculateCreditNote(input as unknown as InvoiceInput)));
  server.registerTool('calculate_deposit', { inputSchema: { input: object } }, ({ input }) => json(calculateDeposit(input as unknown as InvoiceInput)));
  server.registerTool('calculate_progress_invoice', { inputSchema: { input: object } }, ({ input }) => json(calculateProgress(input as unknown as ProgressInput)));
  server.registerTool('validate_progress_invoice', { inputSchema: { input: object } }, ({ input }) => json(validateProgress(input as unknown as ProgressInput)));
  server.registerTool('validate_payment', { inputSchema: { input: object } }, ({ input }) => json(validatePayment(input as never)));
  server.registerTool('evaluate_vat', { inputSchema: { input: object } }, ({ input }) => json(evaluateBtpVat(input as unknown as Parameters<typeof evaluateBtpVat>[0])));
  server.registerTool('evaluate_btp_reverse_charge', { inputSchema: { input: object } }, ({ input }) => json(evaluateReverseCharge(input as unknown as Parameters<typeof evaluateReverseCharge>[0])));
  server.registerTool('get_accounting_rule', { inputSchema: { id: z.string() } }, ({ id }) => json(new RuleEngine().getRule(id) ?? { error: 'Rule not found' }));
  server.registerTool('get_applicable_rules', { inputSchema: { profile: z.enum(['FR_GENERAL','FR_BTP_PRIVATE','FR_BTP_PUBLIC']), transactionDate: z.string() } }, ({ profile, transactionDate }) => json(new RuleEngine().getApplicableRules({ jurisdiction: 'FR', profile, transactionDate })));
  server.registerTool('explain_validation_error', { inputSchema: { decision: object } }, ({ decision }) => json({ explanation: new RuleEngine().explainDecision(decision as unknown as RuleDecision) }));
  server.registerTool('generate_accounting_entries', { inputSchema: { referenceId: z.string(), calculation: object, mapping: object } }, ({ referenceId, calculation, mapping }) => { const event = generateInvoiceEvent(referenceId, calculation as unknown as InvoiceCalculation); return json({ event, entries: mapAccountingEntries(event, mapping as unknown as AccountMapping) }); });
  return server;
}
