import { decimal, money, roundMoney, sum } from '../../core/money/index.js';
import type { FinancialResponse, ProgressCalculation, ProgressInput, RuleDecision } from '../../domain/models.js';
import { approvedContractAmount } from '../contracts/service.js';
import { calculateAdvanceRecovery } from '../advances/service.js';
import { calculateRetention } from '../retention/service.js';
import { RuleEngine } from '../../core/rules/engine.js';

export function calculateProgress(input: ProgressInput): FinancialResponse<ProgressCalculation> {
  if (input.validatedHistory.some((record) => record.validated !== true)) throw new Error('Progress history must contain validated statements only');
  const approved = approvedContractAmount(input.contract);
  const previousRecord = input.validatedHistory.at(-1);
  const previous = decimal(previousRecord?.currentCumulative ?? 0);
  let lineCumulatives: Record<string, string> | undefined;
  let current;
  if (input.lineCumulatives) {
    lineCumulatives = {};
    for (const line of input.contract.lines) lineCumulatives[line.id] = money(input.lineCumulatives[line.id] ?? previousRecord?.lineCumulatives?.[line.id] ?? 0);
    current = sum(Object.values(lineCumulatives));
  } else if (input.percentages) {
    lineCumulatives = {};
    for (const line of input.contract.lines) {
      const percentage = decimal(input.percentages[line.id] ?? 0);
      if (percentage.isNegative() || percentage.greaterThan(100)) throw new Error(`Invalid progress percentage for ${line.id}`);
      lineCumulatives[line.id] = money(roundMoney(decimal(line.amount).times(percentage.div(100))));
    }
    current = sum(Object.values(lineCumulatives));
  } else if (input.currentCumulative !== undefined) current = decimal(input.currentCumulative);
  else throw new Error('currentCumulative, percentages or lineCumulatives is required');
  current = roundMoney(current);
  const period = current.minus(previous);
  const validations: RuleDecision[] = [];
  const engine = new RuleEngine();
  const context = { jurisdiction: 'FR' as const, profile: input.contract.profile, transactionDate: input.transactionDate };
  engine.register('FR.BTP.PROGRESS.PREVIOUS_LOCKED', () => ({ result: 'VALID', reason: "Le cumul précédent vient du dernier historique validé.", evidence: { previousStatementId: previousRecord?.statementId ?? null, previous: money(previous) } }));
  engine.register('FR.BTP.PROGRESS.NO_SILENT_REGRESSION', () => ({ result: period.isNegative() && !input.explicitCorrection ? 'INVALID' : 'VALID', reason: period.isNegative() && !input.explicitCorrection ? 'Le cumul courant régresse sans correction explicite.' : 'Absence de régression silencieuse.', evidence: { previous: money(previous), current: money(current), explicitCorrection: !!input.explicitCorrection } }));
  if (lineCumulatives && previousRecord?.lineCumulatives) {
    const regressedLineIds = Object.entries(lineCumulatives).filter(([id, value]) => decimal(value).lessThan(previousRecord.lineCumulatives?.[id] ?? 0)).map(([id]) => id);
    if (regressedLineIds.length && !input.explicitCorrection) engine.register('FR.BTP.PROGRESS.NO_SILENT_REGRESSION', () => ({ result: 'INVALID', reason: 'Une ou plusieurs lignes régressent sans correction explicite.', evidence: { regressedLineIds, explicitCorrection: false } }));
  }
  engine.register('FR.BTP.PROGRESS.NO_OVERBILL', () => ({ result: current.greaterThan(approved) && !input.allowOverbilling ? 'INVALID' : 'VALID', reason: current.greaterThan(approved) && !input.allowOverbilling ? 'Le cumul dépasse la base contractuelle approuvée.' : 'Cumul dans la base approuvée ou dépassement explicitement autorisé.', evidence: { current: money(current), approved, allowOverbilling: !!input.allowOverbilling } }));
  validations.push(...engine.validate(context, ['FR.BTP.PROGRESS.PREVIOUS_LOCKED','FR.BTP.PROGRESS.NO_SILENT_REGRESSION','FR.BTP.PROGRESS.NO_OVERBILL']));
  const retention = calculateRetention(input.contract.profile, input.transactionDate, input.retention, money(period.abs()));
  validations.push(...retention.validations);
  const recovery = period.isPositive() ? calculateAdvanceRecovery(input.advanceRecovery, money(period)) : '0.00';
  const payable = period.minus(retention.amount).minus(recovery);
  const calculations = { approvedContractAmount: approved, previousCumulative: money(previous), currentCumulative: money(current), periodAmount: money(period), retentionAmount: retention.amount, advanceRecoveryAmount: recovery, payableAmount: money(payable), lineCumulatives };
  const invalid = validations.some((d) => d.result === 'INVALID' && d.severity === 'BLOCKING');
  const needs = validations.some((d) => d.result === 'NEEDS_INFORMATION');
  const result = invalid ? 'INVALID' : needs ? 'NEEDS_INFORMATION' : 'VALID';
  return { result, calculations, validations, rulesApplied: validations.map(({ ruleId, ruleVersion }) => ({ ruleId, ruleVersion })), warnings: validations.filter((d) => d.result !== 'VALID' && d.severity !== 'BLOCKING').map((d) => d.reason) };
}

export const validateProgress = calculateProgress;
