/**
 * [L'ARCHITECTE] Monte Carlo UI Manager
 * Handles simulation parameters, execution, and percentile fan chart.
 */
import { Chart } from 'chart.js';
import { PersistenceEngine } from './persistence';
import { MonteCarloEngine } from './monte_carlo';
import type { MonteCarloResult } from './monte_carlo';
import { showToast, triggerHaptic } from './ui_utils';

export class MonteCarloUI {
  private static mcChart: Chart | null = null;

  static init() {
    const btn = document.getElementById('mc-run-btn');
    btn?.addEventListener('click', () => void this.run());
  }

  static async run() {
    const btn = document.getElementById('mc-run-btn') as HTMLButtonElement;
    const emptyState = document.getElementById('mc-empty-state');
    const statsCard = document.getElementById('mc-stats-card');
    const chartCard = document.getElementById('mc-chart-card');
    const resultsCard = document.getElementById('mc-results-card');

    const capital = parseFloat((document.getElementById('mc-capital') as HTMLInputElement)?.value) || 1000;
    const horizon = parseInt((document.getElementById('mc-horizon') as HTMLSelectElement)?.value) || 12;
    const sims = parseInt((document.getElementById('mc-sims') as HTMLSelectElement)?.value) || 5000;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<div class="mc-loading"><div class="mc-spinner"></div>SIMULATION EN COURS...</div>';
    }
    if (emptyState) emptyState.style.display = 'none';

    try {
      const trades = await PersistenceEngine.getTrades();
      const returns = MonteCarloEngine.extractReturns(trades);

      if (returns.length < 5) {
        showToast('Minimum 5 trades fermés requis pour la simulation.', 'error');
        if (emptyState) emptyState.style.display = 'block';
        return;
      }

      const tradesPerMonth = MonteCarloEngine.estimateTradesPerMonth(trades);

      const result = await new Promise<MonteCarloResult>((resolve) => {
        setTimeout(() => {
          resolve(MonteCarloEngine.simulate(returns, {
            initialCapital: capital,
            horizonMonths: horizon,
            tradesPerMonth,
            numSimulations: sims,
          }));
        }, 50);
      });

      if (statsCard) statsCard.style.display = 'block';
      if (chartCard) chartCard.style.display = 'block';
      if (resultsCard) resultsCard.style.display = 'block';

      const fmt = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const setTxt = (id: string, txt: string) => {
        const el = document.getElementById(id);
        if (el) el.textContent = txt;
      };

      setTxt('mc-stat-trades', `${result.stats.totalTrades}`);
      setTxt('mc-stat-avg', `${result.stats.avgReturn >= 0 ? '+' : ''}${fmt(result.stats.avgReturn)} $`);
      setTxt('mc-stat-std', `${fmt(result.stats.stdReturn)} $`);
      setTxt('mc-res-median', `${fmt(result.finalValues.p50)} $`);
      setTxt('mc-res-winrate', `${result.winRate.toFixed(1)}%`);
      setTxt('mc-res-p10', `${fmt(result.finalValues.p10)} $`);
      setTxt('mc-res-mean', `${fmt(result.finalValues.mean)} $`);
      setTxt('mc-res-p90', `${fmt(result.finalValues.p90)} $`);

      const medianEl = document.getElementById('mc-res-median');
      if (medianEl) medianEl.className = `widget-value ${result.finalValues.p50 >= capital ? 'pnl-pos' : 'pnl-neg'}`;
      const meanEl = document.getElementById('mc-res-mean');
      if (meanEl) meanEl.className = `widget-value ${result.finalValues.mean >= capital ? 'pnl-pos' : 'pnl-neg'}`;
      const winEl = document.getElementById('mc-res-winrate');
      if (winEl) winEl.className = `widget-value ${result.winRate >= 50 ? 'pnl-pos' : 'pnl-neg'}`;

      this.renderChart(result);
      showToast(`Simulation terminée — ${sims.toLocaleString()} trajectoires`, 'success');
      triggerHaptic('success');

    } catch (err: any) {
      console.error('[Monte Carlo] Error:', err);
      showToast(err.message || 'Erreur simulation', 'error');
      if (emptyState) emptyState.style.display = 'block';
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '🚀 LANCER LA SIMULATION';
      }
    }
  }

  static renderChart(result: MonteCarloResult) {
    const ctx = document.getElementById('mcChart') as HTMLCanvasElement;
    if (!ctx) return;

    if (this.mcChart) {
      this.mcChart.destroy();
      this.mcChart = null;
    }

    const { labels, percentiles, params } = result;
    const capitalLine = new Array(labels.length).fill(params.initialCapital);

    this.mcChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'P90 (Optimiste)', data: percentiles.p90, borderColor: 'rgba(16, 185, 129, 0.6)', backgroundColor: 'rgba(16, 185, 129, 0.05)', fill: '+1', borderWidth: 1, pointRadius: 0, tension: 0.3 },
          { label: 'P75', data: percentiles.p75, borderColor: 'rgba(16, 185, 129, 0.3)', backgroundColor: 'rgba(16, 185, 129, 0.08)', fill: '+1', borderWidth: 1, pointRadius: 0, tension: 0.3 },
          { label: 'Médiane (P50)', data: percentiles.p50, borderColor: '#38bdf8', backgroundColor: 'transparent', borderWidth: 2.5, pointRadius: 0, tension: 0.3 },
          { label: 'P25', data: percentiles.p25, borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.08)', fill: '-1', borderWidth: 1, pointRadius: 0, tension: 0.3 },
          { label: 'P10 (Pessimiste)', data: percentiles.p10, borderColor: 'rgba(239, 68, 68, 0.6)', backgroundColor: 'rgba(239, 68, 68, 0.05)', fill: '-1', borderWidth: 1, pointRadius: 0, tension: 0.3 },
          { label: 'Capital initial', data: capitalLine, borderColor: 'rgba(148, 163, 184, 0.4)', borderDash: [6, 4], borderWidth: 1, pointRadius: 0, fill: false },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', font: { size: 10, weight: 'bold' as any }, boxWidth: 12, padding: 12 } },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)', titleColor: '#f8fafc', bodyColor: '#e2e8f0', borderColor: 'rgba(56, 189, 248, 0.3)', borderWidth: 1, padding: 12,
            callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} $` }
          },
        },
        scales: {
          x: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#64748b', font: { size: 9 }, callback: (v) => `${Number(v).toLocaleString('fr-FR')} $` }, grid: { color: 'rgba(255,255,255,0.04)' } },
        },
      },
    });
  }
}
