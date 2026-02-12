import { PersistenceEngine } from './persistence';
import type { Subscription, ExpenseCategory } from './models';
import { escapeHTML } from './sanitize';
import { CATEGORIES, VALID_CATEGORIES } from './categories';

/**
 * SubscriptionManager [Abonnements Récurrents]
 * Gère les abonnements mensuels avec auto-matérialisation en dépenses.
 */

export class SubscriptionManager {
  private static editingId: number | null = null;
  private static editingStartDate: string | null = null;

  static async init() {
    this.setupForm();
    this.setupDeleteHandlers();
    await this.materializeCurrentMonth();
    await this.render();
  }

  /** Matérialise les abonnements du mois courant en dépenses */
  private static async materializeCurrentMonth() {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const count = await PersistenceEngine.materializeSubscriptions(monthKey);
    if (count > 0) {
      console.log(`[SubscriptionManager] ${count} abonnement(s) auto-ajouté(s) aux dépenses de ${monthKey}`);
    }
  }

  /** Génère le monthKey courant au format YYYY-MM */
  private static getCurrentMonthKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /** Configure le formulaire d'ajout/modification */
  private static setupForm() {
    const form = document.getElementById('sub-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const labelInput = document.getElementById('sub-label') as HTMLInputElement;
      const amountInput = document.getElementById('sub-amount') as HTMLInputElement;
      const categorySelect = document.getElementById('sub-category') as HTMLSelectElement;

      const label = labelInput.value.trim();
      const amount = parseFloat(amountInput.value);
      const categoryRaw = categorySelect.value;

      if (!label || !amount || amount <= 0) return;

      // P2-04: Validate category against known values
      if (!VALID_CATEGORIES.has(categoryRaw)) return;
      const category = categoryRaw as ExpenseCategory;

      if (this.editingId !== null) {
        // P0-02: Preserve original startDate in edit mode
        const startDate = this.editingStartDate || this.getCurrentMonthKey();
        await PersistenceEngine.updateSubscription({
          id: this.editingId,
          label,
          amount,
          category,
          startDate,
          active: 1
        });
        this.editingId = null;
        this.editingStartDate = null;
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'AJOUTER';
      } else {
        // Nouveau
        await PersistenceEngine.saveSubscription({
          label,
          amount,
          category,
          startDate: this.getCurrentMonthKey(),
          active: 1
        });
      }

      // Reset
      labelInput.value = '';
      amountInput.value = '';

      if (navigator.vibrate) navigator.vibrate(30);
      await this.render();
    });
  }

  /** Met en place la délégation d'événements pour delete et edit */
  private static setupDeleteHandlers() {
    const list = document.getElementById('sub-list');
    list?.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;

      // Delete
      const deleteBtn = target.closest('.sub-delete-btn') as HTMLElement | null;
      if (deleteBtn) {
        const id = parseInt(deleteBtn.dataset.subId || '0');
        if (id) {
          // P2-02: Confirmation avant suppression
          if (!confirm('Supprimer cet abonnement ?')) return;
          await PersistenceEngine.deleteSubscription(id);
          if (navigator.vibrate) navigator.vibrate(20);
          await this.render();
        }
        return;
      }

      // Edit
      const editBtn = target.closest('.sub-edit-btn') as HTMLElement | null;
      if (editBtn) {
        const id = parseInt(editBtn.dataset.subId || '0');
        if (id) this.startEdit(id);
        return;
      }
    });
  }

  /** Pré-remplit le formulaire pour éditer un abonnement */
  private static async startEdit(id: number) {
    const subs = await PersistenceEngine.getAllSubscriptions();
    const sub = subs.find(s => s.id === id);
    if (!sub) return;

    const labelInput = document.getElementById('sub-label') as HTMLInputElement;
    const amountInput = document.getElementById('sub-amount') as HTMLInputElement;
    const categorySelect = document.getElementById('sub-category') as HTMLSelectElement;

    labelInput.value = sub.label;
    amountInput.value = sub.amount.toString();
    categorySelect.value = sub.category;

    this.editingId = id;
    // P0-02: Store original startDate for preservation
    this.editingStartDate = sub.startDate;

    const submitBtn = document.querySelector('#sub-form button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'MODIFIER';

    // Scroll vers le form
    document.getElementById('sub-form')?.scrollIntoView({ behavior: 'smooth' });
  }

  /** Render complet : summary + list */
  static async render() {
    const subs = await PersistenceEngine.getAllSubscriptions();
    const activeSubs = subs.filter(s => s.active === 1);
    this.renderSummary(activeSubs);
    this.renderList(activeSubs);
  }

  /** Affiche le header résumé : total + count */
  private static renderSummary(subs: Subscription[]) {
    const totalEl = document.getElementById('sub-total');
    const countEl = document.getElementById('sub-count');

    const total = subs.reduce((sum, s) => sum + s.amount, 0);

    if (totalEl) {
      totalEl.textContent = `${total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`;
    }
    if (countEl) {
      // P3-01: Simplified pluralization
      const n = subs.length;
      countEl.textContent = `${n} abonnement${n !== 1 ? 's' : ''} actif${n !== 1 ? 's' : ''}`;
    }
  }

  /** Affiche la liste des abonnements */
  private static renderList(subs: Subscription[]) {
    const container = document.getElementById('sub-list');
    if (!container) return;

    if (subs.length === 0) {
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: #94A3B8; font-size: 0.85rem;">Aucun abonnement actif</div>';
      return;
    }

    container.innerHTML = subs.map(s => {
      const cat = CATEGORIES[s.category];
      return `
        <div class="hw-list-item sub-item">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
            <span class="expense-cat-icon" style="background: ${cat.color}20; color: ${cat.color};">${cat.emoji}</span>
            <div style="min-width: 0;">
              <div style="font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(s.label)}</div>
              <div class="label-caps" style="font-size: 0.55rem;">${escapeHTML(cat.label)} · depuis ${escapeHTML(s.startDate)}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-weight: 800; color: var(--color-primary);">${s.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €<span style="font-weight: 400; font-size: 0.7rem; color: #94A3B8;">/mois</span></span>
            <button class="sub-edit-btn btn-icon-sm" data-sub-id="${s.id}" title="Modifier">✏️</button>
            <button class="sub-delete-btn btn-icon-sm" data-sub-id="${s.id}" title="Supprimer">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }
}
