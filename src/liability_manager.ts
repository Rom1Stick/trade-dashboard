import { PersistenceEngine } from './persistence';
import type { Liability, LiabilityType } from './models';

/**
 * LiabilityManager — Gestion des Passifs
 * Dettes, crédits immobiliers, prêts — vision nette du patrimoine.
 */
export class LiabilityManager {

  private static readonly TYPE_LABELS: Record<LiabilityType, { emoji: string; label: string }> = {
    credit_immo: { emoji: '🏠', label: 'Crédit Immo' },
    pret_conso: { emoji: '🚗', label: 'Prêt Conso' },
    dette: { emoji: '💳', label: 'Dette' },
    autre: { emoji: '📄', label: 'Autre' },
  };

  static init() {
    this.initForm();
    void this.hydrate();
  }

  // ═══════════════════════════════════════════════════════
  // FORM HANDLING
  // ═══════════════════════════════════════════════════════

  private static initForm() {
    const form = document.getElementById('liability-form') as HTMLFormElement;
    const toggleBtn = document.getElementById('toggle-liabilities');
    const card = document.getElementById('liabilities-section');

    // Toggle visibility
    toggleBtn?.addEventListener('click', () => {
      if (!card) return;
      const isHidden = card.style.display === 'none';
      card.style.display = isHidden ? 'block' : 'none';
      if (toggleBtn) toggleBtn.textContent = isHidden ? '▼' : '▶';
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const getValue = (id: string) => (document.getElementById(id) as HTMLInputElement)?.value;

      const label = getValue('liability-label');
      const type = getValue('liability-type') as LiabilityType;
      const initialAmount = parseFloat(getValue('liability-initial')) || 0;
      const remainingAmount = parseFloat(getValue('liability-remaining')) || initialAmount;
      const monthlyPayment = parseFloat(getValue('liability-monthly')) || 0;
      const interestRate = parseFloat(getValue('liability-rate')) || 0;
      const startDate = getValue('liability-start') || new Date().toISOString().slice(0, 7);
      const endDate = getValue('liability-end') || undefined;

      if (!label || initialAmount <= 0) return;

      await PersistenceEngine.saveLiability({
        label,
        type,
        initialAmount,
        remainingAmount,
        monthlyPayment,
        interestRate,
        startDate,
        endDate,
        active: 1,
        timestamp: Date.now(),
      });

      form.reset();
      if ('vibrate' in navigator) navigator.vibrate(10);
      await this.hydrate();
    });
  }

  // ═══════════════════════════════════════════════════════
  // HYDRATE + RENDER
  // ═══════════════════════════════════════════════════════

  static async hydrate() {
    const liabilities = await PersistenceEngine.getLiabilities();
    this.renderList(liabilities);
    this.renderSummary(liabilities);
    await this.renderNetWorth(liabilities);
  }

