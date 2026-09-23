import { describe, expect, it } from 'vitest';
import { calculateCreditNote, calculateInvoice } from '../src/invoicing/service.js';
import type { InvoiceInput } from '../src/domain/models.js';

const invoice = (overrides: Partial<InvoiceInput> = {}): InvoiceInput => ({
  type: 'STANDARD_INVOICE', profile: 'FR_GENERAL', status: 'DRAFT', transactionDate: '2026-08-27', currency: 'EUR',
  lines: [{ id: 'l1', description: 'Prestation', quantity: '2', unitPriceExVat: '10.005', vatTreatment: 'STANDARD', vatRate: '20' }], ...overrides,
});

describe('invoice calculation', () => {
  it('calculates and rounds line-level VAT without native floating point', () => {
    const response = calculateInvoice(invoice());
    expect(response.calculations).toMatchObject({ totalExVat: '20.01', totalVat: '4.00', totalInclVat: '24.01', amountDue: '24.01' });
    expect(response.rulesApplied.length).toBeGreaterThan(0);
  });
  it('breaks down multiple VAT treatments and never taxes franchise', () => {
    const response = calculateInvoice(invoice({ lines: [
      { id: 'a', description: 'A', quantity: '1', unitPriceExVat: '100', vatTreatment: 'STANDARD', vatRate: '20' },
      { id: 'b', description: 'B', quantity: '1', unitPriceExVat: '50', vatTreatment: 'REDUCED', vatRate: '10' },
      { id: 'c', description: 'C', quantity: '1', unitPriceExVat: '25', vatTreatment: 'FRANCHISE' },
    ] }));
    expect(response.calculations.taxBreakdown).toHaveLength(3);
    expect(response.calculations).toMatchObject({ totalExVat: '175.00', totalVat: '25.00', totalInclVat: '200.00' });
  });
  it('requires an explicit rate for taxable lines', () => expect(() => calculateInvoice(invoice({ lines: [{ id: 'a', description: 'A', quantity: '1', unitPriceExVat: '1', vatTreatment: 'STANDARD' }] }))).toThrow(/vatRate/));
  it('calculates a referenced partial credit note', () => {
    const response = calculateCreditNote(invoice({ type: 'CREDIT_NOTE', originalInvoiceId: 'inv-1', lines: [{ id: 'a', description: 'Retour', quantity: '1', unitPriceExVat: '50', vatTreatment: 'STANDARD', vatRate: '20' }] }));
    expect(response.calculations.totalInclVat).toBe('-60.00');
    expect(response.result).toBe('VALID');
  });
  it('subtracts deposits without changing invoice nominal totals', () => {
    const response = calculateInvoice(invoice({ depositAllocations: [{ depositId: 'd1', amount: '4.01' }] }));
    expect(response.calculations.totalInclVat).toBe('24.01');
    expect(response.calculations.amountDue).toBe('20.00');
  });
  it('rejects invalid discounts and duplicate deposit offsets', () => {
    expect(() => calculateInvoice(invoice({ lines: [{ id: 'a', description: 'A', quantity: '1', unitPriceExVat: '1', discountRate: '101', vatTreatment: 'STANDARD', vatRate: '20' }] }))).toThrow(/discount/);
    expect(() => calculateInvoice(invoice({ depositAllocations: [{ depositId: 'd', amount: '1' }, { depositId: 'd', amount: '1' }] }))).toThrow(/more than once/);
  });
  it('rejects issued documents missing number and issue date', () => {
    const response = calculateInvoice(invoice({ status: 'ISSUED' }));
    expect(response.result).toBe('INVALID');
    expect(response.validations.filter((d) => d.result === 'INVALID')).toHaveLength(4);
  });
});
