import { Chart, registerables } from 'chart.js';
import { WealthHistoryEngine } from './wealth_history_engine';
import type { AllocationWithItems } from './wealth_history_engine';
import { WealthEngine } from './wealth_engine';
import { escapeHTML } from './sanitize';
import { PersistenceEngine } from './persistence';
import type { Platform } from './models';

Chart.register(...registerables);

/**
 * [PRO] WealthManager — 3FN
 * Gestion du Hub Patrimoine avec persistance normalisée et diversification multi-plateformes.
 */
export class WealthManager {
  private static wealthChart: Chart | null = null;
  private static pieChart: Chart | null = null;
  private static platformChart: Chart | null = null;
  private static platforms: Platform[] = [];
  private static platformAllocRows: { id: string, platformId: number, amount: number }[] = [];

  static async init() {
    console.log("[L'Architecte] Initialisation du Hub Patrimoine...");

    await PersistenceEngine.seedDefaultPlatforms();
    this.initPlatforms();
    this.initDiversification();
    this.initToggles();
    this.initForm();

    // Hydratation initiale
    if (document.getElementById('view-wealth')) {
      await this.hydrate();
    }
  }

  private static initToggles() {
    const configBtn = document.getElementById('toggle-wealth-config');
    const closeBtn = document.getElementById('close-wealth-config');
    const card = document.getElementById('platform-manager-card');

    if (configBtn && card) {
      configBtn.onclick = () => {
        card.style.display = card.style.display === 'none' ? 'block' : 'none';
      };
    }
    if (closeBtn && card) {
      closeBtn.onclick = () => card.style.display = 'none';
    }
  }

