# Architecture et frontières

`src/domain` contient le modèle canonique. `core/money` centralise les décimaux et arrondis. `core/rules` sélectionne le registre par juridiction, profil et date d'effet. Les modules `invoicing`, `payments`, `btp/*` et `accounting` ne dépendent d'aucun transport.

Les couches externes sont volontairement minces :

- `api` valide les entrées et appelle les services ;
- `sdk` encapsule les routes HTTP ;
- `mcp` convertit les résultats déterministes en contenu MCP ;
- `persistence` est une frontière d'adaptateur. Le schéma Prisma fourni cible PostgreSQL, tandis que les tests utilisent l'implémentation mémoire.

Les documents émis sont stockés comme instantanés immuables. Une correction financière crée un avoir. Les actions définitives utilisent une clé d'idempotence et écrivent l'acteur, l'heure, l'entrée, la sortie et les versions des règles.

## Arrondis

Les lignes sont calculées et arrondies à deux décimales avec `ROUND_HALF_UP`. La TVA totale est la somme des TVA de lignes. Les valeurs sont exposées sous forme de chaînes décimales afin d'éviter toute reconversion implicite en flottants JSON.

## Extension des règles

Le texte libre du registre n'est pas évalué comme du code. Une règle calculable reçoit un évaluateur TypeScript explicite via `RuleEngine.register`. Une règle applicable non implémentée reste traçable ; si `legal_review_required=true`, la décision par défaut est `REQUIRES_EXPERT_REVIEW`.
