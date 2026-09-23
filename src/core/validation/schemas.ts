import { z } from 'zod';

const amount = z.string().regex(/^-?\d+(\.\d+)?$/, 'decimal string expected');
const address = z.object({ line1: z.string().min(1), line2: z.string().optional(), postalCode: z.string().min(1), city: z.string().min(1), country: z.string().length(2) });
const entity = z.object({ id: z.string(), name: z.string().min(1), country: z.string().length(2), address, vatNumber: z.string().optional(), registrationNumber: z.string().optional() });
const customer = z.object({ id: z.string(), name: z.string().min(1), type: z.enum(['BUSINESS', 'CONSUMER', 'PUBLIC_ENTITY']), address, vatNumber: z.string().optional() });
export const invoiceInputSchema = z.object({
  id: z.string().optional(), number: z.string().optional(), type: z.enum(['QUOTE', 'STANDARD_INVOICE', 'DEPOSIT_INVOICE', 'PROGRESS_INVOICE', 'FINAL_INVOICE', 'CREDIT_NOTE']),
  profile: z.enum(['FR_GENERAL', 'FR_BTP_PRIVATE', 'FR_BTP_PUBLIC']), status: z.enum(['DRAFT', 'VALIDATED', 'ISSUED']).optional(), issueDate: z.string().date().optional(), transactionDate: z.string().date(), operationDate: z.string().date().optional(), currency: z.string().length(3), seller: entity.optional(), customer: customer.optional(),
  lines: z.array(z.object({ id: z.string(), description: z.string(), quantity: amount, unit: z.string().optional(), unitPriceExVat: amount, discountRate: amount.optional(), vatTreatment: z.enum(['STANDARD', 'REDUCED', 'EXEMPT', 'FRANCHISE', 'REVERSE_CHARGE', 'OUT_OF_SCOPE']), vatRate: amount.optional() })).min(1),
  paymentTerms: z.string().optional(), dueDate: z.string().date().optional(), specialMention: z.string().optional(), originalInvoiceId: z.string().optional(), depositAllocations: z.array(z.object({ depositId: z.string(), amount })).optional(),
});
export const paymentSchema = z.object({ id: z.string(), amount, currency: z.string().length(3), allocations: z.array(z.object({ id: z.string(), paymentId: z.string(), invoiceId: z.string(), amount, idempotencyKey: z.string().min(1) })) });
