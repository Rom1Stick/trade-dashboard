import { PersistenceEngine } from './persistence';
import type { Allocation, AllocationItem } from './models';


/**
 * WealthHistoryEngine [3FN]
 * Gestion des allocations patrimoniales normalisées.
 * Chaque soumission crée une NOUVELLE entrée (plus d'écrasement).
 */

export interface AllocationWithItems extends Allocation {
  items: AllocationItem[];
}

// Re-export pour compatibilité avec WealthManager
export type WealthEntry = AllocationWithItems;

export class WealthHistoryEngine {

  /**
   * Enregistrer une allocation et ses 4 catégories.
   * Crée toujours une nouvelle entrée (autoIncrement).
   */
  static async addEntry(total: number, breakdown: {
    besoins: number;
    investissement: { amount: number; platform_id?: number }[];
    securite: number;
    loisirs: number;
  }, timestamp?: number): Promise<number> {
    const dateObj = timestamp ? new Date(timestamp) : new Date();
    const monthYear = dateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const time = `${dateObj.getHours()}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
    const label = `${monthYear.charAt(0).toUpperCase() + monthYear.slice(1)} (${time})`;

    const allocation: Allocation = {
      total,
      timestamp: dateObj.getTime(),
      label
    };

    const items: Omit<AllocationItem, 'id' | 'allocation_id'>[] = [
      { category: 'besoins', amount: breakdown.besoins, percentage: (breakdown.besoins / total) * 100 },
      { category: 'securite', amount: breakdown.securite, percentage: (breakdown.securite / total) * 100 },
      { category: 'loisirs', amount: breakdown.loisirs, percentage: (breakdown.loisirs / total) * 100 }
    ];

    // Add multiple items for investment diversification
    breakdown.investissement.forEach(inv => {
      items.push({
        category: 'investissement',
        amount: inv.amount,
        percentage: (inv.amount / total) * 100,
        platform_id: inv.platform_id
      });
    });

    return PersistenceEngine.saveAllocation(allocation, items);
  }

  /**
   * Récupérer toutes les allocations avec leurs items.
   * Triées par timestamp décroissant.
   */
  static async getHistory(): Promise<AllocationWithItems[]> {
    return PersistenceEngine.getAllocations();
  }

  /**
   * Somme de toutes les allocations enregistrées.
   */
  static async getTotalAccumulated(): Promise<number> {
    return PersistenceEngine.getTotalAccumulated();
  }
}
