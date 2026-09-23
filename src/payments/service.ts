import { decimal, money, sum } from '../core/money/index.js';
import type { Deposit, DepositAllocation, Payment } from '../domain/models.js';

export function validatePayment(payment: Payment): { allocated: string; unallocated: string } {
  const allocated = sum(payment.allocations.map((allocation) => allocation.amount));
  if (allocated.greaterThan(payment.amount)) throw new Error('Payment allocations exceed payment amount');
  if (new Set(payment.allocations.map((allocation) => allocation.idempotencyKey)).size !== payment.allocations.length) throw new Error('Duplicate allocation idempotencyKey');
  return { allocated: money(allocated), unallocated: money(decimal(payment.amount).minus(allocated)) };
}

export function validateDepositAllocations(deposits: Deposit[], allocations: DepositAllocation[]): void {
  for (const deposit of deposits) {
    const newlyAllocated = sum(allocations.filter((a) => a.depositId === deposit.id).map((a) => a.amount));
    if (decimal(deposit.allocatedAmount).plus(newlyAllocated).greaterThan(deposit.amount)) throw new Error(`Deposit ${deposit.id} would be allocated twice or over-allocated`);
  }
}
