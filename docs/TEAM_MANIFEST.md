# BMAD Team Manifest: trade-dashboard

## Team Composition

### 1. **BMad Master (Lead Architect)**
- **Role**: Strategic oversight, decision making, and framework compliance.
- **Responsibilities**: Ensures the BMAD method is followed, coordinates agents, finalizes plans.

### 2. **Neon Ghost (Tron UI/UX Designer)**
- **Role**: Visual design and aesthetic excellence.
- **Responsibilities**: "Tron-like" style (neon gradients, glassmorphism, glowing grids), mobile-first.

### 3. **The Architect (Fullstack Developer)**
- **Role**: Core implementation and infrastructure.
- **Responsibilities**: IndexedDB persistence, Vite config, AppEngine, API connectors.

### 4. **Profit Oracle (Trading Strategist)**
- **Role**: Domain expertise.
- **Responsibilities**: Trade metrics (P&L, Win Rate, Evolution), wealth allocation logic.

### 5. **Protocol Zero (QA & Security Auditor)**
- **Role**: Verification and security audit.
- **Responsibilities**: Bug hunting, vault security audit, deployment readiness.

### 6. **Shadow Operator (RPA & API Specialist)**
- **Role**: Backend automation and external integration.
- **Responsibilities**: BingX API connector, WebSocket streams, fee scraping.

---

## Architecture — File Map

### Core Engine
| File | Owner | Purpose |
|------|-------|---------|
| `main.ts` | Architect | AppEngine — orchestrateur noyau (~269 lignes) |
| `persistence.ts` | Architect | IndexedDB 3FN V8 — 9 stores (1011 lignes) |
| `sync_manager.ts` | Architect | E2EE Cloud Sync — push/pull relay (~94 lignes) |
| `models.ts` | Architect | Types & interfaces TypeScript (119 lignes) |
| `monte_carlo.ts` | Profit Oracle | Moteur Monte Carlo bootstrap resampling |

### Security
| File | Owner | Purpose |
|------|-------|---------|
| `vault.ts` | Protocol Zero | SafeVault AES-256-GCM + PBKDF2 |
| `sanitize.ts` | Protocol Zero | XSS protection (escapeHTML) |

### Trading & Finance
| File | Owner | Purpose |
|------|-------|---------|
| `bingx_connector.ts` | Shadow Operator | API BingX v2 connector |
| `stream_manager.ts` | Shadow Operator | WebSocket streams temps réel |
| `currency_manager.ts` | Profit Oracle | Multi-devises EUR/USD/BTC |

### Patrimoine & Budget
| File | Owner | Purpose |
|------|-------|---------|
| `wealth_manager.ts` | Architect | Hub patrimoine 4 piliers |
| `wealth_engine.ts` | Profit Oracle | Moteur calcul patrimoine |
| `wealth_history_engine.ts` | Profit Oracle | Historique patrimoine |
| `expense_manager.ts` | Architect | Gestion dépenses & catégories |
| `subscription_manager.ts` | Architect | Abonnements récurrents |
| `liability_manager.ts` | Profit Oracle | Gestion des passifs — patrimoine net (238 lignes) |
| `vault_panel.ts` | Architect | Panel coffre-fort (127 lignes) |
| `dashboard_widgets.ts` | Profit Oracle | Widgets dashboard P&L (276 lignes) |
| `evolution_chart.ts` | Profit Oracle | Chart évolution equity (138 lignes) |
| `monte_carlo_ui.ts` | Profit Oracle | UI Monte Carlo (144 lignes) |
| `ui_utils.ts` | Architect | Utilitaires UI (Toast, Haptic) (31 lignes) |
| `categories.ts` | Architect | Catégories de dépenses prédéfinies |

### Export & UI
| File | Owner | Purpose |
|------|-------|---------|
| `export_manager.ts` | Architect | Export PDF/CSV |
| `style.css` | Neon Ghost | Design system complet (~1599 lignes) |
| `index.html` | Neon Ghost | Structure UI (~766 lignes) |

---

## Dialogue Protocol
- Décisions majeures discutées dans `docs/DIALOGUE_LOG.md`.
- Conflits résolus par **BMad Master**.
- **Neon Ghost** a droit de veto sur l'esthétique UI/UX.
- **Protocol Zero** doit signer tous les déploiements.
