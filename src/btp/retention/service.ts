import { decimal, money, roundMoney } from '../../core/money/index.js';
import type { Profile, RetentionInput, RuleDecision } from '../../domain/models.js';
import { RuleEngine } from '../../core/rules/engine.js';

export function calculateRetention(profile: Profile, transactionDate: string, input: RetentionInput | undefined, periodAmount: string): { amount: string; validations: RuleDecision[] } {
  if (!input) return { amount: '0.00', validations: [] };
  const engine = new RuleEngine();
  const context = { jurisdiction: 'FR' as const, profile, transactionDate };
  if (!input.contractuallyAllowed) {
    const id = profile === 'FR_BTP_PUBLIC' ? 'FR.BTP.PUBLIC.RETENTION.PURPOSE' : 'FR.BTP.PRIVATE.RETENTION.CONTRACTUAL';
    engine.register(id, () => ({ result: 'INVALID', reason: "La retenue n'est pas autorisée par le contexte fourni.", evidence: { contractuallyAllowed: false } }));
    return { amount: '0.00', validations: engine.validate(context, [id]) };
  }
  if (input.mode !== 'WITHHOLDING') return { amount: '0.00', validations: [] };
  if (input.rate === undefined) {
    const id = profile === 'FR_BTP_PUBLIC' ? 'FR.BTP.PUBLIC.RETENTION.MAX_5' : 'FR.BTP.PRIVATE.RETENTION.MAX_5';
    engine.register(id, () => ({ result: 'NEEDS_INFORMATION', reason: 'Aucun taux de retenue ne peut être supposé.', evidence: { rate: null } }));
    return { amount: '0.00', validations: engine.validate(context, [id]) };
  }
  const rate = decimal(input.rate);
  const publicSmeCap = profile === 'FR_BTP_PUBLIC' && input.holderIsSme && input.publicBuyerEligibleForSmeCap;
  const cap = decimal(publicSmeCap ? 3 : 5);
  const id = publicSmeCap ? 'FR.BTP.PUBLIC.RETENTION.PME_MAX_3' : profile === 'FR_BTP_PUBLIC' ? 'FR.BTP.PUBLIC.RETENTION.MAX_5' : 'FR.BTP.PRIVATE.RETENTION.MAX_5';
  engine.register(id, () => ({ result: rate.lessThanOrEqualTo(cap) ? 'VALID' : 'INVALID', reason: rate.lessThanOrEqualTo(cap) ? `Taux dans le plafond de ${cap}% applicable.` : `Taux supérieur au plafond de ${cap}% applicable.`, evidence: { rate: rate.toString(), cap: cap.toString(), publicSmeCap: !!publicSmeCap } }));
  return { amount: rate.lessThanOrEqualTo(cap) ? money(roundMoney(decimal(periodAmount).times(rate.div(100)))) : '0.00', validations: engine.validate(context, [id]) };
}
