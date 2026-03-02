/**
 * [L'ARCHITECTE] Evolution Chart Manager
 * Handles the equity curve chart and its period tabs.
 */
import { Chart } from 'chart.js';
import type { TradeWithFees } from './models';

export class EvolutionChart {
  private static chartInstance: Chart | null = null;
  private static chartPeriod = 30; // 7, 30, 90, 0=all
  private static trades: TradeWithFees[] = [];
  private static isPessimistic = false;

  static init(trades: TradeWithFees[]) {
    this.trades = trades;
    this.initChartPeriodTabs();
    this.update();
  }

  static setTrades(trades: TradeWithFees[]) {
    this.trades = trades;
  }

  static initChartPeriodTabs() {
    const tabContainer = document.getElementById('chart-period-tabs');
    if (!tabContainer) return;

    tabContainer.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.period-tab') as HTMLButtonElement;
      if (!btn) return;

      tabContainer.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');

      this.chartPeriod = parseInt(btn.dataset.period || '30');
      this.update();
    });
  }

  static update() {
    const ctx = document.getElementById('evolutionChart') as HTMLCanvasElement;
    if (!ctx) return;

    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    // Direct access to DashboardWidgets state or pass it
    // For simplicity, we check the DOM or a shared state. 
    // Let's use a public setter or just check button class.
    this.isPessimistic = document.getElementById('toggle-pessimistic')?.classList.contains('active-risk') || false;

    const sorted = [...this.trades].sort((a, b) => a.trade.timestamp - b.trade.timestamp);

    let filtered = sorted;
    if (this.chartPeriod > 0) {
      const cutoff = Date.now() - this.chartPeriod * 24 * 3600_000;
      filtered = sorted.filter(t => t.trade.timestamp >= cutoff);
    }

    let cumulative = 0;
    const labels: string[] = [];
    const data: number[] = [];

    for (const { trade, fees } of filtered) {
      const totalFees = fees.reduce((s, f) => s + f.amount, 0);
      cumulative += trade.grossPnL - totalFees;
      labels.push(new Date(trade.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }));
      data.push(parseFloat(cumulative.toFixed(2)));
    }

    const pessimisticData = data.map(v => parseFloat((v * 0.5).toFixed(2)));

    if (data.length === 0) {
      labels.push('—');
      data.push(0);
    }

    const chartCtx = ctx.getContext('2d');
    let gradient: CanvasGradient | string = 'rgba(56, 189, 248, 0.05)';
    if (chartCtx) {
      gradient = chartCtx.createLinearGradient(0, 0, 0, 300);
      const isPositive = data[data.length - 1] >= 0;
      if (isPositive) {
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.01)');
      } else {
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0.01)');
      }
    }

    const borderColor = data[data.length - 1] >= 0 ? '#10B981' : '#EF4444';

    this.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Standard',
            data,
            borderColor,
            borderWidth: 2,
            pointRadius: data.length > 20 ? 0 : 3,
            pointBackgroundColor: borderColor,
            tension: 0.3,
            fill: true,
            backgroundColor: gradient
          },
          ...(this.isPessimistic ? [{
            label: 'Projection Crash (-50%)',
            data: pessimisticData,
            borderColor: '#EF4444',
            borderDimension: [5, 5],
            borderWidth: 1,
            pointRadius: 0,
            tension: 0.3,
            fill: false,
            borderDash: [5, 5]
          }] : [])
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            titleColor: '#94A3B8',
            bodyColor: '#F8FAFC',
            titleFont: { size: 11, weight: 'normal' as const },
            bodyFont: { size: 14, weight: 'bold' as const },
            padding: 12,
            cornerRadius: 8,
            displayColors: false,
            callbacks: { label: (ctx) => { const y = ctx.parsed.y ?? 0; return `${y >= 0 ? '+' : ''}${y.toFixed(2)} €`; } }
          }
        },
        scales: {
          x: {
            display: true,
            grid: { display: false },
            ticks: { color: '#64748B', font: { size: 9, weight: 600 as any }, maxTicksLimit: 6, maxRotation: 0 }
          },
          y: {
            display: true,
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#64748B', font: { size: 10 }, callback: (val) => `${val} €`, maxTicksLimit: 5 }
          }
        }
      }
    });
  }
}
