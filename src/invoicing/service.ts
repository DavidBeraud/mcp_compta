import { decimal, money, roundMoney, sum } from '../core/money/index.js';
import { RuleEngine } from '../core/rules/engine.js';
import type { CalculatedLine, FinancialResponse, InvoiceCalculation, InvoiceInput, RuleDecision, TaxBreakdown } from '../domain/models.js';

const zeroVat = new Set(['EXEMPT', 'FRANCHISE', 'REVERSE_CHARGE', 'OUT_OF_SCOPE']);

export function calculateInvoice(input: InvoiceInput): FinancialResponse<InvoiceCalculation> {
  if (!input.lines.length) throw new Error('Invoice requires at least one line');
  const depositIds = (input.depositAllocations ?? []).map((allocation) => allocation.depositId);
  if (new Set(depositIds).size !== depositIds.length) throw new Error('A deposit cannot be offset more than once on the same invoice');
  const lines: CalculatedLine[] = input.lines.map((line) => {
    const quantity = decimal(line.quantity); const unitPrice = decimal(line.unitPriceExVat); const discountRate = decimal(line.discountRate ?? 0);
    if (quantity.isZero() || (input.type !== 'CREDIT_NOTE' && quantity.isNegative())) throw new Error(`Invalid quantity for line ${line.id}`);
    if (unitPrice.isNegative()) throw new Error(`Negative unit price for line ${line.id}`);
    if (discountRate.isNegative() || discountRate.greaterThan(100)) throw new Error(`Invalid discount rate for line ${line.id}`);
    if (line.vatRate !== undefined && (decimal(line.vatRate).isNegative() || decimal(line.vatRate).greaterThan(100))) throw new Error(`Invalid VAT rate for line ${line.id}`);
    const gross = quantity.times(unitPrice);
    const discount = gross.times(discountRate.div(100));
    const net = roundMoney(gross.minus(discount));
    if (!zeroVat.has(line.vatTreatment) && line.vatRate === undefined) throw new Error(`vatRate required for line ${line.id}`);
    const vat = zeroVat.has(line.vatTreatment) ? decimal(0) : roundMoney(net.times(decimal(line.vatRate!).div(100)));
    return { ...line, grossAmount: money(gross), discountAmount: money(discount), netExVat: money(net), vatAmount: money(vat), totalInclVat: money(net.plus(vat)) };
  });
  const groups = new Map<string, { treatment: CalculatedLine['vatTreatment']; rate: string | null; taxable: string[]; vat: string[] }>();
  for (const line of lines) {
    const normalizedRate = zeroVat.has(line.vatTreatment) ? null : decimal(line.vatRate!).toString();
    const key = `${line.vatTreatment}:${normalizedRate ?? '-'}`;
    const group = groups.get(key) ?? { treatment: line.vatTreatment, rate: normalizedRate, taxable: [] as string[], vat: [] as string[] };
    group.taxable.push(line.netExVat); group.vat.push(line.vatAmount); groups.set(key, group);
  }
  const taxBreakdown: TaxBreakdown[] = [...groups.values()].map((group) => ({ treatment: group.treatment, rate: group.rate, taxableAmount: money(sum(group.taxable)), vatAmount: money(sum(group.vat)) }));
  const totalExVat = sum(lines.map((line) => line.netExVat));
  const totalVat = sum(lines.map((line) => line.vatAmount));
  if ((input.depositAllocations ?? []).some((allocation) => !decimal(allocation.amount).isPositive())) throw new Error('Deposit offsets must be positive');
  const depositOffset = sum((input.depositAllocations ?? []).map((allocation) => allocation.amount));
  if (depositOffset.greaterThan(totalExVat.plus(totalVat).abs())) throw new Error('Deposit allocations exceed invoice nominal amount');
  const calculations = { lines, totalExVat: money(totalExVat), totalVat: money(totalVat), totalInclVat: money(totalExVat.plus(totalVat)), taxBreakdown, depositOffset: money(depositOffset), amountDue: money(totalExVat.plus(totalVat).minus(depositOffset)) };
  const validations = validateInvoice(input, calculations);
  const invalid = validations.some((decision) => decision.result === 'INVALID' && decision.severity === 'BLOCKING');
  const review = validations.some((decision) => decision.result === 'REQUIRES_EXPERT_REVIEW');
  return { result: invalid ? 'INVALID' : review ? 'REQUIRES_EXPERT_REVIEW' : 'VALID', calculations, validations, rulesApplied: validations.map(({ ruleId, ruleVersion }) => ({ ruleId, ruleVersion })), warnings: validations.filter((d) => d.result !== 'VALID' && d.severity !== 'BLOCKING').map((d) => d.reason) };
}

