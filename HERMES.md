# HERMES.md — dépôt ai_corrector (vue conteneur)

Service de correction grammaticale (Bun/TypeScript, vitest). Monté sur
`/opt/repos/ai_corrector` (bind de `/home/will/ai_corrector`, lecture/écriture).
Doc complète, orientée hôte : `/opt/repos/ai_corrector/README.md`.

## Chemins
- Hôte `/home/will/ai_corrector` ↔ conteneur `/opt/repos/ai_corrector` (rw).
- Jeu complet des montages : `/opt/repos/infra/docs/hermes-context.md`.

## Règles
- Écrire uniquement sous `/opt/data` ou `/opt/repos` (`HERMES_WRITE_SAFE_ROOT`).
- Ne jamais redémarrer/recréer le conteneur `hermes` depuis l'intérieur.
- `bun` est **absent** du conteneur : utiliser `npm`/`node`.

## Endpoints internes
- Langfuse : `http://langfuse-web:3000`. Détail :
  `/opt/repos/infra/docs/hermes-context.md`.

## Commandes vérifiées
- Tests : `npm run test:run`
- Lint : `npm run lint`
- Build : `npm run build`

## Garde-fous
Voir `/opt/repos/infra/hermes-sre/AGENTS.md`. Ne pas éditer les chemins hôte.
