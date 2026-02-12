import { PersistenceEngine } from './persistence';
import type { Expense, ExpenseCategory } from './models';
import { escapeHTML } from './sanitize';
import { Chart } from 'chart.js';

// Chart.register déjà effectué centralement dans main.ts

/**
 * ExpenseManager [Finari-Style]
 * Tracker de dépenses hebdomadaire avec camembert par catégorie.
 */

interface CategoryMeta {
  emoji: string;
  label: string;
  color: string;
}

const CATEGORIES: Record<ExpenseCategory, CategoryMeta> = {
  logement: { emoji: '🏠', label: 'Logement', color: '#6366F1' },
  courses: { emoji: '🛒', label: 'Courses', color: '#10B981' },
  transport: { emoji: '🚗', label: 'Transport', color: '#F59E0B' },
  loisirs: { emoji: '🎮', label: 'Loisirs', color: '#EC4899' },
  sante: { emoji: '💊', label: 'Santé', color: '#EF4444' },
  abonnements: { emoji: '📱', label: 'Abonnements', color: '#8B5CF6' },
  shopping: { emoji: '🛍️', label: 'Shopping', color: '#3B82F6' },
  autre: { emoji: '📎', label: 'Autre', color: '#6B7280' }
};

export class ExpenseManager {
  private static chart: Chart<'doughnut'> | null = null;
  private static globalChart: Chart<'doughnut'> | null = null;
  private static currentWeekOffset = 0; // 0 = this week, -1 = last week, etc.

  static init() {
    this.setupForm();
    this.setupNavigation();
    this.loadWeek();
  }

  // ─── ISO Week Utilities ────────────────────────────────

