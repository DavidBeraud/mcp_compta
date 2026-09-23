import { describe, expect, it } from 'vitest';
import { RuleEngine } from '../src/core/rules/engine.js';
import { assertBalanced, generateInvoiceEvent, mapAccountingEntries } from '../src/accounting/service.js';
import { validateDepositAllocations, validatePayment } from '../src/payments/service.js';
import { InMemoryAuditStore } from '../src/core/audit/service.js';
import type { InvoiceInput } from '../src/domain/models.js';

describe('rule registry', () => {
  it('loads all 72 original versioned rules', () => expect(new RuleEngine().rules).toHaveLength(72));
  it('selects rules by profile and effective date', () => {
    const engine = new RuleEngine();
    expect(engine.getApplicableRules({ jurisdiction: 'FR', profile: 'FR_GENERAL', transactionDate: '2026-08-27' }).every((r) => r.module === 'FR_GENERAL')).toBe(true);
    expect(engine.getApplicableRules({ jurisdiction: 'FR', profile: 'FR_BTP_PUBLIC', transactionDate: '2026-08-27' }).some((r) => r.id.includes('.PRIVATE.'))).toBe(false);
  });
});

describe('accounting and payments invariants', () => {
  it('generates balanced entries with company-configured accounts', () => {
    const event = generateInvoiceEvent('i1', { lines: [], totalExVat: '100.00', totalVat: '20.00', totalInclVat: '120.00', taxBreakdown: [], depositOffset: '0.00', amountDue: '120.00' });
    const entries = mapAccountingEntries(event, { receivable: 'CLIENT', revenue: 'SALES', vatCollected: 'VAT', bank: 'BANK', retentionReceivable: 'RET' });
    expect(() => assertBalanced(entries)).not.toThrow(); expect(entries[0]?.account).toBe('CLIENT');
  });
  it('rejects payment overallocation', () => expect(() => validatePayment({ id: 'p', amount: '100', currency: 'EUR', allocations: [{ id: 'a', paymentId: 'p', invoiceId: 'i', amount: '100.01', idempotencyKey: 'k' }] })).toThrow(/exceed/));
  it('supports partial and multiple payment allocations', () => expect(validatePayment({ id: 'p', amount: '100', currency: 'EUR', allocations: [{ id: 'a', paymentId: 'p', invoiceId: 'i1', amount: '30', idempotencyKey: 'k1' }, { id: 'b', paymentId: 'p', invoiceId: 'i2', amount: '20', idempotencyKey: 'k2' }] })).toEqual({ allocated: '50.00', unallocated: '50.00' }));
  it('prevents deposit double allocation', () => expect(() => validateDepositAllocations([{ id: 'd', kind: 'DEPOSIT_PAYMENT', amount: '50', allocatedAmount: '40' }], [{ depositId: 'd', amount: '11' }])).toThrow(/twice|over/));
});

describe('issuance audit', () => {
  const invoice: InvoiceInput = { id: 'i1', number: 'F-1', issueDate: '2026-08-27', type: 'STANDARD_INVOICE', profile: 'FR_GENERAL', transactionDate: '2026-08-27', currency: 'EUR', lines: [{ id: 'l', description: 'x', quantity: '1', unitPriceExVat: '1', vatTreatment: 'STANDARD', vatRate: '20' }] };
  it('is idempotent and makes issued finance immutable', () => {
    const store = new InMemoryAuditStore(); const first = store.issueInvoice(invoice, 'user', 'key', []); const replay = store.issueInvoice(invoice, 'user', 'key', []);
    expect(replay).toBe(first); expect(() => store.issueInvoice(invoice, 'user', 'other-key', [])).toThrow(/immutable/); expect(store.getEvents('i1')).toHaveLength(1);
  });
});
