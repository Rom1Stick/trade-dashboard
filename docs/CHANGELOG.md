# Changelog

Toutes les modifications notables du projet sont documentées ici.

## [3.4.0] — 2026-02-16 | Phase 16 — Intelligence V2

### Ajouté
- **Détection d'Exposition** : `analyzeExposure` identifie les concentrations >30% par plateforme et >60% par catégorie.
- **Score de Diversification** : `calculateDiversificationScore` (0-100) basé sur la variété structurelle des actifs.
- **Widget "Diversification"** : Affichage dynamique des scores et alertes dans le Hub Patrimoine (Mode Pessimiste).
- **Styles V2** : Badges d'alerte critiques/warnings, animations `slideUp`.

### Modifié
- `intelligence_engine.ts` : Nouveau moteur V2 avec diversification et exposition.
- `dashboard_widgets.ts` : Intégration V2 dans `runRiskAnalysis`.
- `index.html` : Ajout de la carte d'analyse de diversification.
- `style.css` : Styles `.exposure-alert` et raffinage `.risk-card`.

## [3.3.0] — 2026-02-16 | Phase 15 — Excellence Technique

### Ajouté
- **Framework Vitest** : Installation et configuration de `vitest`, `jsdom` et `coverage`.
- **Suites de Tests** : 19 tests unitaires pour `IntelligenceEngine`, `WealthEngine` et `LiabilityManager`.
- **Scripts NPM** : `test` et `test:ui` ajoutés au `package.json`.

### Modifié
- `vitest.config.ts` : Configuration initiale de l'environnement de test.

## [3.1.1] — 2026-02-16 | Deconstructed main.ts + E2EE Cloud Sync

### Ajouté
- **Nouveaux Modules** : `ui_utils.ts`, `vault_panel.ts`, `dashboard_widgets.ts`, `evolution_chart.ts`, `monte_carlo_ui.ts`.
- **Délégation** : `AppEngine` délègue maintenant 70% de la logique métier à ces modules spécialisés.
- **E2EE Cloud Sync** : `sync_manager.ts` + endpoints `/api/sync/push` et `/api/sync/pull` pour sauvegarde/restauration chiffrée.
- **UI Cloud Sync** : Boutons Push/Pull et affichage "Dernière synchro" dans le panneau Vault.

### Modifié
- `main.ts` : Réduit de 1168 à 269 lignes. Ne contient plus que l'orchestration, la navigation de base et la synchronisation BingX.
- `api/server.ts` : Étendu avec les endpoints de synchronisation cloud E2EE.

## [3.1.0] — 2026-02-16 | Phase 13B — Liabilities Manager

### Ajouté
- **Gestion des Passifs** : `liability_manager.ts` — crédits immo, prêts conso, dettes (238 lignes).
- **Modèle Liability** : Interface dans `models.ts` — type, montant initial/restant, mensualité, taux, dates.
- **IndexedDB V8** : Store `liabilities` avec index by_active, by_type, by_timestamp + 5 méthodes CRUD.
- **Patrimoine Net** : Bannière actifs − passifs = net dans le Hub Patrimoine.
- **UI Passifs** : Carte avec formulaire d'ajout, barres de progression, marquer comme soldé.

### Modifié
- `persistence.ts` : DB_VERSION 7→8, +70 lignes CRUD (1011 lignes total).
- `index.html` : Section liabilities dans `#view-wealth` (+99 lignes, 766 total).
- `style.css` : Styles `.liability-card`, `.net-worth-banner`, `.liability-progress` (+165 lignes, 1599 total).
- `main.ts` : Import + `LiabilityManager.init()` (1168 lignes total).

## [3.0.0] — 2026-02-16 | Phase 13 — Monte Carlo Engine

### Ajouté
- **Moteur Monte Carlo** : `monte_carlo.ts` — simulation bootstrap par rééchantillonnage empirique.
- **Fan Chart** : Graphique Chart.js avec 5 bandes de percentiles (P10/P25/P50/P75/P90).
- **Onglet Simulations** : 🎲 SIMULATIONS dans la navigation — params, stats, résultats.
- **Statistiques** : Taux de victoire, retour moyen, écart-type, scénarios pessimiste/optimiste.

### Modifié
- `main.ts` : +230 lignes (import MonteCarloEngine, wiring complet, renderMCChart).
- `index.html` : Section `#view-simulations` + nav tab `#nav-sim`.
- `style.css` : Styles `.mc-params-grid`, `.chart-box-large`, `.glass-card`, `.mc-spinner`.

## [2.1.0] — 2026-02-15 | Phase 11 — Vault V2

### Ajouté
- **SafeVault V2** : `encryptJSON()`, `decryptJSON()`, `setVaultPassword()` dans `vault.ts`.
- **Export/Import Chiffré** : `exportEncrypted()`, `importEncrypted()` dans `persistence.ts` — format `.vault`.
- **UI Coffre-Fort** : Panel complet dans config avec indicateur de statut, boutons export/import.
- **Wiring** : `initVaultPanel()`, `updateVaultStatus()` dans `main.ts`.

### Sécurité
- Hash SHA-256 du mot de passe (jamais stocké en clair).
- Purge automatique après 3 tentatives échouées (VAULT_PURGED).
- Header de format `hw_vault_v2` pour détection fiable.

## [2.0.0] — 2026-02-14 | Phase 10 — Quick Wins

### Ajouté
- **Export PDF/CSV** : Module `export_manager.ts` avec génération de rapports.
- **Multi-Devises** : Module `currency_manager.ts` — EUR/USD/BTC en temps réel.
- **Micro-animations** : Transitions CSS, glow effects sur gains/pertes.

## [1.5.0] — 2026-02-13 | Phase 9 — Golden Build

### Corrigé
- Précision numérique (step="any", epsilon 0.001) sur tous les inputs.
- Hardening accessibilité : labels + aria-labels sur 100% des éléments interactifs.
- Clinical zero-error pass sur port 8084.

## [1.0.0] — 2026-02-12 | Phases 1-8 — Foundation

### Ajouté
- AppEngine core avec IndexedDB 3FN V5.
- SafeVault AES-GCM v1 (encrypt/decrypt texte).
- Hub Patrimoine 4 Piliers (50/25/15/10).
- BingX Connector + WebSocket Streams.
- Day Browser, Chart Évolution, Trade Modal.
- Gestion dépenses et abonnements.
- Privacy Mode, Haptic Feedback.
- Design System Cyberpunk complet.
