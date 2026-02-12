import './style.css';
import { WealthManager } from './wealth_manager';
import { StreamManager } from './stream_manager';
import { PersistenceEngine } from './persistence';
import { SafeVault } from './vault';
import { ExpenseManager } from './expense_manager';
import { SubscriptionManager } from './subscription_manager';
import { mockTrades, mockTradeFees } from './mock_data';
import { Chart, registerables } from 'chart.js';
import type { TradeFee } from './models';
import { escapeHTML } from './sanitize';

Chart.register(...registerables);

/**
 * [L'ARCHITECTE] AppEngine — 3FN
 * Noyau opérationnel avec persistence normalisée.
 */
class AppEngine {
  private streamer!: StreamManager;
  private evolutionChart: Chart | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    console.log("[L'Architecte] Démarrage du Système Heavyweight...");

    // Infrastructure — DB V5
    await PersistenceEngine.init();
    await this.seedIfNeeded();
    await WealthManager.init();

    // Hydratation UI
    this.initNavigation();
    this.initPrivacyMode();
    this.initConfigForm();
    this.initStreamer();
    this.initTrades();
    this.initTradeModal();
    ExpenseManager.init();
    await SubscriptionManager.init();
    this.initSubTabs();
    this.initEvolutionChart();

    console.log("[L'Architecte] Système Opérationnel.");
  }

  /**
   * Seed conditionnel : insert les données mock une seule fois.
   * Utilise app_config.seeded pour éviter le re-seed.
   */
  private async seedIfNeeded() {
    const seeded = await PersistenceEngine.getConfig('seeded');
    if (seeded === 'true') return;

    console.log("[L'Architecte] Premier lancement — injection des données de démonstration...");
    await PersistenceEngine.saveTrades(mockTrades, mockTradeFees);
    await PersistenceEngine.setConfig('seeded', 'true');
    console.log("[L'Architecte] Seed terminé.");
  }

  private initNavigation() {
    const navMap: Record<string, string> = {
      'nav-dash': 'view-dashboard',
      'nav-wealth': 'view-wealth',
      'nav-lab': 'view-lab'
    };

    Object.entries(navMap).forEach(([navId, viewId]) => {
      const el = document.getElementById(navId);
      el?.addEventListener('click', (e) => {
        e.preventDefault();
        this.triggerHaptic('click');

        // Changement de vue
        document.querySelectorAll('.view-section').forEach(s => (s as HTMLElement).style.display = 'none');
        const target = document.getElementById(viewId);
        if (target) target.style.display = 'block';

        // État de la navigation
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');

        // Rafraîchissement contextuel
        if (viewId === 'view-wealth') {
          setTimeout(() => WealthManager.hydrate(), 50);
        }
        if (viewId === 'view-dashboard') this.initEvolutionChart();
      });
    });

    // Déclencheur Config (icône du haut)
    document.getElementById('nav-config-trigger')?.addEventListener('click', () => {
      document.querySelectorAll('.view-section').forEach(s => (s as HTMLElement).style.display = 'none');
      const configView = document.getElementById('view-config');
      if (configView) configView.style.display = 'block';
      this.triggerHaptic('click');
    });
  }

  private initSubTabs() {
    const bar = document.querySelector('.sub-tab-bar');
    bar?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.sub-tab-btn') as HTMLElement | null;
      if (!btn) return;

      const target = btn.dataset.subtab;
      if (!target) return;

      // Switch active button
      bar.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Switch content
      document.querySelectorAll('.subtab-content').forEach(c => (c as HTMLElement).style.display = 'none');
      const content = document.getElementById(`subtab-${target}`);
      if (content) content.style.display = 'block';

      // Re-render subscriptions when switching to that tab
      if (target === 'subscriptions') {
        SubscriptionManager.render();
      }

      this.triggerHaptic('click');
    });
  }

  private initPrivacyMode() {
    const toggle = document.getElementById('privacy-toggle');
    toggle?.addEventListener('click', () => {
      const isBlurred = document.body.classList.toggle('privacy-active');
      toggle.textContent = isBlurred ? '🕶️' : '👁️';

      const sensitive = ['total-net-worth', 'equity-value', 'profit-value'];
      sensitive.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('privacy-blur', isBlurred);
      });

      this.triggerHaptic('click');
    });
  }

  private initConfigForm() {
    const form = document.getElementById('api-form') as HTMLFormElement;
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const key = (document.getElementById('api-key') as HTMLInputElement).value;
        const secret = (document.getElementById('api-secret') as HTMLInputElement).value;
        const vaultPassword = (document.getElementById('vault-password') as HTMLInputElement)?.value;

        if (!vaultPassword || vaultPassword.length < 8) {
          this.showToast("MOT DE PASSE REQUIS (8+ CARACTÈRES)", "error");
          return;
        }

        const encKey = await SafeVault.encrypt(key, vaultPassword);
        const encSecret = await SafeVault.encrypt(secret, vaultPassword);

        localStorage.setItem('BINGX_API_KEY_SECURE', encKey);
        localStorage.setItem('BINGX_API_SECRET_SECURE', encSecret);

        this.showToast("COFFRE LIÉ", "success");
        this.triggerHaptic('success');
      } catch (err) {
        this.showToast("ERREUR COFFRE", "error");
      }
    });
  }

  private initStreamer() {
    this.streamer = new StreamManager((data: any) => {
      console.log('[Shadow Operator] Tick reçu:', data?.dataType || 'unknown');
    });
    const statusDot = document.getElementById('connection-status');

    this.streamer.onStatusChange = (status: string) => {
      if (statusDot) {
        statusDot.style.background = status === 'STABLE' ? 'var(--color-success)' : 'var(--color-danger)';
      }
    };

    this.streamer.connect();
  }

  /**
   * Chargement et affichage des trades depuis IndexedDB (3FN).
   * Les frais sont récupérés depuis le store trade_fees.
   */
  private async initTrades() {
    const tradesWithFees = await PersistenceEngine.getAllTradesWithFees();
    const container = document.getElementById('trade-list');
    if (!container) return;

    if (tradesWithFees.length === 0) {
      container.innerHTML = '<div class="text-muted" style="padding: 20px; text-align: center;">Aucun trade archivé.</div>';
      return;
    }

    container.innerHTML = `
      <div class="label-caps" style="margin-bottom: 12px;">OPÉRATIONS RÉCENTES</div>
      ${tradesWithFees.slice(0, 10).map(({ trade: t, fees }) => {
      const totalFees = fees.reduce((sum: number, f: TradeFee) => sum + f.amount, 0);
      const netPnL = t.grossPnL - totalFees;

      return `
          <div class="hw-list-item clickable" data-trade-id="${t.id}" role="button" tabindex="0">
            <div style="flex: 1;">
              <div style="font-weight: 700;">${escapeHTML(t.pair)}</div>
              <div class="label-caps" style="font-size: 0.55rem; color: var(--color-slate-400);">${escapeHTML(t.type)} ${t.leverage}X | FRAIS : ${totalFees.toFixed(3)} €</div>
            </div>
            <div class="${netPnL >= 0 ? 'pnl-pos' : 'pnl-neg'}" style="text-align: right;">
              <div style="font-weight: 800;">${netPnL >= 0 ? '+' : ''}${netPnL.toFixed(2)}</div>
              <div class="label-caps" style="font-size: 0.5rem; opacity: 0.6;">PNL NET</div>
            </div>
          </div>
        `;
    }).join('')}
    `;

    // Rendre chaque trade cliquable → ouvrir le modal P&L
    container.querySelectorAll('[data-trade-id]').forEach(el => {
      el.addEventListener('click', () => {
        const tradeId = (el as HTMLElement).dataset.tradeId;
        if (tradeId) this.showTradeModal(tradeId);
      });
    });
  }

  private initTradeModal() {
    const modal = document.getElementById('trade-modal');
    const closeBtn = document.getElementById('trade-modal-close');

    // Close on backdrop click
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });

    // Close on button click
    closeBtn?.addEventListener('click', () => {
      if (modal) modal.style.display = 'none';
    });
  }

  /**
   * Affiche la fiche P&L d'un trade (modal style broker).
   * Récupère trade + fees depuis IndexedDB (3FN).
   */
  private async showTradeModal(tradeId: string) {
    const result = await PersistenceEngine.getTradeWithFees(tradeId);
    if (!result) return;

    const { trade, fees } = result;
    const totalFees = fees.reduce((sum, f) => sum + f.amount, 0);
    const netPnL = trade.grossPnL - totalFees;

    // Header
    const pairEl = document.getElementById('tm-pair');
    const badgeEl = document.getElementById('tm-badge');
    if (pairEl) pairEl.textContent = trade.pair;
    if (badgeEl) {
      badgeEl.textContent = `${trade.type} ${trade.leverage}X`;
      badgeEl.className = `trade-sheet-badge ${trade.type === 'SHORT' ? 'short' : ''}`;
    }

    // Grid de détails
    const set = (id: string, val: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    set('tm-entry', `${trade.entryPrice.toLocaleString()} €`);
    set('tm-exit', trade.exitPrice ? `${trade.exitPrice.toLocaleString()} €` : 'EN COURS');
    set('tm-size', `${trade.size.toLocaleString()} USDT`);
    set('tm-leverage', `${trade.leverage}X`);
    set('tm-date', new Date(trade.timestamp).toLocaleString('fr-FR'));
    set('tm-status', trade.status === 'CLOSED' ? '✅ FERMÉ' : '🔵 OUVERT');

    // Section frais
    const feesContainer = document.getElementById('tm-fees');
    if (feesContainer) {
      if (fees.length === 0) {
        feesContainer.innerHTML = '<div class="text-muted" style="padding:8px; font-size:0.8rem;">Aucun frais enregistré</div>';
      } else {
        feesContainer.innerHTML = fees.map(f => `
          <div class="trade-fee-row">
            <span class="fee-type">${escapeHTML(f.fee_type)} ${f.is_actual ? '<span class="fee-actual">RÉEL</span>' : ''}</span>
            <span class="fee-amount">-${f.amount.toFixed(4)} €</span>
          </div>
        `).join('');
      }
    }

    // Bannière PnL
    const banner = document.getElementById('tm-pnl-banner');
    if (banner) {
      banner.className = `trade-pnl-banner ${netPnL >= 0 ? 'pnl-pos' : 'pnl-neg'}`;
    }
    set('tm-gross', `${trade.grossPnL >= 0 ? '+' : ''}${trade.grossPnL.toFixed(2)} €`);
    set('tm-total-fees', `-${totalFees.toFixed(4)} €`);
    set('tm-net', `${netPnL >= 0 ? '+' : ''}${netPnL.toFixed(2)} €`);

    // Ouvrir le modal
    const modal = document.getElementById('trade-modal');
    if (modal) {
      modal.style.display = 'flex';
      this.triggerHaptic('success');
    }
  }


  private async initEvolutionChart() {
    const ctx = document.getElementById('evolutionChart') as HTMLCanvasElement;
    if (!ctx || this.evolutionChart) return;

    // Charger les trades réels depuis IDB
    const tradesWithFees = await PersistenceEngine.getAllTradesWithFees();
    const sortedTrades = tradesWithFees
      .sort((a, b) => a.trade.timestamp - b.trade.timestamp);

    // Courbe d'équité cumulée
    let cumulative = 0;
    const labels = sortedTrades.map(t =>
      new Date(t.trade.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    );
    const data = sortedTrades.map(({ trade, fees }) => {
      const totalFees = fees.reduce((s, f) => s + f.amount, 0);
      cumulative += trade.grossPnL - totalFees;
      return parseFloat(cumulative.toFixed(2));
    });

    // Fallback si pas de données réelles
    if (data.length === 0) {
      labels.push('—');
      data.push(0);
    }

    this.evolutionChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: '#38BDF8',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          fill: true,
          backgroundColor: 'rgba(56, 189, 248, 0.05)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false },
          y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { display: false } }
        }
      }
    });
  }



  private showToast(msg: string, type: 'success' | 'error' | 'info' = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `hw-card glass-card toast-${type}`;
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.padding = '12px 24px';
    toast.style.borderLeft = `4px solid var(--color-${type === 'info' ? 'primary' : type})`;
    toast.style.zIndex = '9999';
    toast.innerText = msg;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 500);
    }, 3000);
  }

  private triggerHaptic(type: 'click' | 'success') {
    if ('vibrate' in navigator) {
      navigator.vibrate(type === 'success' ? [50, 30, 50] : 10);
    }
  }
}

// Initialisation privée — pas d'exposition globale
new AppEngine();
