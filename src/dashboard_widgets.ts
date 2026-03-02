/**
 * [L'ARCHITECTE] Dashboard Widgets Manager
 * Handles Hero Date, P&L Widgets, Day Browser, and Trade Modals.
 */
import { PersistenceEngine } from './persistence';
import { escapeHTML } from './sanitize';
import { showToast, triggerHaptic } from './ui_utils';
import { IntelligenceEngine } from './intelligence_engine';
import { EvolutionChart } from './evolution_chart';
import type { TradeWithFees, TradeFee } from './models';

export class DashboardWidgets {
  private static allTradesCache: TradeWithFees[] = [];
  private static currentDayOffset = 0;

  static init(trades: TradeWithFees[]) {
    this.allTradesCache = trades;
    this.initHeroDate();
    this.initTradeModal();
    this.initDayBrowser();
    this.initPessimisticMode();
    this.updateWidgets();
  }

  static setTrades(trades: TradeWithFees[]) {
    this.allTradesCache = trades;
  }

  private static isPessimistic = false;

  private static initPessimisticMode() {
    const btn = document.getElementById('toggle-pessimistic');
    btn?.addEventListener('click', () => {
      this.isPessimistic = !this.isPessimistic;
      triggerHaptic(this.isPessimistic ? 'warning' : 'click');

      // Update UI state
      btn.classList.toggle('active-risk', this.isPessimistic);
      document.getElementById('pessimistic-badge')!.style.display = this.isPessimistic ? 'inline-block' : 'none';
      document.getElementById('risk-card')!.style.display = this.isPessimistic ? 'block' : 'none';
      document.getElementById('diversification-card')!.style.display = this.isPessimistic ? 'block' : 'none';

      if (this.isPessimistic) {
        showToast('🛡️ Audit Pessimiste Activé', 'info');
        this.runRiskAnalysis();
      } else {
        showToast('Vue Standard Restaurée', 'info');
      }

      this.updateWidgets();
      // Notify components to refresh with pessimistic values if needed
      if (EvolutionChart.update) EvolutionChart.update();
    });
  }

  static initHeroDate() {
    const el = document.getElementById('hero-date');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleDateString('fr-FR', {
      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
    }).toUpperCase();
  }

  static updateWidgets() {
    const now = Date.now();
    const periods = [
      { hours: 24, valueId: 'widget-pnl-24h', metaId: 'widget-meta-24h' },
      { hours: 24 * 7, valueId: 'widget-pnl-7d', metaId: 'widget-meta-7d' },
      { hours: 24 * 30, valueId: 'widget-pnl-30d', metaId: 'widget-meta-30d' },
    ];

    for (const { hours, valueId, metaId } of periods) {
      const cutoff = now - hours * 3600_000;
      const filtered = this.allTradesCache.filter(t => t.trade.timestamp >= cutoff);
      let totalPnL = 0;
      for (const { trade, fees } of filtered) {
        const totalFees = fees.reduce((s, f) => s + f.amount, 0);
        totalPnL += trade.grossPnL - totalFees;
      }

      const valueEl = document.getElementById(valueId);
      const metaEl = document.getElementById(metaId);
      if (valueEl) {
        valueEl.textContent = `${totalPnL >= 0 ? '+' : ''}${totalPnL.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`;
        valueEl.className = `widget-value ${totalPnL >= 0 ? 'pnl-pos' : 'pnl-neg'}`;
      }
      if (metaEl) {
        metaEl.textContent = `${filtered.length} trade${filtered.length !== 1 ? 's' : ''}`;
      }
    }

    // Hero P&L (today = since midnight)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTrades = this.allTradesCache.filter(t => t.trade.timestamp >= todayStart.getTime());
    let todayPnL = 0;
    for (const { trade, fees } of todayTrades) {
      todayPnL += trade.grossPnL - fees.reduce((s, f) => s + f.amount, 0);
    }
    const profitEl = document.getElementById('profit-value');
    const countEl = document.getElementById('profit-trades-count');
    if (profitEl) {
      profitEl.textContent = `${todayPnL >= 0 ? '+' : ''}${todayPnL.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`;
      profitEl.className = todayPnL >= 0 ? 'pnl-pos' : 'pnl-neg';
    }
    if (countEl) {
      countEl.textContent = `${todayTrades.length} TRADE${todayTrades.length !== 1 ? 'S' : ''}`;
    }

    // Cumulative fees
    let totalFees = 0;
    for (const { fees } of this.allTradesCache) {
      totalFees += fees.reduce((s, f) => s + f.amount, 0);
    }
    const feesEl = document.getElementById('total-fees-display');
    if (feesEl) {
      feesEl.textContent = `${totalFees.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`;
    }
  }

