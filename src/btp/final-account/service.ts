import { decimal, money } from '../../core/money/index.js';
import type { Contract, ProgressHistory } from '../../domain/models.js';
import { approvedContractAmount } from '../contracts/service.js';
export function reconcileFinalAccount(contract: Contract, history: ProgressHistory[]) {
  const approved = approvedContractAmount(contract); const billed = history.at(-1)?.currentCumulative ?? '0';
  return { approvedContractAmount: approved, validatedCumulative: money(billed), remainingToBill: money(decimal(approved).minus(billed)), readyForFinalInvoice: decimal(approved).equals(billed) };
}
