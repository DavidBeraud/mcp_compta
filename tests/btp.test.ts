import { describe, expect, it } from 'vitest';
import { calculateProgress } from '../src/btp/progress-billing/service.js';
import { evaluateBtpVat, evaluateReverseCharge } from '../src/btp/vat/service.js';
import type { Contract, ProgressInput } from '../src/domain/models.js';

const contract: Contract = { id: 'c1', profile: 'FR_BTP_PRIVATE', originalAmount: '1000', lines: [{ id: 'l1', description: 'Lot 1', amount: '600' }, { id: 'l2', description: 'Lot 2', amount: '400' }], amendments: [{ id: 'a1', amount: '100', status: 'APPROVED' }, { id: 'a2', amount: '500', status: 'DRAFT' }] };
const progress = (overrides: Partial<ProgressInput> = {}): ProgressInput => ({ contract, transactionDate: '2026-08-27', currentCumulative: '300', validatedHistory: [], ...overrides });

describe('BTP progress', () => {
  it('uses approved amendments only', () => expect(calculateProgress(progress()).calculations.approvedContractAmount).toBe('1100.00'));
  it('locks N previous cumulative to validated N-1 history', () => {
    const response = calculateProgress(progress({ currentCumulative: '500', validatedHistory: [{ statementId: 's1', validated: true, currentCumulative: '300' }] }));
    expect(response.calculations).toMatchObject({ previousCumulative: '300.00', currentCumulative: '500.00', periodAmount: '200.00' });
  });
  it('supports progress by contract line percentages', () => {
    const response = calculateProgress(progress({ currentCumulative: undefined, percentages: { l1: '50', l2: '25' } }));
    expect(response.calculations.currentCumulative).toBe('400.00');
    expect(response.calculations.lineCumulatives).toEqual({ l1: '300.00', l2: '100.00' });
  });
  it('blocks a hidden regression on one line', () => {
    const response = calculateProgress(progress({ currentCumulative: undefined, lineCumulatives: { l1: '250', l2: '250' }, validatedHistory: [{ statementId: 's1', validated: true, currentCumulative: '400', lineCumulatives: { l1: '300', l2: '100' } }] }));
    expect(response.result).toBe('INVALID');
  });
  it('blocks silent regression and overbilling', () => {
    expect(calculateProgress(progress({ currentCumulative: '200', validatedHistory: [{ statementId: 's1', validated: true, currentCumulative: '300' }] })).result).toBe('INVALID');
    expect(calculateProgress(progress({ currentCumulative: '1100.01' })).result).toBe('INVALID');
  });
  it('recovers advance and applies an explicit 3% retention', () => {
    const response = calculateProgress(progress({ retention: { mode: 'WITHHOLDING', rate: '3', contractuallyAllowed: true }, advanceRecovery: { advanceId: 'adv', strategy: 'PERCENTAGE_OF_PERIOD', value: '10', remainingAdvance: '100' } }));
    expect(response.calculations).toMatchObject({ retentionAmount: '9.00', advanceRecoveryAmount: '30.00', payableAmount: '261.00' });
  });
  it('never defaults a retention percentage', () => expect(calculateProgress(progress({ retention: { mode: 'WITHHOLDING', contractuallyAllowed: true } })).result).toBe('NEEDS_INFORMATION'));
  it('enforces the contextual 3% public SME cap', () => {
    const publicContract = { ...contract, profile: 'FR_BTP_PUBLIC' as const };
    const response = calculateProgress(progress({ contract: publicContract, retention: { mode: 'WITHHOLDING', rate: '4', contractuallyAllowed: true, holderIsSme: true, publicBuyerEligibleForSmeCap: true } }));
    expect(response.result).toBe('INVALID');
  });
});

describe('BTP VAT decisions', () => {
  it('requires transaction-level reverse-charge facts', () => expect(evaluateReverseCharge({ transactionDate: '2026-08-27', sellerIsSubcontractor: true }).result).toBe('NEEDS_INFORMATION'));
  it('identifies reverse charge only when every condition is true', () => expect(evaluateReverseCharge({ transactionDate: '2026-08-27', sellerIsSubcontractor: true, buyerIsVatTaxable: true, worksAreImmovable: true, transactionInFrance: true }).decision.evidence).toMatchObject({ reverseChargeApplies: true }));
  it('does not guess reduced VAT with incomplete evidence', () => expect(evaluateBtpVat({ transactionDate: '2026-08-27', buildingAgeYears: 10 }).result).toBe('NEEDS_INFORMATION'));
  it('routes preliminary reduced-rate eligibility to expert review', () => expect(evaluateBtpVat({ transactionDate: '2026-08-27', buildingAgeYears: 10, use: 'HOUSING', worksCategory: 'ENERGY_RENOVATION', customerAttestation: true }).result).toBe('REQUIRES_EXPERT_REVIEW'));
});