  private static renderList(liabilities: Liability[]) {
    const container = document.getElementById('liability-list');
    if (!container) return;

    if (liabilities.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 30px 20px; color: var(--color-muted, #64748B); font-size: 0.8rem;">
          Aucun passif enregistré.<br>Ajoutez vos crédits et dettes pour calculer votre patrimoine net.
        </div>
      `;
      return;
    }

    // Sort: active first, then by remaining amount desc
    const sorted = [...liabilities].sort((a, b) => {
      if (a.active !== b.active) return b.active - a.active;
      return b.remainingAmount - a.remainingAmount;
    });

    container.innerHTML = sorted.map(lib => {
      const meta = this.TYPE_LABELS[lib.type];
      const paidPercent = lib.initialAmount > 0
        ? Math.min(100, ((lib.initialAmount - lib.remainingAmount) / lib.initialAmount) * 100)
        : 0;
      const fmt = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const isActive = lib.active === 1;

      return `
        <div class="liability-card ${isActive ? '' : 'liability-settled'}" data-id="${lib.id}">
          <div class="liability-header">
            <div class="liability-title">
              <span class="liability-type-badge">${meta.emoji}</span>
              <span class="liability-label">${lib.label}</span>
              <span class="liability-type-tag">${meta.label}</span>
            </div>
            <div class="liability-actions">
              ${isActive
          ? `<button class="btn-icon-subtle liability-settle-btn" data-id="${lib.id}" title="Marquer comme soldé" aria-label="Marquer ${lib.label} comme soldé">✓</button>`
          : `<span style="font-size: 0.65rem; color: var(--color-success, #10b981); font-weight: 700;">SOLDÉ</span>`
        }
              <button class="btn-icon-subtle liability-delete-btn" data-id="${lib.id}" title="Supprimer" aria-label="Supprimer ${lib.label}">✕</button>
            </div>
          </div>
          <div class="liability-amounts">
            <div class="liability-amount-item">
              <span class="label-caps hw-text-muted-compact">RESTANT</span>
              <span class="widget-value pnl-neg">${fmt(lib.remainingAmount)} $</span>
            </div>
            <div class="liability-amount-item">
              <span class="label-caps hw-text-muted-compact">MENSUALITÉ</span>
              <span class="widget-value">${fmt(lib.monthlyPayment)} $</span>
            </div>
            <div class="liability-amount-item">
              <span class="label-caps hw-text-muted-compact">TAUX</span>
              <span class="widget-value">${lib.interestRate.toFixed(2)}%</span>
            </div>
          </div>
          <div class="liability-progress-container">
            <div class="liability-progress">
              <div class="liability-progress-fill" style="width: ${paidPercent.toFixed(1)}%"></div>
            </div>
            <span class="liability-progress-label">${paidPercent.toFixed(0)}% remboursé — ${fmt(lib.initialAmount)} $ initial</span>
          </div>
        </div>
      `;
    }).join('');

    // Attach event listeners
    container.querySelectorAll('.liability-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt((btn as HTMLElement).dataset.id || '0');
        if (!id) return;
        await PersistenceEngine.deleteLiability(id);
        if ('vibrate' in navigator) navigator.vibrate(10);
        await this.hydrate();
      });
    });

    container.querySelectorAll('.liability-settle-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt((btn as HTMLElement).dataset.id || '0');
        if (!id) return;
        const lib = liabilities.find(l => l.id === id);
        if (!lib) return;
        lib.active = 0;
        lib.remainingAmount = 0;
        await PersistenceEngine.updateLiability(lib);
        if ('vibrate' in navigator) navigator.vibrate([50, 30, 50]);
        await this.hydrate();
      });
    });
  }

  private static renderSummary(liabilities: Liability[]) {
    const active = liabilities.filter(l => l.active === 1);
    const totalRemaining = active.reduce((s, l) => s + l.remainingAmount, 0);
    const totalMonthly = active.reduce((s, l) => s + l.monthlyPayment, 0);

    const fmt = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const setTxt = (id: string, txt: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };

    setTxt('liability-total-remaining', `${fmt(totalRemaining)} $`);
    setTxt('liability-total-monthly', `${fmt(totalMonthly)} $`);
    setTxt('liability-count', `${active.length}`);
  }

  // ═══════════════════════════════════════════════════════
  // NET WORTH CALCULATION
  // ═══════════════════════════════════════════════════════

  static async getTotalLiabilities(): Promise<number> {
    const liabilities = await PersistenceEngine.getActiveLiabilities();
    return liabilities.reduce((s, l) => s + l.remainingAmount, 0);
  }

  private static async renderNetWorth(liabilities: Liability[]) {
    const banner = document.getElementById('net-worth-banner');
    if (!banner) return;

    // Get latest allocation total (gross wealth)
    const allocations = await PersistenceEngine.getAllocations();
    const grossWealth = allocations.length > 0
      ? allocations[allocations.length - 1].total
      : 0;

    const totalLiabilities = liabilities
      .filter(l => l.active === 1)
      .reduce((s, l) => s + l.remainingAmount, 0);

    const netWorth = grossWealth - totalLiabilities;

    const fmt = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const setTxt = (id: string, txt: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };

    setTxt('nw-gross', `${fmt(grossWealth)} $`);
    setTxt('nw-liabilities', `${fmt(totalLiabilities)} $`);
    setTxt('nw-net', `${fmt(netWorth)} $`);

    // Color code net worth
    const netEl = document.getElementById('nw-net');
    if (netEl) {
      netEl.className = `title-hero ${netWorth >= 0 ? 'pnl-pos' : 'pnl-neg'}`;
    }

    banner.style.display = 'block';
  }
}
