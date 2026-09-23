import { decimal, money, roundMoney } from '../../core/money/index.js';
export interface PriceRevisionInput { amount: string; fixedPart: string; variablePart: string; baseIndex: string; currentIndex: string; formulaVersion: string; baseMonth: string; indexSource: string; roundingScale?: number }
export function calculatePriceRevision(input: PriceRevisionInput) {
  if (decimal(input.fixedPart).plus(input.variablePart).equals(1) === false) throw new Error('fixedPart + variablePart must equal 1');
  const coefficient = decimal(input.fixedPart).plus(decimal(input.variablePart).times(decimal(input.currentIndex).div(input.baseIndex)));
  const revisedAmount = roundMoney(decimal(input.amount).times(coefficient), input.roundingScale ?? 2);
  return { revisedAmount: money(revisedAmount), coefficient: coefficient.toString(), audit: { formula: 'amount × (fixedPart + variablePart × currentIndex/baseIndex)', ...input } };
}