  static updateCryptoWidgets(equity: number, unrealizedPnL: number) {
    const fmt = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2 });

    // In Pessimistic Mode, we display a virtual -50% on equity for the "Scénario Catastrophe"
    const displayEquity = this.isPessimistic ? equity * 0.5 : equity;

    const eqEl = document.getElementById('crypto-equity-value');
    const pnlMetaEl = document.getElementById('crypto-equity-pnl');
    const mainEquityEl = document.getElementById('equity-value');

    if (eqEl) {
      eqEl.textContent = `${fmt(displayEquity)} $`;
      eqEl.className = `widget-value ${this.isPessimistic ? 'pnl-neg' : ''}`;
    }
    if (mainEquityEl) {
      mainEquityEl.textContent = `${fmt(displayEquity)} $`;
      mainEquityEl.className = `title-hero hw-font-hero ${this.isPessimistic ? 'pnl-neg' : ''}`;
    }
    if (pnlMetaEl) {
      pnlMetaEl.textContent = this.isPessimistic ? 'Projection Crash -50%' : 'Solde du compte BingX';
    }
    const upnlEl = document.getElementById('crypto-unrealized-pnl');
    if (upnlEl) {
      // In pessimistic mode, we might assume unrealized PnL is also hit or just keep it real
      upnlEl.textContent = `${unrealizedPnL >= 0 ? '+' : ''}${fmt(unrealizedPnL)} $`;
      upnlEl.className = `widget-value ${unrealizedPnL >= 0 ? 'pnl-pos glow-positive' : 'pnl-neg'}`;
    }
    const sizingEl = document.getElementById('max-trade-size');
    if (sizingEl) {
      // Risk reduction recommendation in pessimistic mode
      const riskPerTrade = this.isPessimistic ? 0.01 : 0.05;
      const maxSize = displayEquity * riskPerTrade;
      sizingEl.textContent = `${fmt(maxSize)} $`;
    }

    if (this.isPessimistic) this.runRiskAnalysis(equity);
  }

  private static async runRiskAnalysis(cryptoEquity: number = 0) {
    // 1. Gather financial snapshot (now with items from V2)
    const allocations = await PersistenceEngine.getAllocations();
    const latestAllocation = allocations.length > 0 ? allocations[0] : null; // getAllocations is descending
    if (!latestAllocation) return;

    const platforms = await PersistenceEngine.getPlatforms();
    const platformMap = new Map(platforms.map(p => [p.id, p.name]));

    const itemsForLogic = latestAllocation.items.map(it => ({
      category: it.category,
      amount: it.amount,
      platformId: it.platform_id,
      platformName: it.platform_id ? platformMap.get(it.platform_id) : undefined
    }));

    // Add crypto as an item for exposure analysis
    if (cryptoEquity > 0) {
      itemsForLogic.push({
        category: 'investissement',
        amount: cryptoEquity,
        platformName: 'BingX'
      });
    }

    const securityBuffer = latestAllocation.items
      .filter(i => i.category === 'securite')
      .reduce((sum, i) => sum + i.amount, 0);

    const liabilities = await PersistenceEngine.getLiabilities();
    const totalLiabilities = liabilities.filter(l => l.active === 1).reduce((s, l) => s + l.remainingAmount, 0);

    // Necessities (besoins) as monthly expenses proxy
    const monthlyExpenses = latestAllocation.items
      .filter(i => i.category === 'besoins')
      .reduce((sum, i) => sum + i.amount, 0);

    const analysis = IntelligenceEngine.analyze({
      grossWealth: latestAllocation.total + cryptoEquity,
      netWorth: (latestAllocation.total + cryptoEquity) - totalLiabilities,
      totalLiabilities,
      monthlyExpenses,
      securityBuffer
    }, itemsForLogic);

    // 2. Update Risk Card UI (Resilience)
    const runwayEl = document.getElementById('risk-runway');
    const crashEl = document.getElementById('risk-crash');
    const scoreFill = document.getElementById('risk-score-fill');
    const scoreLabel = document.getElementById('risk-score-label');

    const fmt = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2 });

    if (runwayEl) runwayEl.textContent = `${analysis.runwayMonths.toFixed(1)} mois`;
    if (crashEl) crashEl.textContent = `${fmt(analysis.crashNetWorth)} $`;
    if (scoreLabel) scoreLabel.textContent = `SCORE RÉSILIENCE : ${analysis.riskScore}/100`;

    if (scoreFill) {
      scoreFill.style.width = `${analysis.riskScore}%`;
      const colors = { 'SECURE': '#10B981', 'WARNING': '#F59E0B', 'CRITICAL': '#EF4444' };
      scoreFill.style.background = colors[analysis.status];
    }

    // 3. Update Diversification Card UI (Intelligence V2)
    const divCard = document.getElementById('diversification-card');
    if (divCard) {
      divCard.style.display = this.isPessimistic ? 'block' : 'none';
      const divScoreEl = document.getElementById('diversification-score');
      const divFillEl = document.getElementById('diversification-score-fill');
      const expMaxEl = document.getElementById('exposure-max');
      const alertsContainer = document.getElementById('exposure-alerts-container');

      if (divScoreEl) divScoreEl.textContent = `${analysis.diversificationScore}/100`;
      if (divFillEl) divFillEl.style.width = `${analysis.diversificationScore}%`;

      const maxExp = analysis.exposureAlerts.length > 0
        ? Math.max(...analysis.exposureAlerts.map(a => a.percentage))
        : 0;
      if (expMaxEl) expMaxEl.textContent = maxExp > 0 ? `${maxExp}%` : 'Sain';

      if (alertsContainer) {
        if (analysis.exposureAlerts.length === 0) {
          alertsContainer.innerHTML = '<div class="label-caps hw-text-tiny" style="color:var(--color-primary); opacity:0.8;">✅ AUCUNE CONCENTRATION RISQUÉE</div>';
        } else {
          alertsContainer.innerHTML = analysis.exposureAlerts.map(alert => `
            <div class="exposure-alert ${alert.severity === 'CRITICAL' ? 'critical' : 'warning'}">
              <span class="exposure-alert-label">${alert.type === 'PLATFORM' ? 'PLATEFORME' : 'ACTIF'} : ${escapeHTML(alert.label)}</span>
              <span class="exposure-alert-badge">${alert.percentage}%</span>
            </div>
          `).join('');
        }
      }
    }
  }

  static initDayBrowser() {
    const prevBtn = document.getElementById('day-prev');
    const nextBtn = document.getElementById('day-next');
    const container = document.getElementById('trade-day-container');

    prevBtn?.addEventListener('click', () => {
      this.currentDayOffset++;
      this.renderDayView();
    });

    nextBtn?.addEventListener('click', () => {
      if (this.currentDayOffset > 0) {
        this.currentDayOffset--;
        this.renderDayView();
      }
    });

    if (container) {
      let startX = 0;
      container.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        container.classList.add('swiping');
      }, { passive: true });

      container.addEventListener('touchend', (e) => {
        const endX = e.changedTouches[0].clientX;
        const diff = endX - startX;
        container.classList.remove('swiping');
        if (Math.abs(diff) > 60) {
          if (diff > 0) this.currentDayOffset++;
          else if (this.currentDayOffset > 0) this.currentDayOffset--;
          this.renderDayView();
        }
      }, { passive: true });
    }

    this.renderDayView();
  }

  static renderDayView() {
    const container = document.getElementById('trade-day-container');
    const dayLabel = document.getElementById('day-label');
    const nextBtn = document.getElementById('day-next') as HTMLButtonElement | null;
    const dailyPnl = document.getElementById('daily-pnl');
    if (!container) return;

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - this.currentDayOffset);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    if (nextBtn) nextBtn.disabled = this.currentDayOffset === 0;
    if (dayLabel) {
      if (this.currentDayOffset === 0) dayLabel.textContent = "AUJOURD'HUI";
      else if (this.currentDayOffset === 1) dayLabel.textContent = 'HIER';
      else dayLabel.textContent = targetDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
    }

    const dayTrades = this.allTradesCache
      .filter(t => t.trade.timestamp >= targetDate.getTime() && t.trade.timestamp < nextDay.getTime())
      .sort((a, b) => b.trade.timestamp - a.trade.timestamp);

    if (dayTrades.length === 0) {
      container.innerHTML = `<div class="day-empty">Aucune opération ce jour</div>`;
      if (dailyPnl) {
        dailyPnl.textContent = '0,00 €';
        dailyPnl.className = 'summary-value';
      }
      return;
    }

    let dayTotal = 0;
    container.innerHTML = dayTrades.map(({ trade: t, fees }) => {
      const totalFees = fees.reduce((s: number, f: TradeFee) => s + f.amount, 0);
      const netPnL = t.grossPnL - totalFees;
      dayTotal += netPnL;
      const time = new Date(t.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="hw-list-item clickable" data-trade-id="${t.id}" role="button" tabindex="0">
          <div style="flex: 1;">
            <div style="font-weight: 700;">${escapeHTML(t.pair)}</div>
            <div class="label-caps" style="font-size: 0.55rem; color: var(--color-slate-400);">${escapeHTML(t.type)} ${t.leverage}X · ${time} · FRAIS ${totalFees.toFixed(3)} €</div>
          </div>
          <div class="${netPnL >= 0 ? 'pnl-pos' : 'pnl-neg'}" style="text-align: right;">
            <div style="font-weight: 800;">${netPnL >= 0 ? '+' : ''}${netPnL.toFixed(2)} €</div>
          </div>
        </div>
      `;
    }).join('');

    if (dailyPnl) {
      dailyPnl.textContent = `${dayTotal >= 0 ? '+' : ''}${dayTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`;
      dailyPnl.className = `summary-value ${dayTotal >= 0 ? 'pnl-pos' : 'pnl-neg'}`;
    }

    container.querySelectorAll('[data-trade-id]').forEach(el => {
      el.addEventListener('click', () => {
        const tradeId = (el as HTMLElement).dataset.tradeId;
        if (tradeId) this.showTradeModal(tradeId);
      });
    });
  }

  static initTradeModal() {
    const modal = document.getElementById('trade-modal');
    const closeBtn = document.getElementById('trade-modal-close');
    modal?.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    closeBtn?.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });
  }

  static async showTradeModal(tradeId: string) {
    const result = await PersistenceEngine.getTradeWithFees(tradeId);
    if (!result) return;
    const { trade, fees } = result;
    const totalFees = fees.reduce((sum, f) => sum + f.amount, 0);
    const netPnL = trade.grossPnL - totalFees;

    const pairEl = document.getElementById('tm-pair');
    const badgeEl = document.getElementById('tm-badge');
    if (pairEl) pairEl.textContent = trade.pair;
    if (badgeEl) {
      badgeEl.textContent = `${trade.type} ${trade.leverage}X`;
      badgeEl.className = `trade-sheet-badge ${trade.type === 'SHORT' ? 'short' : ''}`;
    }

    const set = (id: string, val: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    set('tm-entry', `${trade.entryPrice.toLocaleString()} €`);
    set('tm-exit', trade.exitPrice ? `${trade.exitPrice.toLocaleString()} €` : 'EN COURS');
    set('tm-size', `${trade.size.toLocaleString()} USDT`);
    set('tm-leverage', `${trade.leverage}X`);
    set('tm-date', new Date(trade.timestamp).toLocaleString('fr-FR'));
    set('tm-status', trade.status === 'CLOSED' ? '✅ CLÔTURE (SORTIE)' : '🔵 OUVERTURE (ENTRÉE)');

    const feesContainer = document.getElementById('tm-fees');
    if (feesContainer) {
      if (fees.length === 0) feesContainer.innerHTML = '<div class="text-muted" style="padding:8px; font-size:0.8rem;">Aucun frais enregistré</div>';
      else feesContainer.innerHTML = fees.map(f => `
        <div class="trade-fee-row">
          <span class="fee-type">${escapeHTML(f.fee_type)} ${f.is_actual ? '<span class="fee-actual">RÉEL</span>' : ''}</span>
          <span class="fee-amount">-${f.amount.toFixed(4)} €</span>
        </div>
      `).join('');
    }

    const banner = document.getElementById('tm-pnl-banner');
    if (banner) banner.className = `trade-pnl-banner ${netPnL >= 0 ? 'pnl-pos' : 'pnl-neg'}`;
    set('tm-gross', `${trade.grossPnL >= 0 ? '+' : ''}${trade.grossPnL.toFixed(2)} €`);
    set('tm-total-fees', `-${totalFees.toFixed(4)} €`);
    set('tm-net', `${netPnL >= 0 ? '+' : ''}${netPnL.toFixed(2)} €`);

    const modal = document.getElementById('trade-modal');
    if (modal) {
      modal.style.display = 'flex';
      triggerHaptic('success');
    }
  }
}
