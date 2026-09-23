import { decimal, money, sum } from '../core/money/index.js';
import type { AccountMapping, AccountingEntry, AccountingEvent, InvoiceCalculation } from '../domain/models.js';

export function generateInvoiceEvent(referenceId: string, calculation: InvoiceCalculation, type: 'INVOICE_ISSUED' | 'CREDIT_NOTE_ISSUED' = 'INVOICE_ISSUED'): AccountingEvent {
  return { id: `${type}:${referenceId}`, type, occurredAt: new Date().toISOString(), referenceId, amounts: { totalExVat: calculation.totalExVat, totalVat: calculation.totalVat, totalInclVat: calculation.totalInclVat } };
}

export function mapAccountingEntries(event: AccountingEvent, mapping: AccountMapping): AccountingEntry[] {
  if (event.type !== 'INVOICE_ISSUED' && event.type !== 'CREDIT_NOTE_ISSUED') throw new Error(`Unsupported event ${event.type}`);
  const creditNote = event.type === 'CREDIT_NOTE_ISSUED';
  const total = decimal(event.amounts.totalInclVat!).abs(); const exVat = decimal(event.amounts.totalExVat!).abs(); const vat = decimal(event.amounts.totalVat!).abs();
  const entries = creditNote ? [
    { account: mapping.receivable, label: event.type, debit: '0.00', credit: money(total) },
    { account: mapping.revenue, label: event.type, debit: money(exVat), credit: '0.00' },
    { account: mapping.vatCollected, label: event.type, debit: money(vat), credit: '0.00' },
  ] : [
    { account: mapping.receivable, label: event.type, debit: money(total), credit: '0.00' },
    { account: mapping.revenue, label: event.type, debit: '0.00', credit: money(exVat) },
    { account: mapping.vatCollected, label: event.type, debit: '0.00', credit: money(vat) },
  ];
  assertBalanced(entries);
  return entries;
}

export function assertBalanced(entries: AccountingEntry[]): void {
  const debit = sum(entries.map((entry) => entry.debit)); const credit = sum(entries.map((entry) => entry.credit));
  if (!debit.equals(credit)) throw new Error(`Unbalanced entries: debit=${debit} credit=${credit}`);
}
