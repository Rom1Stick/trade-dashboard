# Trade Dashboard | The Grid

Système avancé de gestion de portefeuille et hub patrimonial avec intégration BingX en temps réel.

## 🚀 Fonctionnalités

### Portefeuille & Trading
- **Dashboard P&L** : Bilan 24H, 7J, 30J avec trades détaillés.
- **Sync BingX temps réel** : WebSocket pour positions, balance et fees.
- **Day Browser** : Navigation jour par jour dans l'historique de trading.
- **Chart Évolution** : Graphique interactif (1S / 1M / 3M / ALL).
- **Modal Broker-Style** : Fiche P&L détaillée par trade.

### Patrimoine & Budget
- **Hub 4 Piliers** : Répartition 50/25/15/10 (Yomi Denzel method).
- **Gestion Dépenses** : Suivi mensuel avec catégorisation.
- **Abonnements** : Matérialisation automatique en dépenses.
- **Gestion des Passifs** : Crédits immo, prêts conso, dettes — patrimoine net (`liability_manager.ts`).
- **Multi-Devises** : Conversion temps réel EUR/USD/BTC (`currency_manager.ts`).

### Sécurité & Export
- **SafeVault AES-256-GCM** : Chiffrement local PBKDF2 100k itérations (`vault.ts`).
- **Export/Import Chiffré** : Backup intégral `.vault` avec format `hw_vault_v2` (`persistence.ts`).
- [NEW] **E2EE Cloud Sync** : Synchronisation chiffrée de bout en bout via relay API (`sync_manager.ts`).
- **Export PDF/CSV** : Rapports mensuels pour archive ou comptabilité (`export_manager.ts`).
- **Privacy Mode** : Masquage des montants en un clic.

### Simulations & Projections
- **Moteur Monte Carlo** : Bootstrap resampling depuis l'historique réel (`monte_carlo.ts`).
- **Fan Chart** : Graphique 5 bandes de percentiles (P10/P25/P50/P75/P90).
- **Projections** : Médiane, taux de victoire, scénarios pessimiste/optimiste.

### UX Premium
- **Design Cyberpunk** : Esthétique Tron avec glassmorphism et neon.
- **Micro-animations** : Transitions fluides et effets de glow.
- **Haptic Feedback** : Retour tactile sur mobile.
- **Accessibilité** : Labels ARIA complets sur tous les éléments interactifs.

## 🛠️ Architecture

- **Frontend** : TypeScript + Vite + Vanilla CSS.
- **State Management** : IndexedDB V8 normalisée 3FN (9 stores).
- **API Proxy** : Node.js (BingX Integration).
- **Sécurité** : SafeVault AES-256-GCM + PBKDF2 + purge auto.
- **Design** : "Hacker/Cyberpunk" premium aesthetic.

## 📂 Structure du Projet

```
src/
├── main.ts              # AppEngine — noyau opérationnel
├── persistence.ts       # IndexedDB 3FN + export/import
├── vault.ts             # SafeVault AES-256-GCM
├── wealth_manager.ts    # Hub patrimoine 4 piliers
├── expense_manager.ts   # Gestion dépenses & catégories
├── subscription_manager.ts  # Abonnements récurrents
├── export_manager.ts    # Export PDF/CSV
├── models.ts            # Types & interfaces
├── currency_manager.ts  # Multi-devises EUR/USD/BTC
├── bingx_connector.ts   # API BingX connector
├── stream_manager.ts    # WebSocket streams
├── wealth_engine.ts     # Moteur calcul patrimoine
├── wealth_history_engine.ts # Historique patrimoine
├── main.ts              # Orchestrateur noyau
├── monte_carlo.ts       # Moteur Monte Carlo bootstrap
├── monte_carlo_ui.ts    # UI Monte Carlo
├── dashboard_widgets.ts # Widgets dashboard & Hero P&L
├── evolution_chart.ts   # Chart évolution equity
├── vault_panel.ts       # Panel coffre-fort
├── sync_manager.ts      # Gestionnaire de synchronisation E2EE
├── ui_utils.ts          # Utilitaires UI
├── liability_manager.ts # Gestion des passifs – patrimoine net
├── categories.ts        # Catégories de dépenses
├── sanitize.ts          # XSS protection
└── style.css            # Design system complet
api/                     # Proxy backend pour exchanges
index.html               # Structure principale
```

## 📦 Installation & Déploiement

### Développement Local
```bash
npm install
npm run dev
```

### Docker (Production)
```bash
docker-compose up --build
```

---
*Documentation mise à jour : 16 Février 2026 — Post Phase 13 (Deconstructed main.ts + E2EE Cloud Sync).*