export function validateInvoice(input: InvoiceInput, calculation?: InvoiceCalculation): RuleDecision[] {
  const engine = new RuleEngine();
  const context = { jurisdiction: 'FR' as const, profile: input.profile, transactionDate: input.transactionDate, facts: { input, calculation } };
  const required = (id: string, valid: boolean, reason: string, evidence: Record<string, unknown>) => engine.register(id, () => ({ result: valid ? 'VALID' : 'INVALID', reason, evidence }));
  const issued = input.status === 'ISSUED';
  required('FR.GENERAL.INVOICE.ISSUE_DATE', !issued || !!input.issueDate, issued && !input.issueDate ? "Date d'émission absente." : "Date d'émission présente ou document non émis.", { issueDate: input.issueDate ?? null, status: input.status ?? 'DRAFT' });
  required('FR.GENERAL.INVOICE.NUMBER.REQUIRED', !issued || !!input.number, issued && !input.number ? 'Numéro absent.' : 'Numéro présent ou document non émis.', { number: input.number ?? null });
  required('FR.GENERAL.INVOICE.SELLER.IDENTITY', !issued || !!input.seller, 'Identité vendeur contrôlée.', { sellerPresent: !!input.seller });
  required('FR.GENERAL.INVOICE.BUYER.IDENTITY', !issued || !!input.customer, 'Identité client contrôlée.', { customerPresent: !!input.customer });
  required('FR.GENERAL.INVOICE.LINE.DESCRIPTION', input.lines.every((line) => line.description.trim().length > 0), 'Chaque ligne doit avoir une désignation.', { lineIds: input.lines.map((line) => line.id) });
  required('FR.GENERAL.INVOICE.LINE.QUANTITY', input.lines.every((line) => input.type === 'CREDIT_NOTE' ? !decimal(line.quantity).isZero() : decimal(line.quantity).greaterThan(0)), 'Les quantités doivent être non nulles et leur signe cohérent avec le document.', {});
  required('FR.GENERAL.VAT.TREATMENT_REQUIRED', input.lines.every((line) => !!line.vatTreatment), 'Le traitement TVA est explicite par ligne.', {});
  required('FR.GENERAL.INVOICE.TOTALS.COHERENT', !calculation || decimal(calculation.totalExVat).plus(calculation.totalVat).equals(calculation.totalInclVat), 'HT + TVA doit être égal au TTC.', calculation ? { totalExVat: calculation.totalExVat, totalVat: calculation.totalVat, totalInclVat: calculation.totalInclVat } : {});
  const ids = ['FR.GENERAL.INVOICE.ISSUE_DATE','FR.GENERAL.INVOICE.NUMBER.REQUIRED','FR.GENERAL.INVOICE.SELLER.IDENTITY','FR.GENERAL.INVOICE.BUYER.IDENTITY','FR.GENERAL.INVOICE.LINE.DESCRIPTION','FR.GENERAL.INVOICE.LINE.QUANTITY','FR.GENERAL.VAT.TREATMENT_REQUIRED','FR.GENERAL.INVOICE.TOTALS.COHERENT'];
  return engine.validate(context, ids);
}

export const calculateCreditNote = (input: InvoiceInput) => {
  if (input.type !== 'CREDIT_NOTE' || !input.originalInvoiceId) throw new Error('Credit note requires type CREDIT_NOTE and originalInvoiceId');
  return calculateInvoice({ ...input, lines: input.lines.map((line) => ({ ...line, quantity: decimal(line.quantity).abs().negated().toString() })) });
};

export const calculateDeposit = (input: InvoiceInput) => {
  if (input.type !== 'DEPOSIT_INVOICE') throw new Error('Deposit calculation requires DEPOSIT_INVOICE');
  return calculateInvoice(input);
};
