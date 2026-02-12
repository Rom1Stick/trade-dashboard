import { PersistenceEngine } from './persistence';
import type { Subscription, ExpenseCategory } from './models';
import { escapeHTML } from './sanitize';

/**
 * SubscriptionManager [Abonnements Récurrents]
 * Gère les abonnements mensuels avec auto-matérialisation en dépenses.
 */

const CATEGORIES: Record<ExpenseCategory, { emoji: string; label: string; color: string }> = {
  logement: { emoji: '🏠', label: 'Logement', color: '#6366F1' },
  courses: { emoji: '🛒', label: 'Courses', color: '#10B981' },
  transport: { emoji: '🚗', label: 'Transport', color: '#F59E0B' },
  loisirs: { emoji: '🎮', label: 'Loisirs', color: '#EC4899' },
  sante: { emoji: '💊', label: 'Santé', color: '#EF4444' },
  abonnements: { emoji: '📱', label: 'Abonnements', color: '#8B5CF6' },
  shopping: { emoji: '🛍️', label: 'Shopping', color: '#3B82F6' },
  autre: { emoji: '📎', label: 'Autre', color: '#6B7280' }
};

export class SubscriptionManager {
  private static editingId: number | null = null;

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
      const category = categorySelect.value as ExpenseCategory;

      if (!label || !amount || amount <= 0) return;

      const now = new Date();
      const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      if (this.editingId !== null) {
        // Mode édition
        await PersistenceEngine.updateSubscription({
          id: this.editingId,
          label,
          amount,
          category,
          startDate,
          active: true
        });
        this.editingId = null;
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'AJOUTER';
      } else {
        // Nouveau
        await PersistenceEngine.saveSubscription({
          label,
          amount,
          category,
          startDate,
          active: true
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

    const submitBtn = document.querySelector('#sub-form button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'MODIFIER';

    // Scroll vers le form
    document.getElementById('sub-form')?.scrollIntoView({ behavior: 'smooth' });
  }

  /** Render complet : summary + list */
  static async render() {
    const subs = await PersistenceEngine.getAllSubscriptions();
    const activeSubs = subs.filter(s => s.active);
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
      countEl.textContent = `${subs.length} abonnement${subs.length !== 1 ? 's' : ''} actif${subs.length !== 1 ? 's' : ''}`;
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
              <div class="label-caps" style="font-size: 0.55rem;">${cat.label} · depuis ${s.startDate}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-weight: 800; color: var(--color-accent);">${s.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €<span style="font-weight: 400; font-size: 0.7rem; color: #94A3B8;">/mois</span></span>
            <button class="sub-edit-btn btn-icon-sm" data-sub-id="${s.id}" title="Modifier">✏️</button>
            <button class="sub-delete-btn btn-icon-sm" data-sub-id="${s.id}" title="Supprimer">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }
}