  private static getWeekKey(offset: number = 0): string {
    const now = new Date();
    now.setDate(now.getDate() + (offset * 7));

    // ISO 8601 week number
    const dt = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil((((dt.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

    return `${dt.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  }

  private static getWeekLabel(weekKey: string): string {
    // Parse "2026-W07" → date range
    const [yearStr, weekStr] = weekKey.split('-W');
    const year = parseInt(yearStr);
    const week = parseInt(weekStr);

    // Get Monday of ISO week
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

    return `Sem. ${week} — ${fmt(monday)} au ${fmt(sunday)}`;
  }

  // ─── Form Setup ────────────────────────────────────────

  private static setupForm() {
    const form = document.getElementById('expense-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const amountInput = document.getElementById('expense-amount') as HTMLInputElement;
      const categorySelect = document.getElementById('expense-category') as HTMLSelectElement;
      const labelInput = document.getElementById('expense-label') as HTMLInputElement;

      const amount = parseFloat(amountInput.value);
      const category = categorySelect.value as ExpenseCategory;
      const label = labelInput.value.trim();

      if (!amount || amount <= 0 || !label) return;

      const weekKey = this.getWeekKey(this.currentWeekOffset);

      await PersistenceEngine.saveExpense({
        amount,
        category,
        label,
        timestamp: Date.now(),
        week_key: weekKey
      });

      // Reset form
      amountInput.value = '';
      labelInput.value = '';

      // Haptic
      if (navigator.vibrate) navigator.vibrate(30);

      // Reload
      this.loadWeek();
    });
  }

  // ─── Week Navigation ──────────────────────────────────

  private static setupNavigation() {
    document.getElementById('expense-prev')?.addEventListener('click', () => {
      this.currentWeekOffset--;
      this.loadWeek();
    });
    document.getElementById('expense-next')?.addEventListener('click', () => {
      this.currentWeekOffset++;
      this.loadWeek();
    });
  }

  // ─── Load & Render ─────────────────────────────────────

  private static async loadWeek() {
    const weekKey = this.getWeekKey(this.currentWeekOffset);
    const expenses = await PersistenceEngine.getExpensesByWeek(weekKey);

    // Update week label
    const weekLabel = document.getElementById('expense-week-label');
    if (weekLabel) weekLabel.textContent = this.getWeekLabel(weekKey);

    // Update total
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalEl = document.getElementById('expense-week-total');
    if (totalEl) totalEl.textContent = `${total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`;

    // Render pie chart & list
    this.renderPieChart(expenses);
    this.renderExpenseList(expenses);

    // Render global chart (all weeks)
    this.renderGlobalChart();
  }

  // ─── Pie Chart ─────────────────────────────────────────

  private static renderPieChart(expenses: Expense[]) {
    const canvas = document.getElementById('expensePieChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Aggregate by category
    const aggregated: Record<string, number> = {};
    expenses.forEach(e => {
      aggregated[e.category] = (aggregated[e.category] || 0) + e.amount;
    });

    const cats = Object.keys(aggregated) as ExpenseCategory[];

    if (cats.length === 0) {
      if (this.chart) { this.chart.destroy(); this.chart = null; }
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#94A3B8';
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Aucune dépense', canvas.width / 2, canvas.height / 2);
      }
      // Clear legend
      const legendEl = document.getElementById('expense-legend');
      if (legendEl) legendEl.innerHTML = '';
      return;
    }

    const labels = cats.map(c => `${CATEGORIES[c].emoji} ${CATEGORIES[c].label}`);
    const data = cats.map(c => aggregated[c]);
    const colors = cats.map(c => CATEGORIES[c].color);

    if (this.chart) {
      this.chart.data.labels = labels;
      this.chart.data.datasets[0].data = data;
      this.chart.data.datasets[0].backgroundColor = colors;
      this.chart.update();
    } else {
      this.chart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: colors,
            borderWidth: 0,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: '65%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.parsed.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`
              }
            }
          }
        }
      });
    }

    // Custom legend
    const total = data.reduce((s, v) => s + v, 0);
    const legendEl = document.getElementById('expense-legend');
    if (legendEl) {
      legendEl.innerHTML = cats.map((c, i) => {
        const pct = ((data[i] / total) * 100).toFixed(0);
        return `
          <div class="legend-card">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="legend-dot" style="background: ${colors[i]};"></span>
              <span class="label-caps">${CATEGORIES[c].emoji} ${CATEGORIES[c].label}</span>
            </div>
            <div style="font-weight: 700; font-size: 1rem;">${data[i].toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</div>
            <div class="label-caps" style="font-size: 0.55rem; opacity: 0.6;">${pct}%</div>
          </div>
        `;
      }).join('');
    }
  }

  // ─── Expense List ──────────────────────────────────────

  private static renderExpenseList(expenses: Expense[]) {
    const container = document.getElementById('expense-list');
    if (!container) return;

    if (expenses.length === 0) {
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: #94A3B8; font-size: 0.85rem;">Aucune dépense cette semaine</div>';
      return;
    }

    container.innerHTML = expenses.map(e => {
      const cat = CATEGORIES[e.category];
      const time = new Date(e.timestamp).toLocaleDateString('fr-FR', {
        weekday: 'short', day: 'numeric', month: 'short'
      });

      return `
        <div class="hw-list-item expense-item" data-expense-id="${e.id}">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
            <span class="expense-cat-icon" style="background: ${cat.color}20; color: ${cat.color};">${cat.emoji}</span>
            <div style="min-width: 0;">
              <div style="font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(e.label)}</div>
              <div class="label-caps" style="font-size: 0.55rem;">${cat.label} · ${time}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 800; color: var(--color-danger);">-${e.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
            <button class="expense-delete-btn" data-del-id="${e.id}" title="Supprimer">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    // Delete handlers
    container.querySelectorAll('.expense-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const id = parseInt((btn as HTMLElement).dataset.delId || '0');
        if (id) {
          await PersistenceEngine.deleteExpense(id);
          if (navigator.vibrate) navigator.vibrate(20);
          this.loadWeek();
        }
      });
    });
  }

  // ─── Global Pie Chart (All Weeks) ───────────────────

  private static async renderGlobalChart() {
    const canvas = document.getElementById('expenseGlobalChart') as HTMLCanvasElement;
    if (!canvas) return;

    const allExpenses = await PersistenceEngine.getAllExpenses();

    // Show global total
    const grandTotal = allExpenses.reduce((s, e) => s + e.amount, 0);
    const totalEl = document.getElementById('expense-global-total');
    if (totalEl) totalEl.textContent = `Total : ${grandTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`;

    // Aggregate by category
    const aggregated: Record<string, number> = {};
    allExpenses.forEach(e => {
      aggregated[e.category] = (aggregated[e.category] || 0) + e.amount;
    });

    const cats = Object.keys(aggregated) as ExpenseCategory[];

    if (cats.length === 0) {
      if (this.globalChart) { this.globalChart.destroy(); this.globalChart = null; }
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#94A3B8';
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Aucune donnée', canvas.width / 2, canvas.height / 2);
      }
      const legendEl = document.getElementById('expense-global-legend');
      if (legendEl) legendEl.innerHTML = '';
      return;
    }

    const labels = cats.map(c => `${CATEGORIES[c].emoji} ${CATEGORIES[c].label}`);
    const data = cats.map(c => aggregated[c]);
    const colors = cats.map(c => CATEGORIES[c].color);

    if (this.globalChart) {
      this.globalChart.data.labels = labels;
      this.globalChart.data.datasets[0].data = data;
      this.globalChart.data.datasets[0].backgroundColor = colors;
      this.globalChart.update();
    } else {
      this.globalChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: colors,
            borderWidth: 0,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: '65%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.parsed.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`
              }
            }
          }
        }
      });
    }

    // Custom legend with averages
    const weekKeys = new Set(allExpenses.map(e => e.week_key));
    const numWeeks = Math.max(weekKeys.size, 1);
    const total = data.reduce((s, v) => s + v, 0);
    const legendEl = document.getElementById('expense-global-legend');
    if (legendEl) {
      legendEl.innerHTML = cats.map((c, i) => {
        const pct = ((data[i] / total) * 100).toFixed(0);
        const avg = (data[i] / numWeeks).toLocaleString('fr-FR', { minimumFractionDigits: 2 });
        return `
          <div class="legend-card">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="legend-dot" style="background: ${colors[i]};"></span>
              <span class="label-caps">${CATEGORIES[c].emoji} ${CATEGORIES[c].label}</span>
            </div>
            <div style="font-weight: 700; font-size: 1rem;">${data[i].toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</div>
            <div class="label-caps" style="font-size: 0.55rem; opacity: 0.6;">${pct}% · moy. ${avg} €/sem</div>
          </div>
        `;
      }).join('');
    }
  }
}
