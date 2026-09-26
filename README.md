# Accounting Core FR + BTP

Moteur TypeScript déterministe de facturation et de règles comptables françaises, réutilisable par API REST, SDK ou serveur MCP. Le registre fourni reste la source réglementaire : ses 72 règles ne sont ni modifiées ni remplacées.

> Statut réglementaire : le registre est `DRAFT_FOR_EXPERT_VALIDATION` au 8 août 2026. Les 17 règles marquées `legal_review_required` produisent une revue experte lorsqu'une décision définitive dépend d'elles.

## Démarrage

Prérequis : Node.js 22 et Corepack.

```bash
corepack pnpm install
corepack pnpm test
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm db:generate
corepack pnpm dev:api
```

Si `corepack enable` ne peut pas écrire dans le répertoire système de Node, les commandes `corepack pnpm ...` restent utilisables directement.

## Architecture

```text
CRM ── REST / SDK ──> services métier déterministes <── MCP ── agents
                            │
                            ├── registre versionné et daté
                            ├── Decimal.js (aucun calcul monétaire en float JS)
                            └── audit / PostgreSQL (adaptateur optionnel)
```

Le cœur sous `src/` fonctionne sans base de données. L'API, le SDK et le MCP appellent exactement les mêmes fonctions. `prisma/schema.prisma` et `src/persistence/prisma.ts` fournissent la persistance PostgreSQL des documents émis, événements d'audit, allocations et situations validées.

## Capacités

- Factures, avoirs référencés et factures d'acompte ; TVA par ligne et ventilation régime+taux.
- Paiements alloués sans modifier le nominal et protection contre surallocation/double imputation.
- Contrats BTP, avenants approuvés, situations cumulatives montant/pourcentage/ligne et verrouillage N-1.
- Avances et stratégies de récupération configurables ; retenues `WITHHOLDING`, garantie substitutive ou consignation sans taux par défaut.
- Autoliquidation transactionnelle et pré-éligibilité TVA BTP avec `NEEDS_INFORMATION` ou revue experte.
- Révision de prix reproductible, réception/réserves, libération de retenue et rapprochement final.
- Événements comptables sémantiques puis comptes configurables ; contrôle débits = crédits.
- Adaptateurs de transport CanonicalInvoice vers Factur-X, UBL et CII (enveloppes V1 à compléter avec les schémas normatifs avant production).
- Deux phases : `calculate/validate`, puis `issue/post` idempotent et audité.

## API

Les routes minimales du brief sont disponibles, plus les actions définitives :

```text
POST /v1/invoices/calculate       POST /v1/invoices/validate
POST /v1/invoices/issue           POST /v1/credit-notes/calculate
POST /v1/deposits/calculate       POST /v1/btp/progress/calculate
POST /v1/btp/progress/validate    POST /v1/btp/reverse-charge/evaluate
POST /v1/btp/vat/evaluate         POST /v1/accounting/events/generate
POST /v1/accounting/events/post   GET  /v1/rules
GET  /v1/rules/:id                POST /v1/rules/applicable
```

Toute réponse financière contient `result`, `calculations`, `validations`, `rulesApplied` et `warnings`.

## SDK et MCP

Pour ATLAS, compiler avec `corepack pnpm build`, definir `ATLAS_COMPTA_MCP_TOKEN` (au moins 32 caracteres), puis lancer `corepack pnpm mcp:http`. Le serveur Streamable HTTP ecoute exclusivement sur `127.0.0.1:8766` ; `GET /healthz` expose son nom et sa version, tandis que `/mcp` exige `Authorization: Bearer <token>`. Il n'active pas CORS et n'est pas accessible depuis le LAN. `corepack pnpm dev:mcp` conserve le transport stdio.

```ts
import { createAccountingClient } from '@mcp-compta/accounting-core-fr/sdk';

const accounting = createAccountingClient('http://127.0.0.1:3000');
await accounting.invoice.calculate(invoice);
await accounting.btp.progress.calculate(progress);
await accounting.btp.vat.evaluate(context);
```

Lancer `corepack pnpm dev:mcp` pour exposer : `calculate_invoice`, `validate_invoice`, `calculate_progress_invoice`, `validate_progress_invoice`, `evaluate_vat`, `evaluate_btp_reverse_charge`, `generate_accounting_entries`, `get_accounting_rule`, `get_applicable_rules`, `explain_validation_error`.

## Décisions réglementaires prudentes

- Aucun taux de retenue n'est présumé. Sans taux et contexte : `NEEDS_INFORMATION`.
- Les plafonds privé/public sont évalués depuis le profil et les faits ; le plafond PME public nécessite les deux indicateurs explicites.
- Les taux BTP 5,5 %/10 % ne sont jamais déduits d'une simple activité BTP ; une éligibilité préliminaire reste `REQUIRES_EXPERT_REVIEW` conformément au registre.
- Le profil public partage uniquement les invariants BTP génériques. Les règles dont l'ID contient `.PRIVATE.` et les décisions TVA privée sont explicitement exclues.
- Les formules contractuelles non résolues ne sont jamais interprétées dynamiquement : une stratégie déterministe configurée est exigée.

## Registre

- `registry.yaml` : source Git recommandée.
- `registry.json` : source chargée par le moteur.
- `registry.csv` : format de revue expert-comptable/juriste/produit.
- `rule.schema.json` : validation structurelle.

Avant une mise en production réelle, faire valider les 17 règles signalées et remplacer les enveloppes e-invoicing V1 par des sérialisations conformes aux versions normatives ciblées.
