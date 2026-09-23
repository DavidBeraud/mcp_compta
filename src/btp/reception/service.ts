import type { Reception, Retention, RetentionRelease, RuleDecision } from '../../domain/models.js';
import { RuleEngine } from '../../core/rules/engine.js';

export function evaluateRetentionRelease(profile: 'FR_BTP_PRIVATE' | 'FR_BTP_PUBLIC', transactionDate: string, retention: Retention, reception: Reception): { release: RetentionRelease; decision: RuleDecision } {
  const openReservations = reception.reservations.filter((reservation) => reservation.status === 'OPEN');
  const eligibleAt = new Date(`${reception.receptionDate}T00:00:00Z`); eligibleAt.setUTCFullYear(eligibleAt.getUTCFullYear() + 1);
  const id = profile === 'FR_BTP_PRIVATE' ? 'FR.BTP.PRIVATE.RETENTION.RELEASE_1Y' : 'FR.BTP.PUBLIC.RETENTION.RELEASE';
  const engine = new RuleEngine();
  engine.register(id, () => openReservations.length ? ({ result: 'INVALID', reason: 'Des réserves restent ouvertes ; libération bloquée.', evidence: { openReservationIds: openReservations.map((r) => r.id), eligibleAt: eligibleAt.toISOString().slice(0, 10) } }) : ({ result: 'REQUIRES_EXPERT_REVIEW', reason: 'Date théorique calculée ; la libération doit être validée selon le contexte juridique du registre.', evidence: { eligibleAt: eligibleAt.toISOString().slice(0, 10), openReservationIds: [] } }));
  const decision = engine.evaluateRule(id, { jurisdiction: 'FR', profile, transactionDate });
  return { release: { id: `release:${retention.id}`, retentionId: retention.id, amount: retention.withheldAmount, eligibleAt: eligibleAt.toISOString().slice(0, 10), status: openReservations.length ? 'BLOCKED_BY_RESERVATIONS' : 'PENDING' }, decision };
}
