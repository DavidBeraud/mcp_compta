# Prompt Codex Sol — Accounting Core FR + BTP

Tu es en charge de construire un moteur de facturation et de règles comptables français réutilisable par plusieurs CRM.

## Objectif

Construire une V1 production-ready comprenant :
- FR_GENERAL
- FR_BTP_PRIVATE
- FR_BTP_PUBLIC
- API REST
- SDK TypeScript
- serveur MCP
- suite de tests
- règles versionnées, datées, sourcées et auditables

Le registre fourni dans `fr_accounting_rules_registry_v1/` est la source de départ. Commence par l'inspecter. Ne réécris pas arbitrairement les règles existantes.

## Principes impératifs

Architecture :
CRM -> REST/SDK -> ACCOUNTING CORE <- MCP <- Codex/agents

Le MCP n'est pas le moteur métier. Tous les calculs doivent être déterministes. Aucun LLM ne doit calculer la TVA, les situations, retenues, avances, cumuls, échéances ou écritures comptables.

Utilise TypeScript + Node.js, Zod, PostgreSQL, Prisma si pertinent, Fastify ou NestJS, Vitest et Decimal.js (ou équivalent) pour tous les montants. Ne jamais utiliser les flottants JS natifs pour l'argent.

Le cœur de calcul doit pouvoir tourner comme librairie sans base de données.

## Domaines

Prévoir :
- core/money
- core/rules
- core/validation
- core/audit
- invoicing
- vat
- payments
- accounting
- btp/contracts
- btp/amendments
- btp/progress-billing
- btp/advances
- btp/retention
- btp/price-revision
- btp/subcontracting
- btp/reception
- btp/final-account
- api
- sdk
- mcp
- persistence
- tests

## Modèle canonique

LegalEntity, Customer, Address, Quote, Contract, ContractLine, Amendment,
Invoice, InvoiceLine, CreditNote, Deposit, Advance, AdvanceRecovery,
Payment, PaymentAllocation, ProgressStatement, ProgressLine, Retention,
RetentionRelease, Reception, Reservation, VatTreatment, TaxBreakdown,
AccountingEvent, AccountingEntry, Rule, RuleDecision, AuditEvent.

Types de documents :
QUOTE, STANDARD_INVOICE, DEPOSIT_INVOICE, PROGRESS_INVOICE, FINAL_INVOICE, CREDIT_NOTE.

Le type de document est indépendant du profil réglementaire.

Profils :
FR_GENERAL
FR_BTP_PRIVATE
FR_BTP_PUBLIC

## Rule Engine

Implémente :
- getApplicableRules(context)
- validate(context)
- evaluateRule(ruleId, context)
- explainDecision(decision)
- getRulesApplied()

Chaque décision doit retourner :
ruleId, ruleVersion, result, severity, reason, evidence, source.

Résultats possibles :
VALID
INVALID
NEEDS_INFORMATION
REQUIRES_EXPERT_REVIEW

Sélectionner les règles selon juridiction, profil, dates d'effet et date de transaction. Une facture validée conserve les IDs + versions de toutes les règles appliquées.

## FR_GENERAL

Implémenter :
- numérotation
- date d'émission
- vendeur/client
- adresse
- lignes
- quantités
- prix/remises
- HT/TVA/TTC
- échéance
- conditions de paiement
- mentions B2B
- acomptes
- avoirs
- paiements
- écritures comptables
- audit
- facturation électronique

Une facture émise est financièrement immuable. Toute correction se fait via avoir/document correctif.

## TVA

VatTreatment doit gérer :
STANDARD, REDUCED, EXEMPT, FRANCHISE, REVERSE_CHARGE, OUT_OF_SCOPE.

TVA au niveau ligne. Breakdown par régime+taux. Ne jamais deviner un taux en cas d'information insuffisante.

## Paiements et acomptes

Séparer DEPOSIT_REQUEST, DEPOSIT_INVOICE et DEPOSIT_PAYMENT.
Interdire la double imputation d'acompte.

Un paiement ne modifie jamais le nominal de la facture. Utiliser Payment + PaymentAllocation. Gérer paiements partiels, multiples, ventilés et avoirs.

## Accounting Events

Générer des événements comptables sémantiques puis les mapper vers des comptes configurables par entreprise et compatibles avec le PCG applicable. Ne pas hardcoder globalement 411/706/44571 dans le domaine.

## FR_BTP_PRIVATE

Contrat :
currentApprovedAmount = originalAmount + approvedAmendments.

Seuls les avenants APPROVED impactent la base facturable.

Situations cumulatives :
periodAmount = currentCumulative - previousValidatedCumulative.

Le cumul précédent vient obligatoirement de l'historique validé. Supporter avancement par pourcentage, montant et ligne.

