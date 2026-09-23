import { decimal, money, roundMoney } from '../../core/money/index.js';
import type { AdvanceRecoveryInput } from '../../domain/models.js';

export function calculateAdvanceRecovery(input: AdvanceRecoveryInput | undefined, periodAmount: string): string {
  if (!input) return '0.00';
  let amount;
  if (input.strategy === 'FIXED_AMOUNT') {
    if (input.value === undefined) throw new Error('FIXED_AMOUNT recovery requires value');
    amount = decimal(input.value);
  } else if (input.strategy === 'PERCENTAGE_OF_PERIOD') {
    if (input.value === undefined) throw new Error('PERCENTAGE_OF_PERIOD recovery requires value');
    amount = roundMoney(decimal(periodAmount).times(decimal(input.value).div(100)));
  } else {
    if (!input.formulaReference) throw new Error('CONTRACT_FORMULA recovery requires formulaReference');
    throw new Error('Contract formula must be resolved by configured deterministic strategy');
  }
  return money(DecimalMin(amount, decimal(input.remainingAdvance), decimal(periodAmount)));
}
const DecimalMin = (...values: ReturnType<typeof decimal>[]) => values.reduce((a, b) => a.lessThan(b) ? a : b);
