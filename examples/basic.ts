import { calculateInvoice, calculateProgress } from '../src/index.js';

console.log(calculateInvoice({
  type: 'STANDARD_INVOICE', profile: 'FR_GENERAL', transactionDate: '2026-08-27', currency: 'EUR',
  lines: [{ id: 'line-1', description: 'Prestation', quantity: '2', unitPriceExVat: '100', vatTreatment: 'STANDARD', vatRate: '20' }],
}));

console.log(calculateProgress({
  transactionDate: '2026-08-27',
  contract: { id: 'contract-1', profile: 'FR_BTP_PRIVATE', originalAmount: '10000', amendments: [], lines: [{ id: 'lot-1', description: 'Gros œuvre', amount: '10000' }] },
  percentages: { 'lot-1': '25' }, validatedHistory: [],
}));
