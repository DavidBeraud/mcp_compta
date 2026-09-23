import registryDocument from '../../../registry.json' with { type: 'json' };
import type { DecisionResult, Profile, Rule, RuleDecision } from '../../domain/models.js';

export interface RuleContext {
  jurisdiction: 'FR'; profile: Profile; transactionDate: string; facts?: Record<string, unknown>;
}
type Evaluator = (rule: Rule, context: RuleContext) => Omit<RuleDecision, 'ruleId' | 'ruleVersion' | 'severity' | 'source'>;

const moduleFor = (profile: Profile): Rule['module'][] => profile === 'FR_GENERAL'
  ? ['FR_GENERAL']
  : profile === 'FR_BTP_PRIVATE' ? ['FR_GENERAL', 'FR_BTP'] : ['FR_GENERAL', 'FR_BTP', 'FR_BTP_PUBLIC'];

export class RuleEngine {
  private readonly applied: RuleDecision[] = [];
  private readonly evaluators = new Map<string, Evaluator>();
  readonly rules: Rule[];

  constructor(rules: Rule[] = registryDocument.rules as Rule[]) { this.rules = rules; }

  register(ruleId: string, evaluator: Evaluator): this { this.evaluators.set(ruleId, evaluator); return this; }

  getApplicableRules(context: RuleContext): Rule[] {
    const date = context.transactionDate;
    return this.rules.filter((rule) => rule.jurisdiction === context.jurisdiction
      && moduleFor(context.profile).includes(rule.module)
      && !(context.profile === 'FR_BTP_PUBLIC' && (rule.id.includes('.PRIVATE.') || rule.id.includes('.VAT.')))
      && rule.status === 'ACTIVE'
      && rule.effective_from <= date
      && (!rule.effective_to || date <= rule.effective_to));
  }

  evaluateRule(ruleId: string, context: RuleContext): RuleDecision {
    const rule = this.getApplicableRules(context).find((candidate) => candidate.id === ruleId);
    if (!rule) throw new Error(`Rule ${ruleId} is not applicable`);
    const evaluator = this.evaluators.get(ruleId);
    const evaluation = evaluator?.(rule, context) ?? {
      result: (rule.legal_review_required ? 'REQUIRES_EXPERT_REVIEW' : 'VALID') as DecisionResult,
      reason: rule.legal_review_required ? 'Le registre exige une revue experte pour cette règle.' : 'Règle applicable, contrôlée par le service de domaine.',
      evidence: { appliesIf: rule.applies_if, validation: rule.validation },
    };
    const decision: RuleDecision = { ruleId: rule.id, ruleVersion: rule.version, severity: rule.severity, source: rule.source, ...evaluation };
    this.applied.push(decision);
    return decision;
  }

  validate(context: RuleContext, ruleIds?: string[]): RuleDecision[] {
    const selected = ruleIds ?? this.getApplicableRules(context).map((rule) => rule.id);
    return selected.map((id) => this.evaluateRule(id, context));
  }

  explainDecision(decision: RuleDecision): string {
    return `${decision.result} — ${decision.reason} (règle ${decision.ruleId}@${decision.ruleVersion}, source: ${decision.source.authority})`;
  }

  getRulesApplied(): { ruleId: string; ruleVersion: string }[] {
    return [...new Map(this.applied.map((decision) => [`${decision.ruleId}@${decision.ruleVersion}`, { ruleId: decision.ruleId, ruleVersion: decision.ruleVersion }])).values()];
  }

  getRule(id: string): Rule | undefined { return this.rules.find((rule) => rule.id === id); }
}