Bloquer :
- cumul courant < cumul précédent, sauf correction explicite
- cumul courant > base contractuelle approuvée, sauf mécanisme autorisé

Avenants : DRAFT, APPROVED, REJECTED, CANCELLED.

Avances : ne pas confondre advance, deposit et progress payment. Créer une AdvanceRecoveryStrategy configurable.

Retenue de garantie : ne jamais mettre 5 % par défaut. Calculer le plafond applicable à partir du registre et du contexte. Supporter WITHHOLDING, SUBSTITUTE_GUARANTEE, CONSIGNMENT.

Autoliquidation BTP : décision au niveau transactionnel, jamais sur le seul secteur BTP.

TVA réduite BTP : moteur d'éligibilité séparé ; si données insuffisantes -> NEEDS_INFORMATION.

Révision de prix : formule, indices, mois de base, source, version et arrondis doivent être persistés pour recalcul exact.

Réception + réserves doivent piloter les échéances de retenue/libération.

## FR_BTP_PUBLIC

Module dédié. Supporter :
- advance
- progress payment
- monthly progress payment
- retention
- SME retention cap
- Chorus Pro metadata
- final settlement
- architecture prête pour DGD

Ne pas réutiliser automatiquement les règles privées.

## Facturation électronique

Le modèle interne est CanonicalInvoice. Ajouter des adapters Factur-X / UBL / CII. Le format de transport n'est pas le modèle métier.

## API minimale

POST /v1/invoices/calculate
POST /v1/invoices/validate
POST /v1/credit-notes/calculate
POST /v1/deposits/calculate
POST /v1/btp/progress/calculate
POST /v1/btp/progress/validate
POST /v1/btp/reverse-charge/evaluate
POST /v1/btp/vat/evaluate
POST /v1/accounting/events/generate
GET /v1/rules
GET /v1/rules/:id
POST /v1/rules/applicable

Toute réponse financière retourne result, calculations, validations, rulesApplied, warnings.

## SDK

Créer un SDK TypeScript ergonomique :
accounting.invoice.calculate(...)
accounting.invoice.validate(...)
accounting.btp.progress.calculate(...)
accounting.btp.vat.evaluate(...)
accounting.rules.explain(...)

## MCP

Exposer :
calculate_invoice
validate_invoice
calculate_progress_invoice
validate_progress_invoice
evaluate_vat
evaluate_btp_reverse_charge
generate_accounting_entries
get_accounting_rule
get_applicable_rules
explain_validation_error

Le MCP appelle exactement les mêmes services métier que l'API.

## Tests

FR_GENERAL :
facture simple 20 %, plusieurs taux, franchise, exonération, avoir partiel/total,
acompte, plusieurs acomptes, paiements partiels/multiples, numérotation, arrondis.

BTP :
situation simple, situation N=2, avancement par ligne, avenants +/-, avenant non approuvé,
dépassement marché, baisse de cumul, avance, récupération d'avance, retenue 3 %/5 %,
retenue interdite, autoliquidation oui/non, TVA 20/10/5,5 %, informations insuffisantes,
situation finale, avoir sur situation, arrondis cumulés.

Invariants :
HT + TVA = TTC
somme lignes = total
période = cumul courant - cumul précédent
allocations <= paiement
débits = crédits
N.previous = N-1.current validé

## Sécurité / audit

Toute action définitive a deux phases : calculate/validate puis issue/post.
Prévoir idempotencyKey pour émission, posting, allocation et avoir.
Conserver who/when/what, état précédent/nouveau, versions de règles, inputs/outputs.

## Ordre de travail

1. Inspecter le registre.
2. Créer le projet.
3. Modèles métier.
4. Money/Decimal.
5. RuleEngine.
6. FR_GENERAL.
7. Situations BTP.
8. Retenues.
9. TVA/autoliquidation BTP.
10. Accounting events.
11. API.
12. SDK.
13. MCP.
14. Tests.
15. Lancer tests/typecheck/lint.
16. Corriger.
17. Documenter.

Ne te contente pas de squelettes : implémente réellement.

Lorsqu'une règle réglementaire est ambiguë, ne l'invente pas. Retourne NEEDS_INFORMATION ou REQUIRES_EXPERT_REVIEW et documente le point.

## Definition of Done

- pnpm test passe
- pnpm typecheck passe
- pnpm lint passe
- factures, avoirs, acomptes calculables
- situations BTP calculables
- cumul N-1 sécurisé
- avenants, avances, retenues supportés
- autoliquidation et TVA BTP évaluées
- rulesApplied retourné
- historique auditable
- API + SDK + MCP opérationnels
- README + exemples exécutables

Priorités absolues : exactitude, déterminisme, tests, auditabilité, réutilisabilité entre CRM.

Commence maintenant par inspecter le registre et construire le projet. Ne redemande pas l'architecture générale sauf blocage réel dans les fichiers.
