import { decimal, money, sum } from '../../core/money/index.js';
import type { Contract } from '../../domain/models.js';

export const approvedContractAmount = (contract: Contract): string => money(decimal(contract.originalAmount).plus(sum(contract.amendments.filter((a) => a.status === 'APPROVED').map((a) => a.amount))));
