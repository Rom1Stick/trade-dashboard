import './style.css';
import { WealthManager } from './wealth_manager';
import { StreamManager } from './stream_manager';
import { PersistenceEngine } from './persistence';
import { SafeVault } from './vault';
import { BingXConnector } from './bingx_connector';
import { ExpenseManager } from './expense_manager';
import { SubscriptionManager } from './subscription_manager';
import { CurrencyManager } from './currency_manager';
import { LiabilityManager } from './liability_manager';
import { Chart, registerables } from 'chart.js';
import { VaultPanel } from './vault_panel';
import { DashboardWidgets } from './dashboard_widgets';
import { EvolutionChart } from './evolution_chart';
import { MonteCarloUI } from './monte_carlo_ui';
import { showToast, triggerHaptic } from './ui_utils';

Chart.register(...registerables);

/**
 * [L'ARCHITECTE] AppEngine — Deconstructed
 * Orchestrateur noyau réduit à l'infrastructure et à la sync.
 */
class AppEngine {
  private streamer!: StreamManager;

  constructor() {
    this.init();
  }

  private async init() {
    console.log("[L'Architecte] Démarrage du Système Heavyweight...");

    await PersistenceEngine.init();
    await WealthManager.init();

    // Cache trades for V2 — Purge old trades on startup
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    await PersistenceEngine.purgeOldTrades(todayStart.getTime());
    const trades = await PersistenceEngine.getAllTradesWithFees();

    // Infrastructure & Sync
    this.initPasscode();
    this.initNavigation();
    this.initPrivacyMode();
    this.initConfigForm();
    this.initStreamer();
    this.initSync();

    // External Managers
    ExpenseManager.init();
    await SubscriptionManager.init();
    this.initSubTabs();
    this.initExportButtons();
    void CurrencyManager.init();
    LiabilityManager.init();

    // Extracted Modules
    VaultPanel.init();
    DashboardWidgets.init(trades);
    EvolutionChart.init(trades);
    MonteCarloUI.init();

    console.log("[L'Architecte] Système Opérationnel.");
  }

