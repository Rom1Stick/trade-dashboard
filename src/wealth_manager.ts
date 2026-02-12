import { Chart, registerables } from 'chart.js';
import { WealthHistoryEngine } from './wealth_history_engine';
import type { AllocationWithItems } from './wealth_history_engine';
import { WealthEngine } from './wealth_engine';
import { escapeHTML } from './sanitize';

Chart.register(...registerables);

/**
 * [PRO] WealthManager — 3FN
 * Gestion du Hub Patrimoine avec persistance normalisée.
 */
export class WealthManager {
  private static forecastChart: Chart | null = null;
  private static pieChart: Chart | null = null;
  private static currentAPR = 12;

  static async init() {
    console.log("[L'Architecte] Initialisation du Hub Patrimoine...");

    // Formulaire d'allocation
    const form = document.getElementById('wealth-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('salary-input') as HTMLInputElement;
      const amount = parseFloat(input.value);

      if (isNaN(amount) || amount <= 0) return;

      await this.registerAllocation(amount);
      input.value = '';
      this.triggerHaptic('success');
    });

    // Contrôle APR
    const slider = document.getElementById('apr-slider') as HTMLInputElement;
    const aprLabel = document.getElementById('apr-value');
    slider?.addEventListener('input', () => {
      this.currentAPR = parseInt(slider.value);
      if (aprLabel) aprLabel.textContent = this.currentAPR.toString();
      this.refreshForecast();
    });

    // Hydratation initiale
    if (document.getElementById('view-wealth')) {
      await this.hydrate();
    }
  }

  private static triggerHaptic(type: 'click' | 'success') {
    if ('vibrate' in navigator) {
      navigator.vibrate(type === 'success' ? [50, 30, 50] : 10);
    }
  }

  /**
   * Enregistrer une allocation normalisée 3FN.
   * Chaque soumission = nouvelle entrée (plus d'écrasement).
   */
  static async registerAllocation(amount: number) {
    const alloc = WealthEngine.allocate(amount);

    await WealthHistoryEngine.addEntry(amount, {
      besoins: alloc.necessities,
      investissement: alloc.investment,
      securite: alloc.securityBuffer,
      loisirs: alloc.lifestyle
    });

    await this.hydrate();
    console.log(`[L'Architecte] Allocation de ${amount} € enregistrée.`);
  }

  static async hydrate() {
    if (!document.getElementById('view-wealth')) return;
    try {
      const history = await WealthHistoryEngine.getHistory();
      const accumulated = await WealthHistoryEngine.getTotalAccumulated();

      this.updateNetWorthHeader(accumulated);
      this.renderHistory(history);

      if (history.length > 0) {
        const latest = history[0];
        this.renderPieChart(latest);
        this.refreshForecast(history);
      }
    } catch (err) {
      console.error("[L'Architecte] Échec de l'hydratation :", err);
    }
  }

  private static updateNetWorthHeader(accWealth: number) {
    const el = document.getElementById('total-net-worth');
    if (!el) return;

    const equityValueEl = document.getElementById('equity-value');
    const equityText = equityValueEl ? equityValueEl.textContent || "0 €" : "0 €";
    const cryptoEquity = parseFloat(equityText.replace(/[$,€\s]/g, '').replace(',', '.')) || 0;

    const total = accWealth + cryptoEquity;
    el.textContent = `${total.toLocaleString(undefined, { minimumFractionDigits: 2 })} €`;
  }

  private static renderHistory(history: AllocationWithItems[]) {
    const container = document.getElementById('wealth-history-list');
    if (!container) return;

    if (history.length === 0) {
      container.innerHTML = '<div class="text-muted" style="padding: 20px; text-align: center;">Aucun historique enregistré.</div>';
      return;
    }

    container.innerHTML = `
      <div class="label-caps" style="margin-bottom: 12px;">HISTORIQUE DU JOURNAL</div>
      ${history.map(entry => `
        <div class="hw-list-item">
          <div>
            <div style="font-weight: 700; color: var(--color-primary);">${escapeHTML(entry.label || 'Allocation')}</div>
            <div class="label-caps" style="font-size: 0.6rem;">${new Date(entry.timestamp).toLocaleDateString('fr-FR')}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 800; font-size: 1.1rem;">+${entry.total.toLocaleString()} €</div>
            <div class="label-caps" style="font-size: 0.55rem; color: var(--color-success);">VALIDÉ</div>
          </div>
        </div>
      `).join('')}
    `;
  }

  private static renderPieChart(entry: AllocationWithItems) {
    const ctx = document.getElementById('allocationPieChart') as HTMLCanvasElement;
    if (!ctx) return;

    if (this.pieChart) this.pieChart.destroy();

    // Extraire les données depuis les items normalisés
    const categoryMap: Record<string, number> = { besoins: 0, investissement: 0, securite: 0, loisirs: 0 };
    entry.items.forEach(item => { categoryMap[item.category] = item.amount; });

    const data = [categoryMap.besoins, categoryMap.investissement, categoryMap.securite, categoryMap.loisirs];
    const labels = ['Besoins', 'Investissement', 'Sécurité', 'Loisirs'];
    const colors = ['#38BDF8', '#10B981', '#F59E0B', '#6366F1'];

    this.pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 0
        }]
      },
      options: {
        cutout: '75%',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1E293B',
            titleColor: '#F8FAFC',
            bodyColor: '#94A3B8',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8
          }
        }
      }
    });

    this.renderLegend(labels, data, colors);
  }

  private static renderLegend(labels: string[], values: number[], colors: string[]) {
    const container = document.getElementById('allocation-legend');
    if (!container) return;

    container.innerHTML = labels.map((label, i) => `
      <div class="legend-card">
        <div style="display: flex; align-items: center;">
          <span class="legend-dot" style="background: ${colors[i]}"></span>
          <span class="label-caps" style="font-size: 0.55rem;">${label}</span>
        </div>
        <div style="font-weight: 700; font-size: 0.9rem;">${values[i].toLocaleString()} €</div>
      </div>
    `).join('');
  }

  private static refreshForecast(history?: AllocationWithItems[]) {
    const ctx = document.getElementById('forecastChart') as HTMLCanvasElement;
    if (!ctx) return;

    if (this.forecastChart) this.forecastChart.destroy();

    const monthlyContribution = history && history.length > 0 ? history[0].total : 1000;
    const simulation = WealthEngine.calculateCompound(monthlyContribution, this.currentAPR, 120);

    this.forecastChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: simulation.map(s => `Y${Math.floor(s.month / 12)}`),
        datasets: [{
          label: 'Croissance Prévue (€)',
          data: simulation.map(s => s.balance),
          borderColor: '#38BDF8',
          borderWidth: 3,
          pointRadius: 0,
          tension: 0.4,
          fill: true,
          backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return;
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(56, 189, 248, 0.2)');
            gradient.addColorStop(1, 'rgba(56, 189, 248, 0)');
            return gradient;
          }
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1E293B',
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => ` ${ctx.raw?.toLocaleString()} €`
            }
          }
        },
        scales: {
          x: { display: false },
          y: {
            grid: { color: 'rgba(255,255,255,0.03)' },
            ticks: { color: '#64748B', font: { size: 9 }, callback: (v) => `${(Number(v) / 1000).toFixed(0)}k €` }
          }
        }
      }
    });
  }
}