  private static async initPlatforms() {
    this.platforms = await PersistenceEngine.getPlatforms();
    this.renderPlatforms();

    const form = document.getElementById('platform-form') as HTMLFormElement;
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('platform-name') as HTMLInputElement;
        const yieldInput = document.getElementById('platform-yield') as HTMLInputElement;

        const newPlatform = {
          name: nameInput.value,
          annual_yield: parseFloat(yieldInput.value),
          type: nameInput.value.toLowerCase() === 'bitcoin' ? 'dynamic' : 'fixed' as 'dynamic' | 'fixed'
        };

        if (newPlatform.name && !isNaN(newPlatform.annual_yield)) {
          await PersistenceEngine.savePlatform(newPlatform);
          nameInput.value = '';
          yieldInput.value = '';

          this.platforms = await PersistenceEngine.getPlatforms();
          this.renderPlatforms();
          this.renderAllocRows();
        }
      };
    }

    (window as any).deletePlatform = async (id: number) => {
      if (!confirm("Supprimer cette plateforme ?")) return;
      await PersistenceEngine.deletePlatform(id);
      this.platforms = await PersistenceEngine.getPlatforms();
      this.renderPlatforms();
      this.renderAllocRows();
    };
  }

  private static renderPlatforms() {
    const list = document.getElementById('platform-list');
    if (!list) return;

    list.innerHTML = this.platforms.map(p => `
      <div class="hw-card" style="padding: 6px 12px; display: flex; align-items: center; gap: 10px; font-size: 0.7rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;">
        <span style="font-weight: 700;">${escapeHTML(p.name)}</span>
        ${p.type === 'dynamic' ? '<span class="badge" style="background: var(--color-primary); color: white; font-size: 0.5rem; padding: 1px 4px;">DYNAMIQUE</span>' : `<span style="color: var(--color-success); font-weight: 600;">${p.annual_yield}%</span>`}
        <button onclick="window.deletePlatform(${p.id})" style="background: none; border: none; color: var(--color-danger); cursor: pointer; padding: 0 4px; font-size: 1rem; margin-left: auto;">&times;</button>
      </div>
    `).join('');
  }

  private static initDiversification() {
    const salaryInput = document.getElementById('salary-input') as HTMLInputElement;
    const divSection = document.getElementById('investment-diversification');
    const addBtn = document.getElementById('add-platform-alloc');

    if (!salaryInput || !divSection || !addBtn) return;

    salaryInput.addEventListener('input', () => {
      const total = parseFloat(salaryInput.value) || 0;
      const investQuota = WealthEngine.allocate(total).investment;

      if (total > 0) {
        divSection.style.display = 'block';
        const quotaLabel = document.getElementById('investment-quota-label');
        if (quotaLabel) quotaLabel.textContent = investQuota.toLocaleString();
        this.updateRemainingQuota();
      } else {
        divSection.style.display = 'none';
      }
    });

    addBtn.onclick = () => {
      if (this.platforms.length === 0) {
        alert("Veuillez d'abord créer une plateforme !");
        return;
      }
      const id = Math.random().toString(36).substr(2, 9);
      this.platformAllocRows.push({ id, platformId: this.platforms[0].id!, amount: 0 });
      this.renderAllocRows();
      this.updateRemainingQuota();
    };

    (window as any).updateAllocRow = (id: string, field: 'platform' | 'amount', value: string) => {
      const row = this.platformAllocRows.find(r => r.id === id);
      if (row) {
        if (field === 'platform') row.platformId = parseInt(value);
        else row.amount = parseFloat(value) || 0;
        this.updateRemainingQuota();
      }
    };

    (window as any).removeAllocRow = (id: string) => {
      this.platformAllocRows = this.platformAllocRows.filter(r => r.id !== id);
      this.renderAllocRows();
      this.updateRemainingQuota();
    };
  }

  private static renderAllocRows() {
    const list = document.getElementById('platform-allocations-list');
    if (!list) return;

    // Surgical update: only re-render if count changed or IDs differ to preserve focus
    const currentChildren = Array.from(list.children);
    const currentIds = currentChildren.map(c => c.getAttribute('data-row-id'));
    const newIds = this.platformAllocRows.map(r => r.id);

    const needsFullRender = currentIds.length !== newIds.length || currentIds.some((id, i) => id !== newIds[i]);

    if (needsFullRender) {
      list.innerHTML = this.platformAllocRows.map(row => {
        const plat = this.platforms.find(p => p.id === row.platformId);
        return `
        <div class="hw-alloc-row" data-row-id="${row.id}">
          <label for="plat-select-${row.id}" class="u-visually-hidden">Plateforme</label>
          <select id="plat-select-${row.id}" class="hw-input" onchange="window.updateAllocRow('${row.id}', 'platform', this.value)">
            ${this.platforms.map(p => `
              <option value="${p.id}" ${p.id === row.platformId ? 'selected' : ''}>
                ${escapeHTML(p.name)} ${p.type === 'dynamic' ? '(Variable)' : `(${p.annual_yield}%)`}
              </option>`).join('')}
          </select>
          <div class="hw-alloc-input-container">
            <label for="plat-amount-${row.id}" class="u-visually-hidden">Montant pour ${plat?.name || 'plateforme'}</label>
            <input type="number" id="plat-amount-${row.id}" class="hw-input hw-alloc-input-header" 
                   placeholder="0.00" value="${row.amount || ''}" step="any"
                   oninput="window.updateAllocRow('${row.id}', 'amount', this.value)">
            <span class="hw-alloc-currency">€</span>
          </div>
          <button type="button" onclick="window.removeAllocRow('${row.id}')" aria-label="Supprimer l'allocation" class="btn-icon-sm" style="background: rgba(239, 68, 68, 0.1); color: var(--color-danger); border-radius: 8px;">
            ✕
          </button>
        </div>
      `}).join('');
    } else {
      // Identity preserved - just update values if they differ
      this.platformAllocRows.forEach((row, i) => {
        const rowEl = currentChildren[i] as HTMLElement;
        const select = rowEl.querySelector('select') as HTMLSelectElement;
        const input = rowEl.querySelector('input') as HTMLInputElement;

        if (select && select.value !== String(row.platformId)) {
          select.value = String(row.platformId);
        }
        if (input && document.activeElement !== input) {
          const val = row.amount === 0 ? '' : String(row.amount);
          if (input.value !== val) input.value = val;
        }
      });
    }
  }

  private static updateRemainingQuota() {
    const salaryInput = document.getElementById('salary-input') as HTMLInputElement;
    const total = parseFloat(salaryInput.value) || 0;
    const investQuota = WealthEngine.allocate(total).investment;

    const allocated = this.platformAllocRows.reduce((sum, r) => sum + r.amount, 0);
    const remaining = investQuota - allocated;
    const progress = investQuota > 0 ? (allocated / investQuota) * 100 : 0;

    const warning = document.getElementById('alloc-warning');
    const remLabel = document.getElementById('remaining-quota');
    const submitBtn = document.getElementById('submit-allocation') as HTMLButtonElement;
    const progressFill = document.getElementById('alloc-progress-fill');

    if (progressFill) {
      progressFill.style.width = `${Math.min(progress, 100)}%`;
      if (progress > 100.01) progressFill.classList.add('over-limit');
      else progressFill.classList.remove('over-limit');
    }

    if (Math.abs(remaining) > 0.001) {
      if (warning) warning.style.display = 'block';
      if (remLabel) {
        remLabel.textContent = Math.abs(remaining).toLocaleString('fr-FR', { minimumFractionDigits: 2 });
        remLabel.style.color = remaining < 0 ? 'var(--color-danger)' : 'var(--color-text-muted)';

        const prefix = document.getElementById('remaining-prefix');
        if (prefix) prefix.textContent = remaining < 0 ? "Exposé : +" : "Reste à placer : ";
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
        submitBtn.style.cursor = 'not-allowed';
      }
    } else {
      if (warning) warning.style.display = 'none';
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
      }
    }
  }

  private static async initForm() {
    const form = document.getElementById('wealth-form') as HTMLFormElement;
    if (!form) return;

    form.onsubmit = async (e) => {
      e.preventDefault();
      const amountInput = document.getElementById('salary-input') as HTMLInputElement;
      const dateInput = document.getElementById('wealth-date-input') as HTMLInputElement;

      const amount = parseFloat(amountInput.value);
      const timestamp = dateInput.value ? new Date(dateInput.value).getTime() : undefined;

      if (isNaN(amount) || amount <= 0) return;

      await this.registerAllocation(amount, timestamp, this.platformAllocRows);

      // Reset form
      form.reset();
      this.platformAllocRows = [];
      this.renderAllocRows();
      const divSection = document.getElementById('investment-diversification');
      if (divSection) divSection.style.display = 'none';

      this.triggerHaptic('success');
      await this.hydrate();
    };
  }

  private static triggerHaptic(type: 'click' | 'success') {
    if ('vibrate' in navigator) {
      navigator.vibrate(type === 'success' ? [50, 30, 50] : 10);
    }
  }

  static async registerAllocation(amount: number, timestamp?: number, platforms?: { platformId: number, amount: number }[]) {
    const alloc = WealthEngine.allocate(amount);

    const investmentBreakdown = platforms && platforms.length > 0
      ? platforms.map(p => ({ amount: p.amount, platform_id: p.platformId }))
      : [{ amount: alloc.investment }]; // Fallback

    await WealthHistoryEngine.addEntry(amount, {
      besoins: alloc.necessities,
      investissement: investmentBreakdown,
      securite: alloc.securityBuffer,
      loisirs: alloc.lifestyle
    }, timestamp);

    console.log(`[L'Architecte] Allocation de ${amount} € enregistrée.`);
  }

  static async hydrate() {
    if (!document.getElementById('view-wealth')) return;
    try {
      this.platforms = await PersistenceEngine.getPlatforms();
      const history = await WealthHistoryEngine.getHistory();

      this.updateAllocationHeaders(history);
      this.renderHistory(history);

      if (history.length > 0) {
        const latest = history[0];
        this.renderPieChart(latest);
        this.renderPlatformChart(history);
      }
      this.renderWealthChart(history);
      this.renderPlatforms();
    } catch (err) {
      console.error("[L'Architecte] Échec de l'hydratation :", err);
    }
  }

  private static updateAllocationHeaders(history: AllocationWithItems[]) {
    let totalInvest = 0;
    let totalSecurite = 0;
    let totalLoisirs = 0;

    for (const entry of history) {
      for (const item of entry.items) {
        if (item.category === 'investissement') totalInvest += item.amount;
        else if (item.category === 'securite') totalSecurite += item.amount;
        else if (item.category === 'loisirs') totalLoisirs += item.amount;
      }
    }

    const fmt = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €';

    const investEl = document.getElementById('header-invest-total');
    const securiteEl = document.getElementById('header-securite-total');
    const loisirsEl = document.getElementById('header-loisirs-total');

    if (investEl) investEl.textContent = fmt(totalInvest);
    if (securiteEl) securiteEl.textContent = fmt(totalSecurite);
    if (loisirsEl) loisirsEl.textContent = fmt(totalLoisirs);
  }

  private static historyAbort: AbortController | null = null;

  private static renderHistory(history: AllocationWithItems[]) {
    const container = document.getElementById('wealth-history-list');
    if (!container) return;

    if (history.length === 0) {
      container.innerHTML = '<div class="text-muted" style="padding: 20px; text-align: center;">Aucun historique enregistré.</div>';
      return;
    }

    container.innerHTML = `
      <div class="label-caps" style="margin-bottom: 12px;">HISTORIQUE DU JOURNAL</div>
      ${history.map(entry => {
      const invItems = entry.items.filter(i => i.category === 'investissement');
      const platformBadges = invItems.map(i => {
        const plat = this.platforms.find(p => p.id === i.platform_id);
        if (!plat) return '';
        return `<span class="badge" style="background: rgba(16,185,129,0.1); color: var(--color-success); font-size: 0.55rem; padding: 2px 6px; margin-left: 5px; border-radius: 4px;">→ ${escapeHTML(plat.name)}</span>`;
      }).join('');

      return `
          <div class="hw-list-item" style="display: flex; align-items: center; margin-bottom: 8px;">
            <div style="flex: 1;">
              <div style="font-weight: 700; color: var(--color-primary);">${escapeHTML(entry.label || 'Allocation')}</div>
              <div class="label-caps" style="font-size: 0.6rem;">${new Date(entry.timestamp).toLocaleDateString('fr-FR')} ${platformBadges}</div>
            </div>
            <div style="text-align: right; margin-right: 12px;">
              <div style="font-weight: 800; font-size: 1.1rem;">+${entry.total.toLocaleString()} €</div>
              <div class="label-caps" style="font-size: 0.55rem; color: var(--color-success);">VALIDÉ</div>
            </div>
            <button type="button" class="btn-delete-entry" data-id="${entry.id}" title="Supprimer" style="background: none; border: none; color: var(--color-danger, #EF4444); font-size: 1.2rem; cursor: pointer; padding: 4px 8px; opacity: 0.5; transition: opacity 0.2s;"
              onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.5'">✕</button>
          </div>
        `}).join('')}
    `;

    if (this.historyAbort) this.historyAbort.abort();
    this.historyAbort = new AbortController();

    container.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const deleteBtn = target.closest('.btn-delete-entry') as HTMLElement;
      if (deleteBtn) {
        const id = Number(deleteBtn.dataset.id);
        if (!id || !confirm('Supprimer cette entrée ?')) return;
        await PersistenceEngine.deleteAllocation(id);
        await this.hydrate();
      }
    }, { signal: this.historyAbort.signal });
  }

  private static renderPieChart(entry: AllocationWithItems) {
    const ctx = document.getElementById('allocationPieChart') as HTMLCanvasElement;
    if (!ctx) return;

    if (this.pieChart) this.pieChart.destroy();

    const categoryMap: Record<string, number> = { besoins: 0, investissement: 0, securite: 0, loisirs: 0 };
    entry.items.forEach(item => {
      if (item.category === 'investissement') categoryMap.investissement += item.amount;
      else categoryMap[item.category] = item.amount;
    });

    const data = [categoryMap.besoins, categoryMap.investissement, categoryMap.securite, categoryMap.loisirs];
    const labels = ['Besoins', 'Investissement', 'Sécurité', 'Loisirs'];
    const colors = ['#38BDF8', '#10B981', '#F59E0B', '#6366F1'];

    this.pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 0 }]
      },
      options: {
        cutout: '75%',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1E293B',
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

  private static renderWealthChart(history: AllocationWithItems[]) {
    const canvas = document.getElementById('wealthChart') as HTMLCanvasElement;
    if (!canvas) return;

    if (this.wealthChart) this.wealthChart.destroy();
    if (history.length < 2) {
      canvas.style.display = 'none';
      return;
    }

    canvas.style.display = 'block';
    const sorted = [...history].reverse();
    let cumulative = 0;
    const dataPoints = sorted.map(entry => {
      cumulative += entry.total;
      return {
        label: new Date(entry.timestamp).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
        value: cumulative
      };
    });

    this.wealthChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: dataPoints.map(d => d.label),
        datasets: [{
          label: 'Patrimoine Cumulé (€)',
          data: dataPoints.map(d => d.value),
          borderColor: '#10B981',
          borderWidth: 3,
          pointRadius: 5,
          tension: 0.3,
          fill: true,
          backgroundColor: 'rgba(16, 185, 129, 0.1)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            grid: { color: 'rgba(255,255,255,0.03)' },
            ticks: {
              color: '#64748B',
              callback: (v) => `${(Number(v) / 1000).toFixed(0)}k €`
            }
          }
        }
      }
    });
  }

  private static renderPlatformChart(history: AllocationWithItems[]) {
    const ctx = document.getElementById('platformPieChart') as HTMLCanvasElement;
    if (!ctx) return;

    if (this.platformChart) this.platformChart.destroy();

    const platformMap: Record<string, number> = {};
    history.forEach(entry => {
      entry.items.forEach(item => {
        if (item.category === 'investissement') {
          const plat = this.platforms.find(p => p.id === item.platform_id);
          const name = plat ? plat.name : 'Non spécifié';
          platformMap[name] = (platformMap[name] || 0) + item.amount;
        }
      });
    });

    const labels = Object.keys(platformMap);
    const data = Object.values(platformMap);

    if (labels.length === 0) return;

    const colors = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#6366F1'];

    this.platformChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.raw?.toLocaleString()} €`
            }
          }
        }
      }
    });

    this.renderPlatformLegend(labels, data, colors);
  }

  private static renderPlatformLegend(labels: string[], values: number[], colors: string[]) {
    const container = document.getElementById('platform-legend');
    if (!container) return;

    const total = values.reduce((sum, v) => sum + v, 0);

    container.innerHTML = labels.map((label, i) => {
      const pct = total > 0 ? ((values[i] / total) * 100).toFixed(1) : '0';
      return `
      <div class="legend-card">
        <div style="display: flex; align-items: center;">
          <span class="legend-dot" style="background: ${colors[i % colors.length]}"></span>
          <span class="label-caps" style="font-size: 0.55rem;">${escapeHTML(label)}</span>
        </div>
        <div style="font-weight: 700; font-size: 0.9rem;">${values[i].toLocaleString()} €</div>
        <div style="font-size: 0.65rem; color: var(--color-success); font-weight: 600;">${pct}% DU PORTFOLIO</div>
      </div>
    `}).join('');
  }
}