  private initNavigation() {
    const navLinks = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view-section');

    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = (link as HTMLElement).dataset.view;
        if (!target) return;

        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        views.forEach(v => {
          (v as HTMLElement).style.display = v.id === `view-${target}` ? 'block' : 'none';
        });

        triggerHaptic('click');
      });
    });

    const configTrigger = document.getElementById('nav-config-trigger');
    configTrigger?.addEventListener('click', () => {
      navLinks.forEach(l => l.classList.remove('active'));
      views.forEach(v => {
        (v as HTMLElement).style.display = v.id === 'view-config' ? 'block' : 'none';
      });
      triggerHaptic('click');
    });
  }

  private initSubTabs() {
    const tabs = document.querySelectorAll('.sub-tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const parent = tab.closest('.sub-tab-bar');
        const targetId = (tab as HTMLElement).dataset.subtab;
        if (!parent || !targetId) return;

        parent.querySelectorAll('.sub-tab-btn').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Hide all sub-tabs, show the target one
        document.querySelectorAll('.subtab-content').forEach(v => {
          (v as HTMLElement).style.display = v.id === `subtab-${targetId}` ? 'block' : 'none';
        });

        triggerHaptic('click');
      });
    });
  }

  private initExportButtons() {
    document.getElementById('export-pdf')?.addEventListener('click', () => {
      showToast('Export PDF en cours...', 'info');
      // ExportManager.exportWealthPDF(); // Future implementation
    });
    document.getElementById('export-csv')?.addEventListener('click', () => {
      showToast('Export CSV en cours...', 'info');
      // ExportManager.exportWealthCSV(); // Future implementation
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

      triggerHaptic('click');
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
          showToast("MOT DE PASSE REQUIS (8+ CARACTÈRES)", "error");
          return;
        }

        const encKey = await SafeVault.encrypt(key, vaultPassword);
        const encSecret = await SafeVault.encrypt(secret, vaultPassword);

        localStorage.setItem('BINGX_API_KEY_SECURE', encKey);
        localStorage.setItem('BINGX_API_SECRET_SECURE', encSecret);
        // Cache vault password to prevent refriction
        sessionStorage.setItem('GRID_VAULT_CACHE', vaultPassword);

        showToast("COFFRE LIÉ", "success");
        triggerHaptic('success');
      } catch (err) {
        showToast("ERREUR COFFRE", "error");
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

  private initSync() {
    const btn = document.getElementById('btn-sync-bingx');
    const syncLabel = document.getElementById('sync-label');
    const syncIcon = document.getElementById('sync-icon');
    const syncTimestamp = document.getElementById('sync-timestamp');

    if (!btn) return;

    const lastSync = localStorage.getItem('BINGX_LAST_SYNC');
    if (lastSync && syncTimestamp) {
      syncTimestamp.textContent = `DERNIÈRE SYNC : ${new Date(parseInt(lastSync)).toLocaleString('fr-FR')}`;
    }

    btn.addEventListener('click', async () => {
      const encKey = localStorage.getItem('BINGX_API_KEY_SECURE');
      const encSecret = localStorage.getItem('BINGX_API_SECRET_SECURE');

      if (!encKey || !encSecret) {
        showToast('CONFIGUREZ VOS CLÉS API DANS ⚙️', 'error');
        return;
      }

      let password = sessionStorage.getItem('GRID_VAULT_CACHE');
      if (!password) {
        password = prompt('🔐 Mot de passe du coffre-fort :');
        if (!password) return;
        sessionStorage.setItem('GRID_VAULT_CACHE', password);
      }

      btn.setAttribute('disabled', 'true');
      btn.style.opacity = '0.6';
      if (syncLabel) syncLabel.textContent = 'SYNCHRONISATION...';
      if (syncIcon) syncIcon.textContent = '⏳';

      try {
        const apiKey = await SafeVault.decrypt(encKey, password);
        const apiSecret = await SafeVault.decrypt(encSecret, password);
        const connector = new BingXConnector({ apiKey, secretKey: apiSecret });
        const balance = await connector.fetchBalance();

        const startDate = new Date('2026-02-11T00:00:00Z');

        await PersistenceEngine.clearTrades();
        const freshTrades = await connector.fetchTrades({
          limit: 1000,
          startTime: startDate.getTime(),
        });

        const updatedTrades = await PersistenceEngine.getAllTradesWithFees();

        // Refresh UI via delegates
        DashboardWidgets.setTrades(updatedTrades);
        DashboardWidgets.updateWidgets();
        DashboardWidgets.renderDayView();

        EvolutionChart.setTrades(updatedTrades);
        EvolutionChart.update();

        if (balance) {
          const equityEl = document.getElementById('equity-value');
          const profitEl = document.getElementById('profit-value');
          if (equityEl) equityEl.textContent = `${balance.equity.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} $`;
          if (profitEl) {
            const pnl = balance.unrealizedPnL;
            profitEl.textContent = `${pnl >= 0 ? '+' : ''}${pnl.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} $`;
            profitEl.className = pnl >= 0 ? 'pnl-pos' : 'pnl-neg';
          }
          DashboardWidgets.updateCryptoWidgets(balance.equity, balance.unrealizedPnL);
        }

        const now = Date.now();
        localStorage.setItem('BINGX_LAST_SYNC', now.toString());
        if (syncTimestamp) syncTimestamp.textContent = `DERNIÈRE SYNC : ${new Date(now).toLocaleString('fr-FR')}`;

        showToast(`${freshTrades.length} TRADE(S) SYNCHRONISÉ(S)`, 'success');
        triggerHaptic('success');

      } catch (err: any) {
        console.error('[BingX Sync] Error:', err);
        if (err.message?.includes('VAULT_PURGED')) showToast('COFFRE PURGÉ — RECONFIGURER LES CLÉS', 'error');
        else if (err.message?.includes('VAULT_BREACH')) showToast('MOT DE PASSE INCORRECT', 'error');
        else showToast(`ERREUR SYNC : ${err.message || 'Inconnue'}`, 'error');
      } finally {
        btn.removeAttribute('disabled');
        btn.style.opacity = '1';
        if (syncLabel) syncLabel.textContent = 'SYNC BINGX';
        if (syncIcon) syncIcon.textContent = '🔄';
      }
    });
  }
  private initPasscode() {
    const passcode = localStorage.getItem('GRID_ACCESS_CODE');
    const overlay = document.getElementById('passcode-overlay');
    const input = document.getElementById('passcode-input') as HTMLInputElement;
    const form = document.getElementById('passcode-form');
    const errorMsg = document.getElementById('passcode-error');

    if (passcode === '565256') {
      if (overlay) overlay.style.display = 'none';
    } else {
      if (overlay) overlay.style.display = 'flex';
    }

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (input?.value === '565256') {
        localStorage.setItem('GRID_ACCESS_CODE', '565256');
        if (overlay) overlay.style.display = 'none';
        triggerHaptic('success');
      } else {
        if (errorMsg) errorMsg.style.display = 'block';
        if (input) input.value = '';
        triggerHaptic('error');
      }
    });
  }
}

new AppEngine();
