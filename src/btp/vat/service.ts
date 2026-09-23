import { RuleEngine } from '../../core/rules/engine.js';
import type { RuleDecision } from '../../domain/models.js';

export interface ReverseChargeContext { transactionDate: string; sellerIsSubcontractor?: boolean; buyerIsVatTaxable?: boolean; worksAreImmovable?: boolean; transactionInFrance?: boolean }
export interface BtpVatContext { transactionDate: string; buildingAgeYears?: number; use?: 'HOUSING' | 'OTHER'; worksCategory?: 'ENERGY_RENOVATION' | 'RENOVATION' | 'NEW_BUILD_OR_EQUIVALENT'; customerAttestation?: boolean }

const decisionResponse = (decision: RuleDecision) => ({ result: decision.result, decision, rulesApplied: [{ ruleId: decision.ruleId, ruleVersion: decision.ruleVersion }] });

export function evaluateReverseCharge(input: ReverseChargeContext) {
  const engine = new RuleEngine(); const id = 'FR.BTP.VAT.REVERSE_CHARGE.SUBCONTRACT';
  engine.register(id, () => {
    const values = [input.sellerIsSubcontractor, input.buyerIsVatTaxable, input.worksAreImmovable, input.transactionInFrance];
    if (values.some((value) => value === undefined)) return { result: 'NEEDS_INFORMATION', reason: "Conditions transactionnelles d'autoliquidation incomplètes.", evidence: { ...input } };
    const eligible = values.every(Boolean);
    return { result: 'VALID', reason: eligible ? 'Autoliquidation BTP applicable à cette transaction.' : 'Autoliquidation BTP non applicable à cette transaction.', evidence: { ...input, reverseChargeApplies: eligible } };
  });
  return decisionResponse(engine.evaluateRule(id, { jurisdiction: 'FR', profile: 'FR_BTP_PRIVATE', transactionDate: input.transactionDate }));
}

export function evaluateBtpVat(input: BtpVatContext) {
  const engine = new RuleEngine(); const id = 'FR.BTP.VAT.REDUCED.HOUSING';
  engine.register(id, () => {
    if (input.buildingAgeYears === undefined || input.use === undefined || input.worksCategory === undefined || input.customerAttestation === undefined) return { result: 'NEEDS_INFORMATION', reason: "Informations insuffisantes pour déterminer un taux réduit BTP.", evidence: { ...input } };
    if (input.buildingAgeYears <= 2 || input.use !== 'HOUSING' || input.worksCategory === 'NEW_BUILD_OR_EQUIVALENT' || !input.customerAttestation) return { result: 'VALID', reason: 'Taux réduit non démontré ; appliquer le traitement standard configuré.', evidence: { ...input, eligibleRate: null } };
    const eligibleRate = input.worksCategory === 'ENERGY_RENOVATION' ? '5.5' : '10';
    return { result: 'REQUIRES_EXPERT_REVIEW', reason: `Éligibilité préliminaire à ${eligibleRate} %, validation fiscale requise par le registre.`, evidence: { ...input, eligibleRate } };
  });
  return decisionResponse(engine.evaluateRule(id, { jurisdiction: 'FR', profile: 'FR_BTP_PRIVATE', transactionDate: input.transactionDate }));
}
