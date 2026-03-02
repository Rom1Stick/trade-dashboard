import { PersistenceEngine } from './persistence';
import { CATEGORIES } from './categories';
import type { Expense, Subscription } from './models';

/**
 * ExportManager [QW-1]
 * Génération d'exports CSV et PDF (via @media print) pour les modules Dépenses & Patrimoine.
 */

export class ExportManager {

  // ─── CSV Export ──────────────────────────────────────────

  /** Exporte les dépenses de la semaine courante en CSV */
  static async exportExpensesCSV(): Promise<void> {
    const expenses: Expense[] = await PersistenceEngine.getExpenses();
    if (!expenses.length) return;

    const header = 'Date,Catégorie,Description,Montant (€)\n';
    const rows = expenses
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
      .map(e => {
        const date = e.timestamp ? new Date(e.timestamp).toLocaleDateString('fr-FR') : '—';
        const cat = CATEGORIES[e.category]?.label ?? e.category;
        const label = `"${(e.label || '').replace(/"/g, '""')}"`;
        const amount = e.amount.toFixed(2);
        return `${date},${cat},${label},${amount}`;
      })
      .join('\n');

    this.downloadBlob(header + rows, 'depenses_export.csv', 'text/csv;charset=utf-8;');
  }

  /** Exporte les abonnements en CSV */
  static async exportSubscriptionsCSV(): Promise<void> {
    const subs: Subscription[] = await PersistenceEngine.getSubscriptions();
    if (!subs.length) return;

    const header = 'Nom,Catégorie,Montant Mensuel (€),Date de début\n';
    const rows = subs
      .map(s => {
        const cat = CATEGORIES[s.category]?.label ?? s.category;
        const label = `"${(s.label || '').replace(/"/g, '""')}"`;
        const amount = s.amount.toFixed(2);
        const startDate = s.startDate || '—';
        return `${label},${cat},${amount},${startDate}`;
      })
      .join('\n');

    this.downloadBlob(header + rows, 'abonnements_export.csv', 'text/csv;charset=utf-8;');
  }

  /** Exporte l'historique patrimoine en CSV */
  static async exportWealthCSV(): Promise<void> {
    const { WealthHistoryEngine } = await import('./wealth_history_engine');
    const history = await WealthHistoryEngine.getFullHistory();
    if (!history.length) return;

    const header = 'Date,Montant Total (€),Nb Plateformes\n';
    const rows = history
      .map(h => {
        const date = new Date(h.timestamp).toLocaleDateString('fr-FR');
        const amount = h.amount.toFixed(2);
        const nbPlat = h.items?.length ?? 0;
        return `${date},${amount},${nbPlat}`;
      })
      .join('\n');

    this.downloadBlob(header + rows, 'patrimoine_export.csv', 'text/csv;charset=utf-8;');
  }

  // ─── PDF Export (via Print) ─────────────────────────────

  /** Ouvre la fenêtre d'impression du navigateur sur la vue active */
  static printCurrentView(): void {
    window.print();
  }

  // ─── Utilities ──────────────────────────────────────────

  private static downloadBlob(content: string, filename: string, mime: string): void {
    // Add UTF-8 BOM for Excel compatibility
    const bom = '\uFEFF';
    const blob = new Blob([bom + content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
}
