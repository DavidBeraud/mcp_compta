import type { InvoiceInput } from '../domain/models.js';
export interface ElectronicInvoiceAdapter { readonly format: 'FACTUR_X' | 'UBL' | 'CII'; serialize(invoice: InvoiceInput): string }
const xml = (format: string, invoice: InvoiceInput) => `<?xml version="1.0" encoding="UTF-8"?><CanonicalInvoice transportFormat="${format}"><Id>${escapeXml(invoice.id ?? '')}</Id><Number>${escapeXml(invoice.number ?? '')}</Number><Currency>${escapeXml(invoice.currency)}</Currency></CanonicalInvoice>`;
const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char]!);
export const facturXAdapter: ElectronicInvoiceAdapter = { format: 'FACTUR_X', serialize: (invoice) => xml('FACTUR_X', invoice) };
export const ublAdapter: ElectronicInvoiceAdapter = { format: 'UBL', serialize: (invoice) => xml('UBL', invoice) };
export const ciiAdapter: ElectronicInvoiceAdapter = { format: 'CII', serialize: (invoice) => xml('CII', invoice) };
